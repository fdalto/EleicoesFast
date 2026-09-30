# Prompt para GPT Work — baixar Ideb municipal histórico

Preciso obter arquivos oficiais do Inep com resultados do Ideb por **município**, para incorporá-los a um banco de dados de treinamento eleitoral. Execute a busca e o download, sem usar fontes não oficiais.

## Objetivo

Baixar os resultados municipais do **Ideb dos anos finais do ensino fundamental**, preferencialmente para a **rede pública**, nos ciclos:

- **2017**: será a feature temporalmente válida para a eleição de 2018;
- **2019**: será a feature temporalmente válida para a eleição de 2022.

Não usar resultados de 2021, 2023 ou 2025 para essas eleições, pois seriam posteriores aos pleitos e causariam vazamento temporal.

## Fontes permitidas

Use apenas domínios oficiais do Inep/MEC/Governo Federal, preferencialmente:

- https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb
- https://download.inep.gov.br/

Não utilizar Wikipédia, Kaggle, repositórios de terceiros, agregadores ou dados transcritos manualmente.

## Requisitos dos arquivos

1. O resultado precisa estar no nível de **município**, não apenas Brasil, região ou UF.
2. Preservar o arquivo original baixado (ZIP/XLSX/CSV), sem editar ou converter.
3. Confirmar que há um identificador municipal confiável. Prioridade para `codigo_ibge`/código de município IBGE com sete dígitos.
4. Se o arquivo tiver apenas nome de município e UF, não tente associá-lo por aproximação de nome. Informe a limitação.
5. Registrar para cada arquivo: URL oficial, data/hora do download, tamanho, SHA-256, ano do resultado Ideb, etapa de ensino, rede, e data de publicação, se disponível.
6. Validar que o conteúdo corresponde realmente a 2017 ou 2019 e que há resultados de anos finais.
7. Não preencher valores ausentes; municípios sem Ideb divulgado devem permanecer ausentes.

## Destino no projeto

Salvar os originais nestas pastas, criando-as se necessário:

```text
/Users/vitordalto/Desktop/Programacao/EleicoesFast/treinamento_ia/data/raw/ideb/2017/
/Users/vitordalto/Desktop/Programacao/EleicoesFast/treinamento_ia/data/raw/ideb/2019/
```

Criar um `manifest.json` dentro de cada pasta com este formato:

```json
{
  "indicador": "Ideb - anos finais do ensino fundamental",
  "ano_resultado": 2019,
  "rede": "rede pública",
  "nivel_geografico": "município",
  "fonte_nome": "Inep",
  "fonte_url": "URL oficial exata",
  "downloaded_at": "ISO-8601",
  "data_publicacao": "YYYY-MM-DD ou null",
  "arquivo": "nome-do-arquivo-original.ext",
  "bytes": 0,
  "sha256": "...",
  "codigo_ibge_disponivel": true,
  "observacao_metodologica": "..."
}
```

## Entrega esperada

Ao final, informe:

1. URLs oficiais utilizadas;
2. caminhos locais dos arquivos salvos;
3. schema/colunas encontradas;
4. se há código IBGE municipal;
5. quantidade de municípios com Ideb divulgado em cada ano;
6. qualquer limitação ou incompatibilidade encontrada.

Não crie modelo, não faça treinamento e não altere os dados eleitorais existentes. A tarefa é exclusivamente obter e documentar os dados brutos do Ideb.
