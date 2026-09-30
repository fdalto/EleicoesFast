#!/usr/bin/env python3
"""Consolida indicadores previamente obtidos de fonte oficial, sem imputação."""
from __future__ import annotations
import argparse, sys
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA

REQUIRED = {"codigo_ibge", "ano_referencia", "data_publicacao", "fonte_nome", "fonte_url", "data_extracao", "observacao_metodologica"}
def main() -> None:
  parser = argparse.ArgumentParser(); parser.add_argument("--input", type=Path, required=True, help="CSV/Parquet oficial já harmonizado por código IBGE"); args = parser.parse_args()
  source = pd.read_parquet(args.input) if args.input.suffix == ".parquet" else pd.read_csv(args.input, dtype={"codigo_ibge":"string"})
  missing = REQUIRED - set(source)
  if missing: raise SystemExit(f"Metadados obrigatórios ausentes: {sorted(missing)}")
  source["codigo_ibge"] = source.codigo_ibge.astype("string")
  source["data_publicacao"] = pd.to_datetime(source.data_publicacao, errors="raise", utc=True)
  for election, deadline in ((2018, "2018-10-07"), (2022, "2022-10-02")):
    source[f"elegivel_para_eleicao_{election}"] = source.data_publicacao.le(deadline)
  source.to_parquet(DATA / "normalized/dim_indicadores_municipais.parquet", index=False)
if __name__ == "__main__": main()
