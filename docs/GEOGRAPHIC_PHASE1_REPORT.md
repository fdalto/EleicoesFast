# Relatório de entrega — Fase 1 geográfica

Data da validação: 12/10/2026.

## Implementado

- preparador Python offline com descoberta CKAN, retomada, SHA-256, ZIP/CSV streaming, SQLite, partições municipais e manifesto;
- enriquecimento de destinação por um EA20 estadual por UF, cujo diretório é resolvido pelo EA11;
- modelos por seção, histórico, pareamento, estado/evento e manifesto;
- migração Dexie v6 aditiva, importação em lote e upsert idempotente;
- namespace de provider/cache por turno e seleção de turno na interface;
- EA16 descoberto pelo EA11, coleta inicial e incremental no 2º turno, deltas e reconciliação EA16/EA20;
- aba técnica **Seções** com filtros e paginação;
- contratos das Fases 2 e 3, sem implementar regressões ou alterar projeções públicas.

## Base oficial nacional

O pipeline nacional foi executado em 12/10/2026 para eleição `6257`, pleito `3220`, primeiro turno e Presidente:

- 67.858.974 linhas oficiais lidas;
- 3.800.511 linhas presidenciais aceitas;
- 499.206 seções históricas únicas;
- 5.716 municípios/partições;
- 28 territórios: 26 estados, Distrito Federal e exterior;
- 2.835.340 registros nominais de candidatos no SQLite;
- 776.311.914 bytes de partições JSON (740,3 MiB).

O `PRAGMA integrity_check` retornou `ok`. As 5.716 partições existem e conferem simultaneamente em tamanho e SHA-256 com o manifesto nacional; não houve arquivo ausente ou divergente.

## Teste oficial controlado

O recurso oficial do Acre foi descoberto e processado:

- 258.052 linhas lidas;
- 16.145 linhas presidenciais aceitas;
- 2.270 seções, 22 municípios e 129 seções principais com agregadas identificadas;
- eleição 6257, pleito 3220, primeiro turno;
- partições do Acre preservadas dentro da base nacional em `public/data/geographic/partitions/ac` (os ZIPs e o SQLite são artefatos locais de auditoria).

Conferência de Rio Branco (`01392`) contra o EA20 final:

| Métrica | Soma das seções | EA20 | Diferença |
|---|---:|---:|---:|
| Seções | 908 | 908 | 0 |
| Comparecimento | 215.564 | 215.564 | 0 |
| Válidos | 206.854 | 206.854 | 0 |
| Brancos | 3.119 | 3.119 | 0 |
| Nulos | 5.591 | 5.591 | 0 |

O teste detectou 15 votos nominais de Leonardo Avalanche que não constavam como candidatura válida no EA20. Eles permanecem auditáveis, com destinação `NÃO COMPUTADO NO EA20`, e compõem nulos técnicos; não entram em `Outros` nem em válidos.

## Comandos executados

```powershell
python -m unittest scripts.tests.test_prepare_geographic_history
npm test
npm run build
python scripts/prepare_geographic_history.py --uf AC --output tmp/geographic-ac-real --cache tmp/geographic-cache
```

Resultados da implementação: teste Python aprovado; 27 arquivos/82 testes Vitest aprovados; build Vite aprovado. Após a geração nacional, o teste Python foi repetido e o SQLite/manifesto foram validados integralmente. O build emitiu apenas o aviso preexistente de chunk principal acima de 500 kB.

## Pendências e riscos

- A base nacional está montada, mas suas partições somam 740,3 MiB. Antes de versionar ou publicar, é necessário confirmar os limites do Git remoto e do provedor de hospedagem; hospedagem estática separada pode ser mais apropriada.
- Em 12/10/2026 ainda não existem dados reais do segundo turno de 25/10; EA16/EA20 de segundo turno foram cobertos por fixtures e contratos, não por uma apuração inexistente.
- EA18 continua opcional/dirigido e não foi baixado em massa.
- Pareamento automático desta fase implementa `EXACT`/`UNMATCHED`; agregações e mudanças de seção ficam representáveis no modelo, mas exigirão regras auditadas antes de promover `AGGREGATED`, `LOCAL_MATCH` ou `APPROXIMATE`.
- As consultas técnicas por município mantêm a paginação em 50 linhas; os indicadores nacionais completos devem ser calculados por índices/contadores dedicados antes de uma futura tela pública.
