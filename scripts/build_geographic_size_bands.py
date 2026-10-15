"""Materializa histórico municipal e faixas de porte populacional estimado.

A estimativa usa votos válidos históricos / fator de votos válidos por habitante.
Não é população oficial e existe apenas para agrupar municípios no modelo local.
"""

from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


VALID_VOTES_PER_INHABITANT = 0.56
# Estratos acordados para o GeographicSwingEngine 1.0 (math_model.md).
POPULATION_LIMITS = (5_000, 10_000, 50_000, 200_000)


def band_for_population(estimated_population: int) -> int:
    for index, limit in enumerate(POPULATION_LIMITS, start=1):
        if estimated_population <= limit:
            return index
    return 5


def create_municipality_history(db: sqlite3.Connection) -> int:
    """Agrega uma única vez o histórico seccional usado como base municipal."""
    db.execute("""
        CREATE TABLE IF NOT EXISTS municipality_historical_votes(
          source_manifest_id TEXT NOT NULL,
          uf TEXT NOT NULL,
          municipality_code TEXT NOT NULL,
          sections INTEGER NOT NULL,
          electorate INTEGER NOT NULL,
          turnout INTEGER NOT NULL,
          abstention INTEGER NOT NULL,
          valid_votes INTEGER NOT NULL,
          blank_votes INTEGER NOT NULL,
          null_votes INTEGER NOT NULL,
          pt_votes INTEGER NOT NULL,
          pl_votes INTEGER NOT NULL,
          other_votes INTEGER NOT NULL,
          PRIMARY KEY(source_manifest_id, uf, municipality_code)
        )
    """)
    rows = db.execute("""
        SELECT s.source_manifest_id, s.uf, s.municipality_code,
               COUNT(*) AS sections,
               COALESCE(SUM(h.electorate), 0), COALESCE(SUM(h.turnout), 0),
               COALESCE(SUM(h.abstention), 0), COALESCE(SUM(h.valid_votes), 0),
               COALESCE(SUM(h.blank_votes), 0), COALESCE(SUM(h.null_votes), 0),
               COALESCE(SUM(h.pt_votes), 0), COALESCE(SUM(h.pl_votes), 0),
               COALESCE(SUM(h.other_votes), 0)
        FROM election_sections s
        JOIN section_historical_votes h ON h.section_key=s.section_key
        WHERE s.round=1 AND s.office_code='0001' AND s.source_manifest_id IS NOT NULL
        GROUP BY s.source_manifest_id, s.uf, s.municipality_code
    """).fetchall()
    db.execute("DELETE FROM municipality_historical_votes")
    db.executemany("INSERT INTO municipality_historical_votes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def export_municipality_history(db: sqlite3.Connection, output: Path) -> None:
    """Exporta somente os totais municipais necessários ao navegador.

    A tabela nacional de seções continua local e não é copiada para o site.
    """
    rows = db.execute("""
        SELECT h.uf, h.municipality_code, h.sections, h.valid_votes, h.pt_votes,
               h.pl_votes, h.other_votes, b.estimated_population, b.population_band
        FROM municipality_historical_votes h
        JOIN municipality_size_bands b ON b.source_manifest_id=h.source_manifest_id
          AND b.uf=h.uf AND b.municipality_code=h.municipality_code
        ORDER BY h.uf, h.municipality_code
    """).fetchall()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({
        "schemaVersion": "eleicoes-fast-municipality-history-v1",
        "reference": {"year": 2026, "round": 1, "officeCode": "0001"},
        "populationEstimate": {"validVotesPerInhabitant": VALID_VOTES_PER_INHABITANT, "bands": [5_000, 10_000, 50_000, 200_000]},
        "municipalities": [{"uf": row[0], "municipalityCode": row[1], "sections": row[2], "validVotes": row[3], "ptVotes": row[4], "plVotes": row[5], "otherVotes": row[6], "estimatedPopulation": row[7], "populationBand": row[8]} for row in rows],
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def create_size_bands(database: Path, factor: float = VALID_VOTES_PER_INHABITANT, output: Path | None = None) -> dict[str, int | float]:
    if not 0 < factor <= 1:
        raise ValueError("O fator de votos válidos por habitante deve estar entre 0 e 1")
    database = database.resolve()
    if not database.is_file():
        raise FileNotFoundError(f"Banco geográfico não encontrado: {database}")
    db = sqlite3.connect(database)
    try:
        columns = {row[1] for row in db.execute("PRAGMA table_info(election_sections)")}
        if {"round", "office_code", "uf", "municipality_code", "zone", "section"}.issubset(columns):
            db.execute("CREATE INDEX IF NOT EXISTS ix_sections_history_lookup ON election_sections(round,office_code,uf,municipality_code,zone,section)")
        municipality_count = create_municipality_history(db)
        db.execute("""
            CREATE TABLE IF NOT EXISTS municipality_size_bands(
              source_manifest_id TEXT NOT NULL,
              uf TEXT NOT NULL,
              municipality_code TEXT NOT NULL,
              historical_valid_votes INTEGER NOT NULL,
              estimated_population INTEGER NOT NULL,
              population_band INTEGER NOT NULL CHECK(population_band BETWEEN 1 AND 5),
              valid_votes_per_inhabitant REAL NOT NULL,
              method TEXT NOT NULL,
              PRIMARY KEY(source_manifest_id, uf, municipality_code)
            )
        """)
        rows = db.execute("""
            SELECT source_manifest_id, uf, municipality_code, valid_votes
            FROM municipality_historical_votes
        """).fetchall()
        db.execute("DELETE FROM municipality_size_bands")
        values = []
        counts = {band: 0 for band in range(1, 6)}
        for manifest_id, uf, municipality_code, valid_votes in rows:
            estimated_population = round(valid_votes / factor)
            population_band = band_for_population(estimated_population)
            counts[population_band] += 1
            values.append((manifest_id, uf, municipality_code, valid_votes, estimated_population, population_band, factor, "valid-votes-population-proxy-v1"))
        db.executemany("INSERT INTO municipality_size_bands VALUES(?,?,?,?,?,?,?,?)", values)
        if output:
            export_municipality_history(db, output)
        db.commit()
        return {"municipalities": municipality_count, "factor": factor, **{f"band{band}": count for band, count in counts.items()}}
    finally:
        db.close()


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--database", default="public/data/geographic/canonical.sqlite")
    result.add_argument("--factor", type=float, default=VALID_VOTES_PER_INHABITANT)
    result.add_argument("--output", default="public/data/geographic/municipality-history.json", help="Agregado municipal consumido pelo site")
    return result


if __name__ == "__main__":
    args = parser().parse_args()
    print(create_size_bands(Path(args.database), args.factor, Path(args.output)))
