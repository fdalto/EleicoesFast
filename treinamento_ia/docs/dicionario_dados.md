# Dicionário de dados

`fact_resultados_presidenciais.parquet` tem uma linha por ano, turno, município e candidato. `votos_validos_municipio` é a soma de todos os candidatos presidenciais; `vote_share_validos` usa somente esse denominador.

`treino_municipio_capital.parquet` tem uma linha por ano, turno e município. Os alvos são `delta_esquerda_municipio_capital` e `delta_direita_municipio_capital`: share final municipal menos share final da capital da mesma UF, ano e turno. Identificadores (`codigo_ibge`, `codigo_tse`, `municipio`) não são features numéricas.

`ufs_elegiveis_xgboost.parquet` aplica exclusivamente `numero_municipios_uf > 150`; as demais UFs permanecem nas dimensões e no fato.
