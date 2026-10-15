"""API local, somente leitura, para o histórico geográfico.

O servidor nunca consulta o TSE e nunca recebe votos correntes. Ele resolve
identificadores de seções na base final do 1º turno e devolve suas somas por
município para que o navegador calcule a projeção GeographicSwing.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from contextlib import closing
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


MAX_JSON_BODY = 2 * 1024 * 1024
MAX_HISTORY_BATCH = 200
REFERENCE = {"ano": 2026, "turno": 1, "cargo": "PRESIDENTE"}


def number(value: str | None, default: int, minimum: int = 0, maximum: int | None = None) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError as error:
        raise ValueError("Parâmetro numérico inválido") from error
    if parsed < minimum or (maximum is not None and parsed > maximum):
        raise ValueError("Parâmetro numérico fora do intervalo permitido")
    return parsed


def text_identifier(value: Any, label: str, width: int, *, letters: bool = False) -> str:
    if not isinstance(value, (str, int)):
        raise ValueError(f"{label} inválido")
    result = str(value).strip().upper() if letters else str(value).strip()
    if letters:
        if len(result) != width or not result.isalpha():
            raise ValueError(f"{label} inválido")
        return result
    if not result.isdigit() or len(result) > width:
        raise ValueError(f"{label} inválido")
    return result.zfill(width)


class GeographicRepository:
    def __init__(self, database: Path):
        self.database = database.resolve()

    def connect(self) -> sqlite3.Connection:
        if not self.database.is_file():
            raise FileNotFoundError(f"Banco geográfico não encontrado: {self.database}")
        connection = sqlite3.connect(f"file:{self.database.as_posix()}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        return connection

    def health(self, verify_integrity: bool = False) -> dict[str, Any]:
        with closing(self.connect()) as db:
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0] if verify_integrity else "not-checked"
            sections = db.execute("SELECT COUNT(*) FROM election_sections WHERE round=1 AND office_code='0001'").fetchone()[0]
            municipalities = db.execute("SELECT COUNT(*) FROM municipality_historical_votes").fetchone()[0]
            manifest = db.execute("SELECT source_manifest_id FROM municipality_historical_votes LIMIT 1").fetchone()
        return {"status": "ok" if integrity in {"ok", "not-checked"} else "degraded", "integrity": integrity, "database": self.database.name, "reference": REFERENCE, "sections": sections, "municipalities": municipalities, "historyManifest": manifest[0] if manifest else None, "mode": "historical-read-only", "maxHistoryBatch": MAX_HISTORY_BATCH}

    def history_sections_summary(self, payload: dict[str, Any]) -> dict[str, Any]:
        reference = payload.get("referencia")
        if not isinstance(reference, dict) or reference != REFERENCE:
            raise ValueError("referencia deve ser exatamente 2026/1/PRESIDENTE")
        raw_sections = payload.get("secoes")
        if not isinstance(raw_sections, list):
            raise ValueError("secoes deve ser uma lista")
        if len(raw_sections) > MAX_HISTORY_BATCH:
            raise ValueError(f"O lote suporta no máximo {MAX_HISTORY_BATCH} seções")
        requested: list[tuple[str, str, str, str]] = []
        seen: set[tuple[str, str, str, str]] = set()
        for item in raw_sections:
            if not isinstance(item, dict):
                raise ValueError("Cada seção deve ser um objeto")
            key = (text_identifier(item.get("uf"), "uf", 2, letters=True), text_identifier(item.get("municipio_tse"), "municipio_tse", 5), text_identifier(item.get("zona"), "zona", 4), text_identifier(item.get("secao"), "secao", 4))
            if key not in seen:
                seen.add(key)
                requested.append(key)
        by_municipality: dict[tuple[str, str], dict[str, int]] = {}
        for uf, municipality, _, _ in requested:
            current = by_municipality.setdefault((uf, municipality), {"requested": 0, "found": 0, "pt": 0, "pl": 0, "other": 0, "valid": 0})
            current["requested"] += 1
        if not requested:
            return {"referencia": "2026-1T-PRESIDENTE", "municipios": [], "resumo": {"secoes_solicitadas": 0, "secoes_encontradas": 0, "secoes_nao_encontradas": 0}}
        values = ",".join("(?,?,?,?)" for _ in requested)
        params: list[Any] = [part for row in requested for part in row]
        query = f"""WITH requested(uf, municipality_code, zone, section) AS (VALUES {values})
            SELECT r.uf, r.municipality_code, h.pt_votes, h.pl_votes, h.other_votes, h.valid_votes
            FROM requested r LEFT JOIN election_sections s ON s.round=1 AND s.office_code='0001'
              AND s.uf=r.uf AND s.municipality_code=r.municipality_code AND s.zone=r.zone AND s.section=r.section
            LEFT JOIN section_historical_votes h ON h.section_key=s.section_key"""
        with closing(self.connect()) as db:
            rows = db.execute(query, params).fetchall()
        for row in rows:
            current = by_municipality[(row["uf"], row["municipality_code"])]
            if row["valid_votes"] is None:
                continue
            current["found"] += 1
            for key, field in (("pt", "pt_votes"), ("pl", "pl_votes"), ("other", "other_votes"), ("valid", "valid_votes")):
                current[key] += int(row[field] or 0)
        municipalities = []
        for (uf, municipality_code), item in sorted(by_municipality.items()):
            paired, missing = item["pt"] + item["pl"], item["requested"] - item["found"]
            status = "ok" if not missing and paired else "partial" if item["found"] else "not_found"
            if item["found"] and not paired:
                status = "no_pt_pl"
            municipalities.append({"uf": uf, "municipio_tse": municipality_code, "secoes_solicitadas": item["requested"], "secoes_encontradas": item["found"], "secoes_nao_encontradas": missing, "historico": {"pt_votos": item["pt"], "pl_votos": item["pl"], "outros_votos": item["other"], "validos_votos": item["valid"], "pt_pct_entre_pt_pl": item["pt"] / paired * 100 if paired else None, "pl_pct_entre_pt_pl": item["pl"] / paired * 100 if paired else None, "pt_pct_validos": item["pt"] / item["valid"] * 100 if item["valid"] else None, "pl_pct_validos": item["pl"] / item["valid"] * 100 if item["valid"] else None}, "status": status})
        found = sum(item["secoes_encontradas"] for item in municipalities)
        return {"referencia": "2026-1T-PRESIDENTE", "municipios": municipalities, "resumo": {"secoes_solicitadas": len(requested), "secoes_encontradas": found, "secoes_nao_encontradas": len(requested) - found}}


class GeographicRequestHandler(BaseHTTPRequestHandler):
    repository: GeographicRepository
    allowed_origins: set[str] = set()

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[geographic-server] {self.address_string()} - {format % args}")

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._cors_headers()
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
        try:
            if parsed.path not in {"/health", "/api/health"}:
                self._json(HTTPStatus.NOT_FOUND, {"error": "Rota não encontrada"})
                return
            self._json(HTTPStatus.OK, self.repository.health(query.get("verify") in {"1", "true"}))
        except (FileNotFoundError, ValueError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except sqlite3.Error as error:
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Falha ao consultar SQLite: {error}"})

    def do_POST(self) -> None:
        try:
            if urlparse(self.path).path != "/api/historico/secoes/resumo":
                self._json(HTTPStatus.NOT_FOUND, {"error": "Rota não encontrada"})
                return
            content_length = number(self.headers.get("Content-Length"), 0, 0, MAX_JSON_BODY)
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("O corpo JSON deve ser um objeto")
            self._json(HTTPStatus.OK, self.repository.history_sections_summary(payload))
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
            self._json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except sqlite3.Error as error:
            self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": f"Falha ao consultar SQLite: {error}"})

    def _cors_headers(self) -> None:
        origin = self.headers.get("Origin")
        if origin and origin in self.allowed_origins:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError):
            pass


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--database", default="public/data/geographic/canonical.sqlite")
    result.add_argument("--host", default="127.0.0.1")
    result.add_argument("--port", type=int, default=8765)
    result.add_argument("--cors-origin", action="append", default=["http://127.0.0.1:5173", "http://localhost:5173"])
    return result


def main() -> None:
    args = parser().parse_args()
    GeographicRequestHandler.repository = GeographicRepository(Path(args.database))
    GeographicRequestHandler.allowed_origins = set(args.cors_origin)
    server = ThreadingHTTPServer((args.host, args.port), GeographicRequestHandler)
    print(f"API de histórico local: http://{args.host}:{args.port}/health")
    print(f"SQLite somente leitura: {GeographicRequestHandler.repository.database}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
