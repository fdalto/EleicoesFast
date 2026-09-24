# Eleições Fast

Aplicação React/TypeScript estática para consultar, preservar em IndexedDB e inspecionar resultados oficiais do TSE. O perfil 2022 está operacional. Os perfis 2026 Simulation/Official fazem bootstrap por EA11, descobrem separadamente eleições federal/estadual e preparam EA12/EA14/EA15/EA20 sem inventar URLs ou IDs.

```bash
npm install
npm run dev
npm test
npm run build
```

O navegador precisa acessar `https://resultados.tse.jus.br`. Use o botão **Diagnóstico CORS**. O CDN observado em 08/08/2026 respondeu com `Access-Control-Allow-Origin: *`.

O provider também implementa o resultado municipal legado EA04. Na interface, “Carregar configuração” valida o EA11 antes de qualquer consulta 2026; a URL de simulação precisa ser informada quando o TSE publicá-la. Enquanto o EA11 não contiver as eleições gerais esperadas, nenhuma EA12/EA20 é solicitada.

Todas as chamadas HTTP passam por uma única fila global configurada para no máximo 80 requisições por segundo e 10 simultâneas. A fila aplica prioridades, deduplica URLs em voo e só repete erros transitórios.

A aba **Projeções** é um módulo separado, acionado manualmente. Ela lê um snapshot imutável dos resultados normalizados no IndexedDB, calcula pelo método territorial simples por UF ou município e grava somente dados derivados em tabelas próprias. Consulte [docs/PROJECTIONS.md](docs/PROJECTIONS.md).

O arquivo `municipios-votos-validos-2022.json`, na raiz, contém a base histórica oficial agregada dos 5.570 municípios para Presidente, Governador e Senador, por turno. A origem, regra de agregação, códigos TSE/IBGE e URLs oficiais estão registrados dentro do próprio JSON. O script reproduzível está em `scripts/build-2022-municipality-valid-votes.mjs`.

A aba **Mapa** visualiza as projeções salvas por UF ou município. A implementação modular e as regras de associação territorial estão descritas em [docs/MAP.md](docs/MAP.md).

## Documentação complementar

A [nota técnica sobre snapshots da apuração eleitoral](nota_tecnica_snapshots_apuracao_eleitoral.pdf) descreve o registro e a preservação das capturas de apuração usadas pelo projeto.

## Snapshots da apuração e pesquisa preditiva

O primeiro turno de 2026 será a base inicial para pesquisa e desenvolvimento de modelos preditivos. Durante a apuração, o projeto registra snapshots sucessivos dos resultados parciais — nos marcos de 10%, 20%, 30% até 100% — para medir como a composição geográfica dos votos muda ao longo do tempo. O gatilho presidencial registra o conjunto completo depois de cada bloco de sincronização. Em paralelo, ao concluir a fila municipal inicial ou um ciclo municipal indicado pelo TSE, o modo automático calcula o percentual agregado de urnas municipais presidenciais apuradas e registra um arquivo municipal a cada marco de 10% atingido. A captura pode ser parcial: ela informa a cobertura baixada, as falhas municipais, os marcos pulados e os totais de urnas e votos válidos. O arquivo municipal contém somente resultados de Presidente por município, com o JSON bruto e a normalização associados a cada fonte.

Cada coleta atual preserva o JSON bruto, a normalização, a origem e os metadados de cobertura no arquivo exportado. Como evolução, a série poderá gerar uma base longitudinal por eleição, turno, cargo, snapshot, município e candidato, além de tabelas derivadas com deltas, votos novos e progresso local, estadual e nacional. Esse histórico permitirá auditoria, reprocessamento e comparação entre o resultado parcial e o resultado final.

O baseline inicial será a extrapolação proporcional: usar o percentual já apurado de cada município como aproximação do seu resultado final. A partir dos dados do primeiro turno de 2026, poderemos medir o erro desse baseline e treinar modelos de correção histórica (swing) e de previsão dos votos remanescentes, incluindo municípios ainda pouco ou nada apurados.

Os modelos futuros poderão combinar o resultado parcial e o ritmo de apuração com relações históricas entre município, capital e estado, além de características geográficas e socioeconômicas. O objetivo é estimar como os votos ainda não totalizados tendem a alterar o resultado final, sem tratar a apuração parcial como uma amostra aleatória do eleitorado. O desenho conceitual completo está na [nota técnica sobre snapshots da apuração eleitoral](nota_tecnica_snapshots_apuracao_eleitoral.pdf).
