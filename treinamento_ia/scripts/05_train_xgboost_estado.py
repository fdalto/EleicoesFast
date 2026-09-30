#!/usr/bin/env python3
"""Treina regressões XGBoost por UF, com seleção interna somente em 2018."""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
import joblib, pandas as pd, xgboost as xgb
from sklearn.model_selection import GroupKFold, ParameterGrid
from sklearn.metrics import mean_absolute_error
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import DATA, ROOT, dataset_hash, write_json
FEATURES = ["turno", "vote_share_esquerda_capital_final", "vote_share_direita_capital_final", "log1p_populacao", "pib_per_capita_relativo_sp", "pct_bolsa_familia", "pct_cadunico", "ideb_anos_finais"]
TARGETS = {"left": "delta_esquerda_municipio_capital", "right": "delta_direita_municipio_capital"}
GRID = list(ParameterGrid({"max_depth":[2,3], "learning_rate":[.05,.1], "n_estimators":[200,400], "min_child_weight":[3], "subsample":[.85], "colsample_bytree":[.85], "reg_lambda":[5,10], "reg_alpha":[.1]}))
def choose(X: pd.DataFrame, y: pd.Series, groups: pd.Series, device: str) -> dict:
  folds = GroupKFold(n_splits=min(5, groups.nunique())); best, best_score = None, float("inf")
  for params in GRID:
    scores=[]
    for tr, va in folds.split(X, y, groups):
      model=xgb.XGBRegressor(objective="reg:squarederror", random_state=42, n_jobs=-1, device=device, **params); model.fit(X.iloc[tr], y.iloc[tr]); scores.append(mean_absolute_error(y.iloc[va], model.predict(X.iloc[va])))
    if sum(scores)/len(scores) < best_score: best, best_score = params, sum(scores)/len(scores)
  return {**best, "cv_mae_2018": best_score}
def main() -> None:
  parser=argparse.ArgumentParser(); parser.add_argument("--uf", action="append", help="UF; repita ou omita para todas"); parser.add_argument("--final", action="store_true", help="Retreina com 2018+2022 depois da avaliação congelada."); parser.add_argument("--device", choices=["cpu", "cuda"], default="cpu", help="Use cuda somente na máquina com GPU compatível."); args=parser.parse_args()
  train=pd.read_parquet(DATA / "analytics/treino_xgboost_estado.parquet"); data_hash=dataset_hash(DATA / "analytics/treino_xgboost_estado.parquet")
  ufs=args.uf or sorted(train.uf.unique())
  for uf in ufs:
    state=train.query("uf == @uf"); learn=state if args.final else state.query("ano == 2018")
    if learn.codigo_ibge.nunique() < 5: print(f"{uf}: amostra insuficiente"); continue
    X=learn[FEATURES]
    for label,target in TARGETS.items():
      params=choose(X, learn[target], learn.codigo_ibge, args.device) if not args.final else {"max_depth":2,"learning_rate":.05,"n_estimators":400,"min_child_weight":3,"subsample":.85,"colsample_bytree":.85,"reg_lambda":5,"reg_alpha":.1}
      model=xgb.XGBRegressor(objective="reg:squarederror", random_state=42, n_jobs=-1, device=args.device, **{k:v for k,v in params.items() if k != "cv_mae_2018"}); model.fit(X, learn[target])
      folder=ROOT / "models/xgboost_estado" / uf; folder.mkdir(parents=True, exist_ok=True); joblib.dump(model, folder / f"{label}.joblib")
      write_json(folder / f"{label}.json", {"uf":uf,"alvo":target,"features":FEATURES,"hiperparametros":params,"seed":42,"device":args.device,"versao_xgboost":xgb.__version__,"anos_treino":sorted(learn.ano.unique().tolist()),"hash_dataset":data_hash,"metricas_validacao":{} })
if __name__ == "__main__": main()
