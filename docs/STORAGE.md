# Storage

Dexie/IndexedDB possui as stores legadas `elections`, `states`, `municipalities`, `rawFiles`, `results`, `candidates` e `pollingState`, além de `projectionRuns`, `projectionResults`, `snapshotCaptures`, `municipalSnapshotCaptures` e `candidateIdentities`.

- `rawFiles` guarda o JSON exato, headers de cache e metadados da resposta; `results` guarda a visão normalizada associada à mesma chave.
- `municipalities` mantém o catálogo EA12 indexado por UF e código TSE.
- `pollingState` conserva o estado operacional mais recente do modo automático.
- `projectionRuns` e `projectionResults` guardam execuções derivadas separadas dos resultados oficiais.
- `snapshotCaptures` e `municipalSnapshotCaptures` conservam os metadados das capturas exportadas; os arquivos exportados preservam o conteúdo raw e normalizado.
- `candidateIdentities` guarda associações de apresentação de candidatos.

`localStorage` fica reservado a pequenas preferências.

## Fase geográfica (Dexie v6)

A migração aditiva v6 cria `electionSections`, `sectionHistoricalVotes`, `sectionRoundMatch`, `sectionTallyState`, `sectionTallyEvents` e `geographicImportManifest`. Chaves incluem eleição, pleito, turno, cargo, UF, município, zona e seção. Partições históricas entram por `bulkPut` em lotes; EA16 atualiza o estado e só acrescenta evento quando status/evidência mudam. As stores anteriores não são removidas nem regravadas.
