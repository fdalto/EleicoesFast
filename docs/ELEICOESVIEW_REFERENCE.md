# Contrato observado no EleicoesView

Análise pontual realizada sobre `references/EleicoesView/processador.py`, `index.html`, `data/2022_{president,governor,senator}.json`, `data/brazil-states.json` e `data/geojs-100-mun.json`. A referência não é dependência de build ou runtime.

## Contrato realmente consumido

O frontend busca `data/<ano>_<cargo>.json`, onde cargo é `president`, `governor` ou `senator`. O objeto raiz é indexado pelo turno (`"1"`, `"2"`). Cada turno contém:

```json
{
  "estados": { "35": { "NOME (PARTIDO)": 123 } },
  "municipios": { "3550308": { "NOME (PARTIDO)": 123 } },
  "meta_nomes": { "3550308": "São Paulo" }
}
```

Estados usam código IBGE de 2 dígitos. Municípios nos arquivos atuais usam código IBGE de 7 dígitos, compatível com `CD_MUN` da malha local. Candidatos são chaves textuais `NOME (PARTIDO)` e o valor é voto absoluto. Percentuais, líder e margem são recalculados pelo frontend a partir desses votos. Ano e cargo estão no nome do arquivo; turno está na raiz.

## Campos efetivamente usados pelo mapa

O mapa precisa do identificador territorial, dicionário candidato→votos e, opcionalmente, nome municipal. O estado é associado a um mapa manual sigla→IBGE. O código municipal é lido de `feature.properties.id || codarea`; porém a malha local examinada usa `CD_MUN`, revelando outra inconsistência na versão atual.

## Inconsistências observadas

- O `processador.py` mostrado grava `{meta, estados, municipios}` sem a camada de turno, mas o frontend exige `json[turn]`.
- O comentário/processador afirma manter código TSE municipal de 5 dígitos, enquanto os JSONs versionados usam IBGE de 7 dígitos.
- A malha local usa `CD_MUN`/`NM_MUN`; o frontend procura `id`/`codarea` e `name`.
- O processador cria `Outros (OUTROS)`; dados versionados também apresentam a chave `Outros` em alguns territórios.

## Decisão de compatibilidade

O formato interno de projeção preserva códigos TSE e IBGE separadamente. A exportação compacta genérica é autocontida e rica em líder, percentuais, margem, apuração e maturidade. Um adaptador opcional produz o contrato efetivamente lido pelo EleicoesView, preferindo IBGE 2/7; territórios sem o código compatível são omitidos com aviso, nunca convertidos pelo comprimento da string. Nenhum motor conhece esse formato.
