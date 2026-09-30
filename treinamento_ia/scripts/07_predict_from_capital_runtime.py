#!/usr/bin/env python3
"""Aplica modelos finais a uma capital parcial; não cria dados de treinamento."""
from __future__ import annotations
import argparse, sys
from pathlib import Path
import joblib, pandas as pd
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA, ROOT
FEATURES=["turno","vote_share_esquerda_capital_final","vote_share_direita_capital_final","log1p_populacao","pib_per_capita_relativo_sp","pct_bolsa_familia","pct_cadunico","ideb_anos_finais"]
def main() -> None:
  p=argparse.ArgumentParser(); p.add_argument("--capital-current", type=Path, required=True, help="Parquet com uf, turno, capital_progress, capital_share_esquerda_current, capital_share_direita_current, snapshot_timestamp, snapshot_id"); p.add_argument("--min-capital-progress", type=float, required=True, help="Limiar explícito; não é escolhido silenciosamente."); args=p.parse_args()
  current=pd.read_parquet(args.capital_current); required={"uf","turno","capital_progress","capital_share_esquerda_current","capital_share_direita_current","snapshot_timestamp","snapshot_id"}
  if required-set(current): raise SystemExit(f"Colunas ausentes: {sorted(required-set(current))}")
  current.to_parquet(DATA / "runtime/capital_current.parquet", index=False)
  municipalities=pd.read_parquet(DATA / "analytics/treino_xgboost_estado.parquet").query("ano == 2022").sort_values("ano").drop_duplicates(["uf","codigo_ibge"])
  out=municipalities.merge(current, on=["uf","turno"], how="inner")
  is_capital=out.is_capital.astype("string").str.strip().str.lower().isin(["true", "1", "sim", "s"])
  out=out.loc[~is_capital & out.capital_progress.ge(args.min_capital_progress)].copy()
  out["vote_share_esquerda_capital_final"]=out.capital_share_esquerda_current; out["vote_share_direita_capital_final"]=out.capital_share_direita_current
  for uf, idx in out.groupby("uf").groups.items():
    folder=ROOT / "models/xgboost_estado" / uf
    for side, cap in (("left","capital_share_esquerda_current"),("right","capital_share_direita_current")):
      model=joblib.load(folder/f"{side}.joblib"); out.loc[idx,f"pred_delta_{side}"]=model.predict(out.loc[idx,FEATURES]); out.loc[idx,f"pred_share_{side}_municipio"]=out.loc[idx,cap]+out.loc[idx,f"pred_delta_{side}"]
  cols=["snapshot_id","snapshot_timestamp","uf","codigo_ibge","municipio","capital_progress","capital_share_esquerda_current","capital_share_direita_current","pred_delta_left","pred_delta_right","pred_share_left_municipio","pred_share_right_municipio"]
  out[cols].to_parquet(DATA / "runtime/predictions_2026/predictions.parquet", index=False)
if __name__ == "__main__": main()
