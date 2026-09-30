#!/usr/bin/env python3
"""Avalia 2018→2022 e compara XGBoost ao baseline resultado da capital."""
from __future__ import annotations
import json, sys
from pathlib import Path
import joblib, numpy as np, pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, median_absolute_error, r2_score
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA, ROOT
FEATURES=["turno","vote_share_esquerda_capital_final","vote_share_direita_capital_final","log1p_populacao","pib_per_capita_relativo_sp","pct_bolsa_familia","pct_cadunico","ideb_anos_finais"]
def metrics(y, pred): return {"mae":mean_absolute_error(y,pred),"rmse":mean_squared_error(y,pred)**.5,"medae":median_absolute_error(y,pred),"r2":r2_score(y,pred),"erro_medio_assinado":float(np.mean(pred-y))}
def main() -> None:
  data=pd.read_parquet(DATA / "analytics/treino_xgboost_estado.parquet").query("ano == 2022"); rows=[]
  for uf in sorted(data.uf.unique()):
    subset=data.query("uf == @uf"); folder=ROOT / "models/xgboost_estado" / uf
    for side in ("left","right"):
      target=f"delta_{'esquerda' if side=='left' else 'direita'}_municipio_capital"; share=f"vote_share_{'esquerda' if side=='left' else 'direita'}_municipio_final"; capital=f"vote_share_{'esquerda' if side=='left' else 'direita'}_capital_final"
      if not (folder/f"{side}.joblib").exists(): continue
      predicted=joblib.load(folder/f"{side}.joblib").predict(subset[FEATURES]);
      for turn, ix in subset.groupby("turno").groups.items():
        y=subset.loc[ix,target]; p=predicted[subset.index.get_indexer(ix)]; row={"uf":uf,"turno":turn,"lado":side,"modelo":"xgboost",**metrics(y,p),"mae_share_reconstruido":mean_absolute_error(subset.loc[ix,share],subset.loc[ix,capital]+p),"rmse_share_reconstruido":mean_squared_error(subset.loc[ix,share],subset.loc[ix,capital]+p)**.5}; rows.append(row)
        rows.append({"uf":uf,"turno":turn,"lado":side,"modelo":"baseline_capital",**metrics(y,np.zeros(len(y))),"mae_share_reconstruido":mean_absolute_error(subset.loc[ix,share],subset.loc[ix,capital]),"rmse_share_reconstruido":mean_squared_error(subset.loc[ix,share],subset.loc[ix,capital])**.5})
  pd.DataFrame(rows).to_csv(ROOT / "reports/metricas_modelos/avaliacao_2018_2022.csv", index=False)
if __name__ == "__main__": main()
