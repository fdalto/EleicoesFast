"""Simulador local da API de apuração 2026 do TSE.

Usa um subconjunto do SQLite geográfico como massa de teste e disponibiliza
EA11, EA12, EA14, EA15, EA16 e EA20 em 127.0.0.1. Os votos expostos são
explicitamente sintéticos: são agregados do histórico local, não resultados
de uma eleição corrente nem uma réplica do serviço do TSE.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.parse import parse_qs, urlparse


def now_parts() -> tuple[str, str]:
    current = datetime.now()
    return current.strftime("%d/%m/%Y"), current.strftime("%H:%M:%S")


@dataclass(frozen=True)
class Section:
    zone: str
    section: str
    electorate: int
    turnout: int
    valid_votes: int
    pt_votes: int
    pl_votes: int
    other_votes: int


class Simulator:
    def __init__(self, args: argparse.Namespace):
        self.uf = args.uf.upper()
        self.municipality = args.municipality.zfill(5)
        self.municipality_name = args.municipality_name or f"Município simulado {self.municipality}"
        self.round = args.round
        self.environment = args.environment.strip("/")
        self.cycle = args.cycle
        self.poll_id = str(args.poll_id)
        self.federal_election = str(args.federal_election)
        self.state_election = str(args.state_election)
        self.sections = self._load_sections(Path(args.database), args.sections)
        if not 0 <= args.counted <= len(self.sections):
            raise ValueError(f"--counted deve estar entre 0 e {len(self.sections)}")
        self.counted = args.counted
        self.version = 1
        self.lock = Lock()

    def _load_sections(self, database: Path, maximum: int) -> list[Section]:
        if maximum < 1:
            raise ValueError("--sections deve ser maior que zero")
        database = database.resolve()
        if not database.is_file():
            raise FileNotFoundError(f"Banco geográfico não encontrado: {database}")
        db = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
        try:
            rows = db.execute(
                """SELECT s.zone, s.section, COALESCE(s.electorate, 0),
                          COALESCE(h.turnout, 0), COALESCE(h.valid_votes, 0),
                          COALESCE(h.pt_votes, 0), COALESCE(h.pl_votes, 0),
                          COALESCE(h.other_votes, 0)
                   FROM election_sections s
                   JOIN section_historical_votes h ON h.section_key=s.section_key
                   WHERE s.round=1 AND s.office_code='0001' AND s.uf=? AND s.municipality_code=?
                   ORDER BY s.zone, s.section LIMIT ?""",
                (self.uf, self.municipality, maximum),
            ).fetchall()
        finally:
            db.close()
        if not rows:
            raise ValueError(f"Não há seções históricas para {self.uf}/{self.municipality}")
        return [Section(str(row[0]), str(row[1]), *(int(value) for value in row[2:])) for row in rows]

    def snapshot(self) -> tuple[int, int]:
        with self.lock:
            return self.counted, self.version

    def set_counted(self, counted: int) -> tuple[int, int]:
        if not 0 <= counted <= len(self.sections):
            raise ValueError(f"count deve estar entre 0 e {len(self.sections)}")
        with self.lock:
            if counted != self.counted:
                self.counted = counted
                self.version += 1
            return self.counted, self.version

    def advance(self, amount: int) -> tuple[int, int]:
        if amount < 1:
            raise ValueError("sections deve ser maior que zero")
        counted, _ = self.snapshot()
        return self.set_counted(min(len(self.sections), counted + amount))

    def ea11(self) -> dict[str, Any]:
        return {
            "arq": [
                {"tp": "cm", "dir": "<base>/<ambiente>/<ciclo>/<cd_eleicao>/config"},
                {"tp": "ab", "dir": "<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>"},
                {"tp": "cs", "dir": "<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>"},
                {"tp": "u", "dir": "<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>"},
            ],
            "pl": [{"cd": self.poll_id, "c": self.cycle, "e": [
                {"cd": self.federal_election, "t": str(self.round), "tp": "8", "abr": [{"cd": "br", "cp": [{"cd": "1"}]}]},
                {"cd": self.state_election, "t": str(self.round), "tp": "1", "abr": [{"cd": "br", "cp": [{"cd": "3"}, {"cd": "5"}]}]},
            ]}],
        }

    def ea12(self) -> dict[str, Any]:
        return {"abr": [{"cd": self.uf.lower(), "mu": [{"cd": self.municipality, "nm": self.municipality_name}]}]}

    def ea14(self) -> dict[str, Any]:
        _, version = self.snapshot()
        date, time = now_parts()
        return {"abr": [{"cd": self.uf.lower(), "idg": f"sim-{version}", "dg": date, "hg": time}]}

    def ea15(self) -> dict[str, Any]:
        _, version = self.snapshot()
        date, time = now_parts()
        return {"abr": [{"cd": self.uf.lower(), "mu": [{"cd": self.municipality, "idg": f"sim-{version}", "dg": date, "hg": time}]}]}

    def ea16(self) -> dict[str, Any]:
        counted, _ = self.snapshot()
        date, time = now_parts()
        zones: dict[str, list[dict[str, Any]]] = {}
        for index, item in enumerate(self.sections):
            row: dict[str, Any] = {"ns": item.section, "nsp": item.section, "e": item.electorate}
            if index < counted:
                row.update({"da": date, "ha": time})
            zones.setdefault(item.zone, []).append(row)
        return {"dg": date, "hg": time, "abr": [{"cd": self.uf.lower(), "mu": [{"cd": self.municipality, "zon": [{"cd": zone, "sec": sections} for zone, sections in zones.items()]}]}]}

    def ea20(self, scope: str) -> dict[str, Any]:
        counted, version = self.snapshot()
        date, time = now_parts()
        visible = self.sections[:counted]
        total_electorate = sum(item.electorate for item in self.sections)
        electorate_counted = sum(item.electorate for item in visible)
        turnout = sum(item.turnout for item in visible)
        valid = sum(item.valid_votes for item in visible)
        pt = sum(item.pt_votes for item in visible)
        pl = sum(item.pl_votes for item in visible)
        other = sum(item.other_votes for item in visible)
        code = "BR" if scope == "br" else self.uf if scope == "uf" else self.municipality
        percent = round((counted / len(self.sections)) * 100, 6)
        candidates = [{"par": [
            {"sg": "PT", "cand": [{"n": "13", "nm": "CANDIDATO PT SIMULADO", "nmu": "PT Simulado", "vap": str(pt), "pvap": str(round((pt / valid * 100) if valid else 0, 2))}]},
            {"sg": "PL", "cand": [{"n": "22", "nm": "CANDIDATO PL SIMULADO", "nmu": "PL Simulado", "vap": str(pl), "pvap": str(round((pl / valid * 100) if valid else 0, 2))}]},
            {"sg": "OUTROS", "cand": [{"n": "99", "nm": "OUTROS SIMULADO", "nmu": "Outros", "vap": str(other), "pvap": str(round((other / valid * 100) if valid else 0, 2))}]},
        ]}]
        return {
            "idg": f"sim-{version}", "dg": date, "hg": time, "tpabr": scope, "cdabr": code,
            "s": {"ts": str(len(self.sections)), "st": str(counted), "snt": str(len(self.sections) - counted), "pst": str(percent)},
            "e": {"te": str(total_electorate), "est": str(electorate_counted), "c": str(turnout), "a": str(max(0, electorate_counted - turnout))},
            "v": {"tv": str(turnout), "vv": str(valid), "vvc": str(valid), "vnom": str(valid), "vb": "0", "tvn": "0", "van": "0", "vansj": "0"},
            "carg": [{"cd": code, "agr": candidates} for code in ("1", "3", "5")],
            "simulator": {"synthetic": True, "source": "historical first-round section totals", "countedSections": counted},
        }

    def status(self) -> dict[str, Any]:
        counted, version = self.snapshot()
        return {"status": "ok", "synthetic": True, "uf": self.uf, "municipalityCode": self.municipality, "sections": len(self.sections), "countedSections": counted, "version": version, "round": self.round}


class Handler(BaseHTTPRequestHandler):
    simulator: Simulator

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[tse-simulator] {self.address_string()} - {format % args}")

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        try:
            payload = self._get(parsed.path)
            if payload is None:
                self._json(HTTPStatus.NOT_FOUND, {"error": "Rota não encontrada"})
            else:
                self._json(HTTPStatus.OK, payload)
        except ValueError as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        try:
            if parsed.path == "/control/advance":
                payload = self.simulator.status() | dict(zip(("countedSections", "version"), self.simulator.advance(int(query.get("sections", "1")))))
            elif parsed.path == "/control/set-counted":
                payload = self.simulator.status() | dict(zip(("countedSections", "version"), self.simulator.set_counted(int(query["count"])) ))
            elif parsed.path == "/control/reset":
                payload = self.simulator.status() | dict(zip(("countedSections", "version"), self.simulator.set_counted(0)))
            else:
                self._json(HTTPStatus.NOT_FOUND, {"error": "Rota não encontrada"})
                return
            self._json(HTTPStatus.OK, payload)
        except (KeyError, ValueError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def _get(self, path: str) -> dict[str, Any] | None:
        simulator = self.simulator
        prefix = f"/{simulator.environment}/"
        if path == "/" or path == "/control/status":
            return simulator.status()
        if path == f"/{simulator.environment}/comum/config/ele-c.json":
            return simulator.ea11()
        if not path.startswith(prefix):
            return None
        parts = path.strip("/").split("/")
        if len(parts) < 5:
            return None
        election, area, filename = parts[2], parts[3], parts[-1]
        if area == "config" and filename.startswith("mun-e") and filename.endswith("-cm.json"):
            return simulator.ea12()
        if area != "dados":
            return None
        if filename.endswith("-cs.json"):
            return simulator.ea16()
        if filename.endswith("-ab.json"):
            return simulator.ea14() if filename.startswith("br-") else simulator.ea15()
        if filename.endswith("-u.json"):
            scope = "br" if filename.startswith("br-") else "municipality" if filename.lower().startswith(simulator.uf.lower() + simulator.municipality) else "uf"
            return simulator.ea20(scope)
        return None

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--database", default="public/data/geographic/canonical.sqlite")
    result.add_argument("--uf", default="AC")
    result.add_argument("--municipality", default="01392")
    result.add_argument("--municipality-name")
    result.add_argument("--sections", type=int, default=20, help="Quantidade máxima de seções históricas na simulação")
    result.add_argument("--counted", type=int, default=0, help="Seções inicialmente apuradas")
    result.add_argument("--round", type=int, choices=(1, 2), default=2)
    result.add_argument("--environment", default="simulado2026")
    result.add_argument("--cycle", default="eleicoesfast")
    result.add_argument("--poll-id", default="9999")
    result.add_argument("--federal-election", default="9001")
    result.add_argument("--state-election", default="9002")
    result.add_argument("--host", default="127.0.0.1")
    result.add_argument("--port", type=int, default=8787)
    return result


def main() -> None:
    args = parser().parse_args()
    Handler.simulator = Simulator(args)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Simulador TSE local: http://{args.host}:{args.port}")
    print(f"Base do campo Simulação: http://{args.host}:{args.port}")
    print(json.dumps(Handler.simulator.status(), ensure_ascii=False))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSimulador encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
