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

## Análise e continuidade — 15/09/2026

A revisão e as próximas etapas estão em [docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md). A infraestrutura de polling possui proteção contra ciclos sobrepostos e recuperação de downloads/gravações com falha; sua integração aos controles da interface ainda está pendente.

Auditoria do simulado de 15/09/2026: [compatibilidade e procedimento para o teste](docs/SIMULADO_2026_AUDIT.md). A página de desenvolvimento `audit-simulado.html` executa um diagnóstico manual limitado aos endpoints públicos de exemplo, sem polling ou gravação no IndexedDB.

O perfil **2026 Simulation** já preenche a base publicada `https://resultados-sim.tse.jus.br/simulado` e utiliza o ambiente `simulado2026`. Eleições declaradas como BR no EA11 obtêm suas UFs pelo EA12 da respectiva eleição, antes das consultas estaduais e municipais.

No perfil 2026, **Modo automático** carrega Presidente e Governador para Brasil, UFs e municípios; depois mantém polling seletivo a cada 10 segundos por EA14 → EA15 → EA20. O indicador ouro mostra a fase, o território atual, progresso e falhas. O modo continua ativo enquanto o usuário navega para Projeções ou Mapa, e pode ser interrompido pelo botão ou pela chave **polling ligado**.

Na área **Resultado oficial**, ao selecionar **Brasil**, o botão **baixar todos estados em fila** consulta os resultados estaduais do cargo/provider atual e salva raw e normalizado no IndexedDB. A fila usa as UFs disponíveis no provider, exclui BR/exterior, processa uma UF por vez pela fila HTTP global e mostra progresso e falhas. O resultado nacional exibido permanece separado. Esses registros alimentam a projeção por UF; o método municipal exige coleta municipal própria.
