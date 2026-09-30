#!/usr/bin/env python3
"""Inspeciona os CSVs reais do TSE e produz fato presidencial por município."""
from __future__ import annotations
import argparse, csv, sys, zipfile
from pathlib import Path
import pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA, REPORTS, sha256, write_json

ALIASES = {"ano": ["ANO_ELEICAO"], "turno": ["NR_TURNO"], "uf": ["SG_UF"], "codigo_tse": ["CD_MUNICIPIO"], "municipio": ["NM_MUNICIPIO"], "cargo": ["DS_CARGO"], "candidato_id_tse": ["SQ_CANDIDATO"], "numero_candidato": ["NR_CANDIDATO"], "candidato_nome": ["NM_VOTAVEL", "NM_CANDIDATO"], "votos_nominais": ["QT_VOTOS_NOMINAIS"]}
CAPITAIS_IBGE = {"AC":"1200401", "AL":"2704302", "AP":"1600303", "AM":"1302603", "BA":"2927408", "CE":"2304400", "DF":"5300108", "ES":"3205309", "GO":"5208707", "MA":"2111300", "MT":"5103403", "MS":"5002704", "MG":"3106200", "PA":"1501402", "PB":"2507507", "PR":"4106902", "PE":"2611606", "PI":"2211001", "RJ":"3304557", "RN":"2408102", "RS":"4314902", "RO":"1100205", "RR":"1400100", "SC":"4205407", "SP":"3550308", "SE":"2800308", "TO":"1721000"}
def inspect_csv(path: Path) -> tuple[str, str, list[str]]:
  raw = path.read_bytes()[:131072]
  encoding = next((e for e in ("utf-8-sig", "latin-1", "cp1252") if _can_decode(raw, e)), None)
  if not encoding: raise ValueError(f"encoding não reconhecido: {path}")
  sample = raw.decode(encoding, errors="strict")
  delimiter = csv.Sniffer().sniff(sample, delimiters=";,|").delimiter
  return encoding, delimiter, next(csv.reader([sample.splitlines()[0]], delimiter=delimiter))
def _can_decode(raw: bytes, encoding: str) -> bool:
  try: raw.decode(encoding); return True
  except UnicodeDecodeError: return False
def column_map(columns: list[str]) -> dict[str, str]:
  found = {key: next((name for name in options if name in columns), None) for key, options in ALIASES.items()}
  missing = [k for k, v in found.items() if not v]
  if missing: raise ValueError(f"campos sem equivalente no schema real: {missing}; colunas={columns}")
  return found  # type: ignore[return-value]
def build_official_geo_mapping(path: Path) -> pd.DataFrame:
  """Converte o CSV oficial TSE/IBGE para a chave canônica usada pelo banco."""
  raw = pd.read_csv(path, sep=";", encoding="latin-1", dtype="string")
  required = {"CD_MUNICIPIO_TSE", "CD_MUNICIPIO_IBGE", "NM_MUNICIPIO_IBGE", "SG_UF", "DT_GERACAO"}
  if required - set(raw): raise ValueError(f"Schema inesperado da correspondência: {sorted(required-set(raw))}")
  geo = raw.rename(columns={"CD_MUNICIPIO_TSE":"codigo_tse", "CD_MUNICIPIO_IBGE":"codigo_ibge", "NM_MUNICIPIO_IBGE":"municipio", "SG_UF":"uf"})[["codigo_tse","codigo_ibge","municipio","uf","DT_GERACAO"]].copy()
  geo["is_capital"] = geo.apply(lambda row: row.codigo_ibge == CAPITAIS_IBGE.get(row.uf), axis=1)
  geo["fonte_correspondencia"] = "TSE — Códigos oficiais de UF e municípios segundo o TSE e o IBGE"
  geo["ano_referencia"] = pd.to_datetime(geo["DT_GERACAO"], dayfirst=True, errors="raise").dt.year
  geo = geo.drop(columns="DT_GERACAO")
  if geo.duplicated(["codigo_tse", "uf"]).any() or geo.duplicated("codigo_ibge").any(): raise ValueError("Correspondência oficial sem unicidade.")
  if geo.groupby("uf").is_capital.sum().ne(1).any(): raise ValueError("Lista explícita de capitais não produziu exatamente uma capital por UF.")
  return geo
def main() -> None:
  parser = argparse.ArgumentParser(); parser.add_argument("--anos", nargs="+", type=int, default=[2018, 2022]); parser.add_argument("--uf", action="append", help="Processa apenas CSV(s) da UF."); parser.add_argument("--stage", action="store_true", help="Grava agregações por arquivo em staging."); parser.add_argument("--finalize", action="store_true", help="Une staging e gera o fato final."); parser.add_argument("--inspect-only", action="store_true", help="Extrai e registra schema sem exigir a correspondência TSE↔IBGE."); args = parser.parse_args()
  mappings = DATA / "raw/ibge/municipios_tse_ibge.csv"
  facts, schemas = [], []
  staging = DATA / "normalized/_staging"; staging.mkdir(parents=True, exist_ok=True)
  if args.finalize:
    parts = sorted(part for part in staging.glob("*.parquet") if part.stem.endswith("_BR"))
    if not parts: raise SystemExit("Staging vazio; execute --stage antes de --finalize.")
    facts = [pd.read_parquet(part) for part in parts]
    schema_file = REPORTS / "schemas_tse/schema_tse.json"
    schemas = __import__("json").loads(schema_file.read_text()) if schema_file.exists() else []
  for year in ([] if args.finalize else args.anos):
    print(f"{year}: iniciando leitura", flush=True)
    folder = DATA / f"raw/tse/resultados_finais/{year}"; archive = folder / f"votacao_candidato_munzona_{year}.zip"
    if not archive.exists(): raise SystemExit(f"RAW ausente: {archive}. Execute 01 primeiro.")
    extracted = folder / "extracted"; extracted.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive) as zf:
      names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
      if not names: raise SystemExit(f"Nenhum CSV no ZIP {year}")
      for name in names:
        if not (extracted / name).exists(): zf.extract(name, extracted)
    # O CSV BR já inclui todas as UFs; os CSVs estaduais são subconjuntos e não
    # podem ser combinados a ele, pois duplicariam votos.
    for source in sorted(extracted.rglob("*_BR.csv")):
      if args.uf and source.stem.rsplit("_", 1)[-1] not in set(args.uf): continue
      staging_path = staging / f"{year}_{source.stem}.parquet"
      if args.stage and staging_path.exists(): continue
      encoding, delimiter, cols = inspect_csv(source); mapping = column_map(cols)
      schemas.append({"ano": year, "arquivo": str(source.relative_to(folder)), "encoding": encoding, "delimitador": delimiter, "colunas": cols})
      if args.inspect_only: continue
      source_parts = []
      for frame in pd.read_csv(source, sep=delimiter, encoding=encoding, dtype="string", chunksize=200_000, low_memory=False):
        frame = frame.loc[frame[mapping["cargo"]].str.upper().eq("PRESIDENTE")].copy()
        if frame.empty: continue
        frame = frame.rename(columns={v:k for k,v in mapping.items()})[list(mapping)]
        frame = frame.loc[frame["uf"].ne("ZZ")]
        frame["ano"] = pd.to_numeric(frame["ano"], errors="raise")
        frame["turno"] = pd.to_numeric(frame["turno"], errors="raise")
        frame["votos_nominais"] = pd.to_numeric(frame["votos_nominais"], errors="raise")
        source_parts.append(frame.groupby(["ano","turno","uf","codigo_tse","municipio","candidato_id_tse","numero_candidato","candidato_nome"], as_index=False, dropna=False)["votos_nominais"].sum())
      if source_parts:
        aggregate = pd.concat(source_parts, ignore_index=True).groupby(["ano","turno","uf","codigo_tse","municipio","candidato_id_tse","numero_candidato","candidato_nome"], as_index=False, dropna=False)["votos_nominais"].sum()
        if args.stage: aggregate.to_parquet(staging_path, index=False)
        else: facts.append(aggregate)
    print(f"{year}: leitura concluída", flush=True)
  write_json(REPORTS / "schemas_tse/schema_tse.json", schemas)
  if args.inspect_only:
    print(f"Schemas registrados para {len(schemas)} arquivo(s)."); return
  if args.stage:
    print("Agregações intermediárias gravadas em staging.", flush=True); return
  if not mappings.exists():
    official_zip = DATA / "raw/ibge/municipio_tse_ibge.zip"
    official_csv = DATA / "raw/ibge/extracted/municipio_tse_ibge.csv"
    if not official_zip.exists(): raise SystemExit("Falta a correspondência oficial TSE↔IBGE em data/raw/ibge/municipio_tse_ibge.zip.")
    if not official_csv.exists():
      with zipfile.ZipFile(official_zip) as archive: archive.extract("municipio_tse_ibge.csv", official_csv.parent)
    geo = build_official_geo_mapping(official_csv)
    geo.to_csv(mappings, index=False)
  else:
    geo = pd.read_csv(mappings, dtype={"codigo_tse": "string", "codigo_ibge": "string"})
  required_geo = {"codigo_tse", "codigo_ibge", "municipio", "uf", "is_capital", "fonte_correspondencia", "ano_referencia"}
  if required_geo - set(geo): raise SystemExit(f"Colunas ausentes no mapeamento: {sorted(required_geo-set(geo))}")
  raw = pd.concat(facts, ignore_index=True)
  # O resultado eleitoral omite o zero inicial em parte dos códigos TSE; a
  # correspondência oficial o preserva. Padronizar texto em cinco posições não
  # altera o código geográfico nem usa nomes para o join.
  raw["codigo_tse"] = raw.codigo_tse.astype("string").str.zfill(5)
  geo["codigo_tse"] = geo.codigo_tse.astype("string").str.zfill(5)
  grouped = raw.groupby(["ano","turno","uf","codigo_tse","municipio","candidato_id_tse","numero_candidato","candidato_nome"], as_index=False, dropna=False)["votos_nominais"].sum()
  fact = grouped.merge(geo, on=["codigo_tse","uf"], how="left", validate="many_to_one", suffixes=("", "_dim"))
  if fact.codigo_ibge.isna().any(): raise SystemExit(f"{fact.codigo_ibge.isna().sum()} municípios sem correspondência oficial TSE↔IBGE.")
  fact["votos_validos_municipio"] = fact.groupby(["ano","turno","codigo_ibge"])["votos_nominais"].transform("sum")
  fact["vote_share_validos"] = 100 * fact.votos_nominais / fact.votos_validos_municipio
  raw_hashes = {year: sha256(DATA / f"raw/tse/resultados_finais/{year}/votacao_candidato_munzona_{year}.zip") for year in fact.ano.unique()}
  fact["fonte_dataset"] = "Resultados eleitorais oficiais do TSE"; fact["fonte_url"] = fact.ano.map(lambda y: f"https://dadosabertos.tse.jus.br/dataset/resultados-{y}")
  fact["raw_sha256"] = fact.ano.map(raw_hashes)
  if fact.duplicated(["ano","turno","codigo_ibge","candidato_id_tse"]).any(): raise SystemExit("Fato sem unicidade após agregação.")
  if not fact.vote_share_validos.between(0, 100).all(): raise SystemExit("Percentual fora de 0–100.")
  fact.to_parquet(DATA / "normalized/fact_resultados_presidenciais.parquet", index=False)
  dim = geo.drop_duplicates("codigo_ibge").copy(); dim["numero_municipios_uf"] = dim.groupby("uf")["codigo_ibge"].transform("nunique"); dim["uf_elegivel_modelo"] = dim.numero_municipios_uf.gt(150)
  dim.to_parquet(DATA / "normalized/dim_municipios.parquet", index=False); dim.query("uf_elegivel_modelo").drop_duplicates("uf").to_parquet(DATA / "analytics/ufs_elegiveis_xgboost.parquet", index=False)
  write_json(REPORTS / "validacao_dados/normalizacao.json", {"raw_sha256": {str(year): value for year, value in raw_hashes.items()}, "arquivos_schema": len(schemas), "linhas_fato": len(fact), "unicidade_fato": True, "shares_entre_0_e_100": True, "municipios_por_uf": dim.groupby("uf").codigo_ibge.nunique().to_dict(), "ufs_elegiveis": sorted(dim.loc[dim.uf_elegivel_modelo, "uf"].unique().tolist())})
  print(f"Concluído: {len(fact):,} linhas no fato.", flush=True)
if __name__ == "__main__": main()
