#!/usr/bin/env python3
"""Baixa ZIPs oficiais TSE em streaming e grava manifestos imutáveis."""
from __future__ import annotations
import argparse
import sys
import zipfile
from pathlib import Path
import requests
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA, sha256, utc_now, write_json

SOURCES = {
  2018: ("https://dadosabertos.tse.jus.br/dataset/resultados-2018", "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2018.zip"),
  2022: ("https://dadosabertos.tse.jus.br/dataset/resultados-2022", "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2022.zip"),
}
def main() -> None:
  parser = argparse.ArgumentParser(); parser.add_argument("--adopt-existing", action="store_true", help="Registra explicitamente um ZIP colocado manualmente após validar a estrutura e CRC.")
  args = parser.parse_args()
  for year, (dataset_url, url) in SOURCES.items():
    folder = DATA / "raw/tse/resultados_finais" / str(year); folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"votacao_candidato_munzona_{year}.zip"; manifest = folder / "manifest.json"
    if target.exists():
      actual = {"sha256": sha256(target), "bytes": target.stat().st_size}
      if manifest.exists():
        expected = __import__("json").loads(manifest.read_text())
        if all(expected.get(k) == v for k, v in actual.items()): print(f"{year}: bruto existente validado"); continue
      if not args.adopt_existing:
        raise SystemExit(f"{target}: arquivo existente sem manifesto compatível; use --adopt-existing somente após validar a origem.")
      with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None: raise SystemExit(f"{target}: CRC inválido; não será adotado.")
      write_json(manifest, {"ano": year, "dataset": f"Resultados - {year}", "recurso": "Votação nominal por município e zona", "dataset_url": dataset_url, "download_url": url, "downloaded_at": utc_now(), "download_method": "manual_adoption", **actual})
      print(f"{year}: ZIP manual validado e manifesto criado"); continue
    tmp = target.with_suffix(".zip.part")
    try:
      with requests.get(url, stream=True, timeout=(15, 180), headers={"User-Agent": "EleicoesFast-data-pipeline/1.0 (official-data-download)", "Accept": "application/zip,application/octet-stream,*/*"}) as response:
        response.raise_for_status()
        with tmp.open("xb") as out:
          for chunk in response.iter_content(1024 * 1024):
            if chunk: out.write(chunk)
      tmp.replace(target)
    except Exception:
      tmp.unlink(missing_ok=True); raise
    write_json(manifest, {"ano": year, "dataset": f"Resultados - {year}", "recurso": "Votação nominal por município e zona", "dataset_url": dataset_url, "download_url": url, "downloaded_at": utc_now(), "sha256": sha256(target), "bytes": target.stat().st_size})
    print(f"{year}: {target}")
if __name__ == "__main__": main()
