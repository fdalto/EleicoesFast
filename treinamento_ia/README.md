# Banco histórico para XGBoost

Este diretório é independente do aplicativo. O treino usa exclusivamente resultados **finais** oficiais do TSE de 2018 e 2022; `snapshots_2026` é somente insumo operacional futuro e nunca entra em `treino_municipio_capital.parquet`.

## Preparação

```bash
cd treinamento_ia
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python scripts/01_download_tse_resultados.py
```

Antes da normalização, coloque em `data/raw/ibge/municipios_tse_ibge.csv` uma correspondência oficial, auditável, com `codigo_tse,codigo_ibge,municipio,uf,is_capital,fonte_correspondencia,ano_referencia`. Não é permitido inferir código pelo nome.

```bash
python scripts/02_normalize_tse_resultados.py
# Após obter indicadores oficiais e temporalmente válidos:
python scripts/03_build_indicadores.py --input caminho/indicadores_harmonizados.csv
python scripts/04_build_training_dataset.py
python scripts/05_train_xgboost_estado.py
python scripts/06_evaluate_models.py
# somente após congelar a avaliação 2018→2022:
python scripts/05_train_xgboost_estado.py --final
```

## Treino em outra máquina com GPU

Após o banco ser validado, transfira `data/normalized/`, `data/analytics/`, `config/`, `scripts/`, `pipeline/` e `requirements.txt` para a máquina de treino. Nela, crie o ambiente e execute `python scripts/05_train_xgboost_estado.py --device cuda`; mantenha a avaliação temporal 2018→2022 antes de usar `--final`. Não transfira nem use snapshots como dados de treino.

Os arquivos grandes e artefatos gerados são ignorados pelo Git. Os ZIPs RAW são preservados sem modificação, acompanhados de hash SHA-256 e manifesto.
