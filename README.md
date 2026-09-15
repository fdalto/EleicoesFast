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
