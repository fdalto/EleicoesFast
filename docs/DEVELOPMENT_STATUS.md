# Estado do desenvolvimento — 24/09/2026

## Estado atual

A aplicação possui providers 2022/2026, descoberta EA11, parsers separados, transporte com fila global, persistência IndexedDB, projeções, exportações e mapa. O perfil 2026 Simulation usa a base e o ambiente configuráveis na interface; o perfil Official usa o endpoint oficial.

A interface oferece tanto consulta manual quanto **Modo automático** para os perfis 2026. Ao ser ativado pelo usuário, ele baixa Presidente Brasil/UFs, Governador por UF, inventários EA12 e resultados municipais de Presidente e Governador. A tela apresenta progresso, itens salvos e falhas; desligá-lo impede a criação de novas tarefas, sem cancelar as requisições já em voo.

Depois da carga inicial, o modo automático inicia polling seletivo a cada 60 segundos: EA14 identifica alterações de UF, EA15 direciona municípios e EA20 atualiza somente os resultados necessários. O ciclo compartilha a execução em voo, persiste o estado operacional e recupera versões que falharam em download ou storage.

## Snapshots

O modo automático também registra capturas exportáveis. O snapshot nacional é disparado pelos marcos de apuração presidencial nacional e contém o conjunto completo de resultados armazenados. O snapshot municipal é avaliado ao término de cada bloco municipal e usa a soma de urnas apuradas dos resultados municipais de Presidente; ele registra marcos de 10%, mesmo quando a cobertura municipal ainda é parcial, anotando cobertura, falhas e marcos pulados. Quando o navegador permite, o usuário pode escolher uma pasta de destino; caso contrário, o arquivo é baixado pelo navegador.

Os metadados dessas capturas ficam nas stores `snapshotCaptures` e `municipalSnapshotCaptures`. Os arquivos exportados preservam raw JSON, resultado normalizado e metadados de fonte para auditoria.

## Validação atual

A suíte local possui 71 testes, incluindo sincronização automática e snapshots municipais. A validação local não confirma, por si só, a disponibilidade do ambiente TSE, CORS ou a cadência que o TSE vier a determinar durante a apuração.

## Próximas etapas

1. Implementar replay explicitamente simulado para validar ingestão, persistência e interface ponta a ponta.
2. Adicionar seleção de turno na tela oficial.
3. Evoluir os snapshots para uma base longitudinal derivada, com deltas e métricas entre capturas.
4. Tornar explícita, em uma evolução própria, a escolha entre a extrapolação municipal simples e o método histórico de votos válidos de 2022.
