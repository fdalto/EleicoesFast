# Fase 1 geográfica — levantamento e plano

## Arquitetura encontrada

O fluxo oficial atual é `React -> TSE2026Provider -> ScheduledTSETransport -> RequestScheduler -> parser -> NormalizedElectionResult -> Dexie`. O bootstrap usa o EA11 e o `DirectoryTemplateResolver`; os caminhos de EA12/EA14/EA15/EA20 vêm exclusivamente de `arq[].dir`. A coleta automática faz carga inicial e depois segue EA14 -> EA15 -> EA20. Todos os requests compartilham a fila de 80 req/s e 10 simultâneos.

O banco `EleicoesFast` está na versão 5. Resultados brutos e normalizados, estados do polling, snapshots e projeções derivadas ocupam stores distintas. As projeções leem snapshots imutáveis e não participam da coleta. O Vite usa `base: './'`, compatível com GitHub Pages.

## Formatos oficiais confirmados em 12/10/2026

- EA16: diretório de tipo `cs` no EA11; arquivo `<uf>-p<pleito com 6 dígitos>-cs.json`. A estrutura publicada é `abr[].mu[].zon[].sec[]`; `ns` é a seção, `nsp` a principal e `da`/`ha` indicam geração do auxiliar. Essas marcas são evidência de disponibilidade, não votos por seção.
- EA20: continua sendo a fonte agregada municipal dos votos correntes. EA16 e EA20 podem chegar à CDN em momentos diferentes.
- BU histórico: o dataset oficial “Resultados - 2026 - Boletim de Urna” foi publicado por UF em ZIP/CSV no Portal de Dados Abertos. O script descobre os recursos pela API CKAN e também aceita arquivos locais.

## Alterações da Fase 1

1. Criar um preparador Python sem dependências externas, com download retomável, SHA-256, SQLite canônico, leitura streaming, exportação por UF/município e manifesto.
2. Adicionar modelos geográficos e uma migração Dexie v6, somente aditiva.
3. Carregar partições estáticas sob demanda e fazer `bulkPut` em lotes.
4. Implementar parser/URL/provider de EA16 e persistir apenas deltas de estado/eventos.
5. Integrar EA16 ao ramo federal do polling; falhas geográficas não interrompem EA14/EA15/EA20.
6. Criar uma tela técnica paginada, com filtros e indicadores de cobertura/reconciliação.
7. Testar parser, chaves/turnos, idempotência do storage, transições de estado e CLI Python.

As Fases 2 e 3 ficam limitadas aos contratos técnicos em documentos próprios; nenhum motor de regressão será ligado às projeções públicas nesta entrega.
