# Fontes e regras

As fontes eleitorais são os ZIPs oficiais do [TSE 2018](https://dadosabertos.tse.jus.br/dataset/resultados-2018) e [TSE 2022](https://dadosabertos.tse.jus.br/dataset/resultados-2022). Os CSVs são inspecionados antes do uso; encoding, delimitador e colunas são gravados em `reports/schemas_tse/`.

O vínculo TSE↔IBGE precisa ter fonte oficial registrada no próprio CSV de correspondência. Registros `ZZ` são preservados no RAW e excluídos da tabela municipal. Indicadores exigem código IBGE, fonte, referência e data de publicação; valor publicado após a eleição fica `NULL`, sem retroprojeção ou imputação silenciosa.
