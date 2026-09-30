#!/usr/bin/env python3
"""Monta treino município↔capital a partir exclusivamente de resultados finais."""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np, pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA
def main() -> None:
  fact = pd.read_parquet(DATA / "normalized/fact_resultados_presidenciais.parquet")
  dim = pd.read_parquet(DATA / "normalized/dim_municipios.parquet")
  labels = pd.read_csv(Path(__file__).resolve().parents[1] / "config/candidatos_referencia.csv", dtype={"numero_candidato":"string"})
  fact["numero_candidato"] = fact.numero_candidato.astype("string"); labels["numero_candidato"] = labels.numero_candidato.astype("string")
  selected = fact.merge(labels, on=["ano","numero_candidato"], how="inner", validate="many_to_one")
  shares = selected.pivot_table(index=["ano","turno","codigo_ibge"], columns="lado", values="vote_share_validos", aggfunc="first").reset_index().rename(columns={"esquerda":"vote_share_esquerda_municipio_final", "direita":"vote_share_direita_municipio_final"})
  base = dim.merge(shares, on="codigo_ibge", how="inner", validate="one_to_many")
  is_capital = base.is_capital.astype("string").str.strip().str.lower().isin(["true", "1", "sim", "s"])
  capital = base.loc[is_capital, ["ano","turno","uf","vote_share_esquerda_municipio_final","vote_share_direita_municipio_final"]].rename(columns={"vote_share_esquerda_municipio_final":"vote_share_esquerda_capital_final", "vote_share_direita_municipio_final":"vote_share_direita_capital_final"})
  if capital.duplicated(["ano","turno","uf"]).any(): raise SystemExit("Mais de uma capital para UF/ano/turno.")
  train = base.merge(capital, on=["ano","turno","uf"], validate="many_to_one")
  indicators_path = DATA / "normalized/dim_indicadores_municipais.parquet"
  if indicators_path.exists():
    ind = pd.read_parquet(indicators_path); ind["codigo_ibge"] = ind.codigo_ibge.astype("string")
    for year in (2018, 2022):
      usable = ind.loc[ind.get(f"elegivel_para_eleicao_{year}", False)].sort_values("data_publicacao").drop_duplicates("codigo_ibge", keep="last")
      fields = [c for c in ["codigo_ibge","populacao","pib_per_capita","familias_bolsa_familia","familias_cadunico","ideb_anos_finais","familias_estimadas"] if c in usable]
      train.loc[train.ano.eq(year), fields[1:]] = train.loc[train.ano.eq(year), ["codigo_ibge"]].merge(usable[fields], on="codigo_ibge", how="left")[fields[1:]].to_numpy()
  for col in ("populacao","pib_per_capita","familias_bolsa_familia","familias_cadunico","familias_estimadas", "ideb_anos_finais"):
    if col not in train: train[col] = np.nan
  train["log1p_populacao"] = np.log1p(train.populacao)
  train_is_capital = train.is_capital.astype("string").str.strip().str.lower().isin(["true", "1", "sim", "s"])
  sp_reference = train.loc[train.uf.eq("SP") & train_is_capital, ["ano", "pib_per_capita"]].drop_duplicates("ano").rename(columns={"pib_per_capita":"pib_per_capita_sp"})
  train = train.merge(sp_reference, on="ano", how="left", validate="many_to_one")
  train["pib_per_capita_relativo_sp"] = (train.pib_per_capita / train.pib_per_capita_sp).clip(upper=1)
  train["pct_bolsa_familia"] = 100 * train.familias_bolsa_familia / train.familias_estimadas; train["pct_cadunico"] = 100 * train.familias_cadunico / train.familias_estimadas
  train["delta_esquerda_municipio_capital"] = train.vote_share_esquerda_municipio_final - train.vote_share_esquerda_capital_final; train["delta_direita_municipio_capital"] = train.vote_share_direita_municipio_final - train.vote_share_direita_capital_final
  if train.duplicated(["ano","turno","codigo_ibge"]).any(): raise SystemExit("Treino sem unicidade.")
  train.to_parquet(DATA / "analytics/treino_municipio_capital.parquet", index=False); train.loc[train.uf_elegivel_modelo].to_parquet(DATA / "analytics/treino_xgboost_estado.parquet", index=False)
if __name__ == "__main__": main()
