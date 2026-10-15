#!/usr/bin/env python3
"""Prepara a base histórica por seção do 1º turno de 2026.

Somente biblioteca padrão. Descobre recursos no CKAN do TSE ou aceita --input.
O processamento é streaming e persiste incrementalmente em SQLite antes de exportar
partições JSON por município para consumo estático pelo Vite/GitHub Pages.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sqlite3
import sys
import urllib.request
import urllib.parse
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import BinaryIO, Iterable

CKAN_API = "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=resultados-2026-boletim-de-urna"
SCHEMA_VERSION = "eleicoes-fast-geographic-v1"
OFFICE_CODE = "0001"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def discover_resource(uf: str, api_url: str = CKAN_API) -> dict:
    with urllib.request.urlopen(api_url, timeout=60) as response:
        package = json.load(response)
    if not package.get("success"):
        raise RuntimeError("API CKAN do TSE não retornou success=true")
    prefix = f"{uf.upper()} - BOLETIM DE URNA - PRIMEIRO TURNO"
    candidates = [r for r in package["result"].get("resources", []) if str(r.get("name", "")).upper().startswith(prefix)]
    if len(candidates) != 1:
        raise RuntimeError(f"Esperado 1 recurso oficial para {uf}; encontrados {len(candidates)}")
    return candidates[0]


def download_resume(url: str, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".part")
    offset = partial.stat().st_size if partial.exists() else 0
    request = urllib.request.Request(url, headers={"User-Agent": "EleicoesFast-geographic/1", **({"Range": f"bytes={offset}-"} if offset else {})})
    with urllib.request.urlopen(request, timeout=120) as response:
        mode = "ab" if offset and response.status == 206 else "wb"
        with partial.open(mode) as output:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                output.write(block)
    partial.replace(destination)
    return destination


def official_candidate_destinations(uf: str, election_id: str, poll_id: str | None) -> tuple[dict[str, str], str]:
    base="https://resultados.tse.jus.br"; environment="oficial"
    with urllib.request.urlopen(f"{base}/{environment}/comum/config/ele-c.json",timeout=60) as response:
        config=json.load(response)
    selected_poll=next((poll for poll in config.get("pl",[]) if (not poll_id or str(poll.get("cd"))==poll_id) and any(str(e.get("cd"))==election_id for e in poll.get("e",[]))),None)
    if not selected_poll: raise RuntimeError(f"EA11 não contém eleição {election_id}/pleito {poll_id}")
    template=next((entry.get("dir") for entry in config.get("arq",[]) if entry.get("tp")=="u"),None)
    if not template: raise RuntimeError("EA11 não forneceu arq[].dir tp=u")
    tokens={"<base>":base,"<ambiente>":environment,"<ciclo>":str(selected_poll.get("c")),"<cd_eleicao>":election_id,"<cd_pleito>":str(selected_poll.get("cd")),"<uf>":uf.lower()}
    directory=template
    for token,replacement in tokens.items(): directory=directory.replace(token,replacement)
    if re.search(r"<[^>]+>",directory): raise RuntimeError(f"Diretório EA20 contém token não resolvido: {directory}")
    url=f"{directory.rstrip('/')}/{uf.lower()}-c0001-e{election_id.zfill(6)}-u.json"
    with urllib.request.urlopen(url,timeout=60) as response: payload=json.load(response)
    result={}
    for cargo in payload.get("carg",[]):
        for group in cargo.get("agr",[]):
            for party in group.get("par",[]):
                for candidate in party.get("cand",[]):
                    number=str(candidate.get("n","")).strip(); destination=str(candidate.get("dvt","")).strip()
                    if number: result[number]=destination
    return result,url


def apply_candidate_destinations(database: Path, manifest_id: str, uf: str, destinations: dict[str,str]) -> None:
    db=sqlite3.connect(database)
    try:
        for number,destination in destinations.items():
            db.execute("UPDATE candidate_votes SET vote_destination=? WHERE number=? AND section_key IN (SELECT section_key FROM election_sections WHERE source_manifest_id=? AND uf=?)",(destination,number,manifest_id,uf))
        db.execute("UPDATE candidate_votes SET vote_destination='NÃO COMPUTADO NO EA20' WHERE vote_destination IS NULL AND section_key IN (SELECT section_key FROM election_sections WHERE source_manifest_id=? AND uf=?)",(manifest_id,uf))
        valid_clause="UPPER(vote_destination) LIKE 'V%LIDO%'"
        db.execute(f"""UPDATE section_historical_votes SET
          valid_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND {valid_clause}),0),
          pt_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND UPPER(c.party)='PT' AND {valid_clause}),0),
          pl_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND UPPER(c.party)='PL' AND {valid_clause}),0),
          other_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND UPPER(COALESCE(c.party,'')) NOT IN ('PT','PL') AND {valid_clause}),0),
          null_votes=COALESCE(null_votes,0)+COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND NOT ({valid_clause})),0)
          WHERE section_key IN (SELECT section_key FROM election_sections WHERE source_manifest_id=? AND uf=?)""",(manifest_id,uf))
        db.commit()
    finally: db.close()


def create_schema(db: sqlite3.Connection) -> None:
    db.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS election_sections(
      section_key TEXT PRIMARY KEY, election_id TEXT NOT NULL, poll_id TEXT, round INTEGER NOT NULL,
      office_code TEXT NOT NULL, uf TEXT NOT NULL, municipality_code TEXT NOT NULL,
      zone TEXT NOT NULL, section TEXT NOT NULL, main_section TEXT, aggregated_sections TEXT NOT NULL,
      voting_place_id TEXT, electorate INTEGER, metadata TEXT, source_manifest_id TEXT
    );
    CREATE INDEX IF NOT EXISTS ix_sections_municipality ON election_sections(election_id,round,office_code,uf,municipality_code,zone,section);
    CREATE INDEX IF NOT EXISTS ix_sections_history_lookup ON election_sections(round,office_code,uf,municipality_code,zone,section);
    CREATE TABLE IF NOT EXISTS section_historical_votes(
      section_key TEXT PRIMARY KEY, electorate INTEGER, turnout INTEGER, abstention INTEGER,
      valid_votes INTEGER, blank_votes INTEGER, null_votes INTEGER, pt_votes INTEGER,
      pl_votes INTEGER, other_votes INTEGER, source_manifest_id TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidate_votes(
      section_key TEXT NOT NULL, candidate_id TEXT NOT NULL, number TEXT, name TEXT, party TEXT,
      vote_destination TEXT, votes INTEGER, PRIMARY KEY(section_key,candidate_id)
    );
    CREATE TABLE IF NOT EXISTS geographic_import_manifest(
      id TEXT PRIMARY KEY, payload TEXT NOT NULL, imported_at TEXT NOT NULL
    );
    """)


def value(row: dict, *names: str) -> str | None:
    for name in names:
        result = row.get(name)
        if result is not None and str(result).strip() not in ("", "#NULO#"):
            return str(result).strip()
    return None


def integer(row: dict, *names: str) -> int | None:
    raw = value(row, *names)
    if raw is None:
        return None
    try:
        return int(float(raw.replace(",", ".")))
    except ValueError:
        return None


def padded(raw: str | None, size: int) -> str:
    if raw is None or not re.fullmatch(r"\d+", raw):
        raise ValueError(f"Identificador numérico ausente ou inválido: {raw!r}")
    return raw.zfill(size)


def section_key(election_id: str, poll_id: str | None, uf: str, municipality: str, zone: str, section: str) -> str:
    return f"{election_id}:{poll_id or '-'}:1:{OFFICE_CODE}:{uf}:{municipality}:{zone}:{section}"


def csv_streams(path: Path) -> Iterable[tuple[str, BinaryIO]]:
    if zipfile.is_zipfile(path):
        archive = zipfile.ZipFile(path)
        for name in archive.namelist():
            if name.lower().endswith(".csv"):
                yield name, archive.open(name)
    else:
        yield path.name, path.open("rb")


def normalize_row(row: dict) -> dict:
    return {str(key).lstrip("\ufeff").strip().upper(): val for key, val in row.items() if key is not None}


def is_president_first_round(row: dict) -> bool:
    office = (value(row, "DS_CARGO_PERGUNTA", "DS_CARGO") or "").upper()
    office_code = value(row, "CD_CARGO_PERGUNTA", "CD_CARGO")
    return integer(row, "NR_TURNO") == 1 and (office_code in {"1", "01", "0001"} or office == "PRESIDENTE")


def ingest(path: Path, database: Path, manifest_id: str, forced_election_id: str | None = None, forced_poll_id: str | None = None) -> dict:
    database.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(database)
    create_schema(db)
    rows = accepted = 0
    election_ids: set[str] = set()
    poll_ids: set[str] = set()
    ufs: set[str] = set()
    for source_name, binary in csv_streams(path):
        text = io.TextIOWrapper(binary, encoding="latin-1", errors="replace", newline="")
        reader = csv.DictReader(text, delimiter=";")
        if not reader.fieldnames:
            raise RuntimeError(f"CSV sem cabeçalho: {source_name}")
        for raw in reader:
            rows += 1
            row = normalize_row(raw)
            if not is_president_first_round(row):
                continue
            election_id = forced_election_id or value(row, "CD_ELEICAO")
            poll_id = forced_poll_id or value(row, "CD_PLEITO")
            if not election_id:
                raise RuntimeError("CD_ELEICAO ausente; informe --election-id")
            uf = (value(row, "SG_UF") or "").upper()
            municipality = padded(value(row, "CD_MUNICIPIO"), 5)
            zone = padded(value(row, "NR_ZONA"), 4)
            section = padded(value(row, "NR_SECAO"), 4)
            key = section_key(election_id, poll_id, uf, municipality, zone, section)
            aggregated_raw = value(row, "DS_SECOES_AGREGADAS", "DS_AGREGADAS", "NR_SECOES_AGREGADAS") or ""
            aggregated = [token.zfill(4) for token in re.findall(r"\d+", aggregated_raw)]
            electorate = integer(row, "QT_APTOS", "QT_ELEITORES")
            turnout = integer(row, "QT_COMPARECIMENTO")
            abstention = integer(row, "QT_ABSTENCOES", "QT_ABSTENCAO")
            voting_place = value(row, "NR_LOCAL_VOTACAO")
            db.execute("""INSERT INTO election_sections VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
              ON CONFLICT(section_key) DO UPDATE SET electorate=COALESCE(excluded.electorate,election_sections.electorate),
              voting_place_id=COALESCE(excluded.voting_place_id,election_sections.voting_place_id),aggregated_sections=excluded.aggregated_sections""",
              (key,election_id,poll_id,1,OFFICE_CODE,uf,municipality,zone,section,section,json.dumps(aggregated),voting_place,electorate,json.dumps({"source":source_name},ensure_ascii=False),manifest_id))
            db.execute("""INSERT INTO section_historical_votes(section_key,electorate,turnout,abstention,valid_votes,blank_votes,null_votes,pt_votes,pl_votes,other_votes,source_manifest_id)
              VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(section_key) DO UPDATE SET electorate=COALESCE(excluded.electorate,electorate),turnout=COALESCE(excluded.turnout,turnout),abstention=COALESCE(excluded.abstention,abstention),source_manifest_id=excluded.source_manifest_id""",
              (key,electorate,turnout,abstention,0,0,0,0,0,0,manifest_id))
            vote_type=(value(row,"DS_TIPO_VOTAVEL") or "").upper()
            vote_type_code=value(row,"CD_TIPO_VOTAVEL")
            votes=integer(row,"QT_VOTOS") or 0
            if "BRANCO" in vote_type:
                db.execute("UPDATE section_historical_votes SET blank_votes=? WHERE section_key=?",(votes,key))
            elif "NULO" in vote_type:
                db.execute("UPDATE section_historical_votes SET null_votes=? WHERE section_key=?",(votes,key))
            elif "NOMINAL" in vote_type or vote_type_code in {"1","01"}:
                number=value(row,"NR_VOTAVEL")
                name=value(row,"NM_VOTAVEL")
                party=value(row,"SG_PARTIDO")
                candidate_id=value(row,"SQ_CANDIDATO") or f"{number or '-'}:{name or '-'}:{party or '-'}"
                db.execute("""INSERT INTO candidate_votes VALUES(?,?,?,?,?,?,?) ON CONFLICT(section_key,candidate_id) DO UPDATE SET votes=excluded.votes,name=excluded.name,party=excluded.party""",
                           (key,candidate_id,number,name,party,value(row,"DS_DESTINACAO_VOTOS"),votes))
            accepted += 1
            election_ids.add(election_id); ufs.add(uf)
            if poll_id: poll_ids.add(poll_id)
            if accepted % 5000 == 0:
                db.commit()
        text.close()
    db.execute("""UPDATE section_historical_votes SET
      valid_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key),0),
      pt_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND UPPER(c.party)='PT'),0),
      pl_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND UPPER(c.party)='PL'),0),
      other_votes=COALESCE((SELECT SUM(votes) FROM candidate_votes c WHERE c.section_key=section_historical_votes.section_key AND UPPER(COALESCE(c.party,'')) NOT IN ('PT','PL')),0)""")
    db.commit()
    sections=db.execute("SELECT COUNT(*) FROM election_sections WHERE source_manifest_id=?",(manifest_id,)).fetchone()[0]
    db.close()
    if len(election_ids) != 1:
        raise RuntimeError(f"A fonte contém {len(election_ids)} eleições presidenciais do 1º turno: {sorted(election_ids)}")
    return {"rowsRead":rows,"rowsAccepted":accepted,"sections":sections,"electionId":next(iter(election_ids)),"pollId":next(iter(poll_ids)) if len(poll_ids)==1 else forced_poll_id,"ufs":sorted(ufs)}


def export_partitions(database: Path, output: Path, metadata: dict) -> dict:
    db=sqlite3.connect(database); db.row_factory=sqlite3.Row
    partitions=[]
    municipalities=db.execute("SELECT DISTINCT uf,municipality_code FROM election_sections WHERE source_manifest_id=? ORDER BY uf,municipality_code",(metadata["manifestId"],)).fetchall()
    for item in municipalities:
        uf=item["uf"]; municipality=item["municipality_code"]
        section_rows=db.execute("SELECT * FROM election_sections WHERE source_manifest_id=? AND uf=? AND municipality_code=? ORDER BY zone,section",(metadata["manifestId"],uf,municipality)).fetchall()
        sections=[]; historical=[]
        for record in section_rows:
            identity={"electionId":record["election_id"],"pollId":record["poll_id"],"round":1,"officeCode":record["office_code"],"uf":uf,"municipalityCode":municipality,"zone":record["zone"],"section":record["section"]}
            sections.append({**identity,"key":record["section_key"],"mainSection":record["main_section"],"aggregatedSections":json.loads(record["aggregated_sections"]),"votingPlaceId":record["voting_place_id"],"electorate":record["electorate"],"metadata":json.loads(record["metadata"]),"sourceManifestId":metadata["manifestId"]})
            totals=db.execute("SELECT * FROM section_historical_votes WHERE section_key=?",(record["section_key"],)).fetchone()
            candidates=[{"candidateId":c["candidate_id"],"number":c["number"],"name":c["name"],"party":c["party"],"voteDestination":c["vote_destination"],"votes":c["votes"]} for c in db.execute("SELECT * FROM candidate_votes WHERE section_key=? ORDER BY candidate_id",(record["section_key"],))]
            historical.append({**identity,"key":record["section_key"],"sectionKey":record["section_key"],"ptVotes":totals["pt_votes"],"plVotes":totals["pl_votes"],"otherVotes":totals["other_votes"],"electorate":totals["electorate"],"turnout":totals["turnout"],"abstention":totals["abstention"],"validVotes":totals["valid_votes"],"blankVotes":totals["blank_votes"],"nullVotes":totals["null_votes"],"candidates":candidates,"isFinalHistorical":True,"sourceManifestId":metadata["manifestId"]})
        payload={"schemaVersion":SCHEMA_VERSION,"manifestId":metadata["manifestId"],"electionId":metadata["electionId"],"pollId":metadata.get("pollId"),"round":1,"officeCode":OFFICE_CODE,"uf":uf,"municipalityCode":municipality,"sections":sections,"historicalVotes":historical}
        relative=Path("partitions")/uf.lower()/f"{municipality}.json"; target=output/relative; target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
        partitions.append({"id":f"{uf}:{municipality}","uf":uf,"municipalityCode":municipality,"path":relative.as_posix(),"sha256":sha256_file(target),"bytes":target.stat().st_size,"sections":len(sections),"historicalVotes":len(historical)})
    db.close()
    manifest={"id":metadata["manifestId"],"schemaVersion":SCHEMA_VERSION,"generatedAt":utc_now(),"electionId":metadata["electionId"],"pollId":metadata.get("pollId"),"round":1,"officeCode":OFFICE_CODE,"sourceUrl":metadata.get("sourceUrl"),"sourceRetrievedAt":metadata.get("sourceRetrievedAt"),"sourceSha256":metadata["sourceSha256"],"sourceVersion":metadata.get("sourceVersion"),"finalHistoricalResult":True,"partitions":partitions,"totals":{"sections":sum(p["sections"] for p in partitions),"historicalVotes":sum(p["historicalVotes"] for p in partitions),"municipalities":len(partitions),"ufs":len({p["uf"] for p in partitions})}}
    output.mkdir(parents=True,exist_ok=True); (output/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    return manifest


def prepare(args: argparse.Namespace) -> dict:
    output=Path(args.output).resolve(); cache=Path(args.cache).resolve(); resources=[]
    if args.input:
        ufs=[args.uf.upper()]; sources=[(ufs[0],Path(args.input).resolve(),None)]
    else:
        ufs=[uf.strip().upper() for uf in args.uf.split(",") if uf.strip()]; sources=[]
        for uf in ufs:
            resource=discover_resource(uf,args.api_url); url=resource.get("url")
            if not url: raise RuntimeError("Recurso CKAN sem URL")
            sources.append((uf,download_resume(url,cache/Path(urllib.parse.urlparse(url).path).name),resource))
    source_hashes=[sha256_file(source) for _,source,_ in sources]
    combined_hash=hashlib.sha256("".join(source_hashes).encode()).hexdigest(); manifest_id=f"tse-2026-r1-{combined_hash[:12]}"
    database=output/"canonical.sqlite"
    all_stats=[]
    for (uf,source,resource),source_hash in zip(sources,source_hashes):
        source_stats=ingest(source,database,manifest_id,args.election_id,args.poll_id); all_stats.append(source_stats)
        ea20_url=None
        if resource is not None:
            destinations,ea20_url=official_candidate_destinations(uf,source_stats["electionId"],source_stats.get("pollId")); apply_candidate_destinations(database,manifest_id,uf,destinations)
        resources.append({"uf":uf,"url":resource.get("url") if resource else source.as_uri(),"sha256":source_hash,"version":resource.get("last_modified") if resource else None,"candidateDestinationUrl":ea20_url})
    election_ids={item["electionId"] for item in all_stats}; poll_ids={item["pollId"] for item in all_stats if item.get("pollId")}
    if len(election_ids)!=1: raise RuntimeError(f"Eleições divergentes entre UFs: {sorted(election_ids)}")
    db=sqlite3.connect(database)
    try:
        unique_sections=db.execute(
            "SELECT COUNT(*) FROM election_sections WHERE source_manifest_id=?",
            (manifest_id,),
        ).fetchone()[0]
    finally:
        db.close()
    stats={"rowsRead":sum(item["rowsRead"] for item in all_stats),"rowsAccepted":sum(item["rowsAccepted"] for item in all_stats),"sections":unique_sections,"electionId":next(iter(election_ids)),"pollId":next(iter(poll_ids)) if len(poll_ids)==1 else args.poll_id,"ufs":ufs}
    metadata={**stats,"manifestId":manifest_id,"sourceUrl":"https://dadosabertos.tse.jus.br/dataset/resultados-2026-boletim-de-urna","sourceRetrievedAt":utc_now(),"sourceSha256":combined_hash,"sourceVersion":"CKAN"}
    manifest=export_partitions(database,output,metadata)
    manifest["resources"]=resources; (output/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding="utf-8")
    db=sqlite3.connect(database)
    try:
        db.execute("INSERT OR REPLACE INTO geographic_import_manifest VALUES(?,?,?)",(manifest_id,json.dumps(manifest,ensure_ascii=False),utc_now())); db.commit()
    finally:
        db.close()
    return {"database":str(database),"manifest":str(output/"manifest.json"),"stats":stats,"totals":manifest["totals"]}


def parser() -> argparse.ArgumentParser:
    result=argparse.ArgumentParser(description=__doc__)
    result.add_argument("--uf",required=True,help="UF ou lista separada por vírgula, por exemplo AC ou AC,AL")
    result.add_argument("--input",help="ZIP/CSV oficial já baixado; omita para descoberta CKAN")
    result.add_argument("--output",default="public/data/geographic",help="Diretório das partições e SQLite")
    result.add_argument("--cache",default=".cache/geographic",help="Cache retomável de downloads")
    result.add_argument("--election-id",help="Sobrescreve CD_ELEICAO somente quando a fonte não o fornecer")
    result.add_argument("--poll-id",help="Sobrescreve CD_PLEITO somente quando a fonte não o fornecer")
    result.add_argument("--api-url",default=CKAN_API)
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(prepare(parser().parse_args()),ensure_ascii=False,indent=2))
    except Exception as error:
        print(f"erro: {error}",file=sys.stderr); raise SystemExit(1)
