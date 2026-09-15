# Mapa de projeções

O módulo `src/map` é exclusivamente visual. Ele não coleta dados, não recalcula projeções e não altera resultados oficiais. A fonte é uma execução já salva nas tabelas de projeção do IndexedDB.

## Fluxo

Execução salva → adaptador territorial → associação por código IBGE → SVG interativo.

- Projeção por UF: colore os 27 estados e apresenta o detalhamento estadual.
- Projeção municipal: agrega os municípios para a visão estadual e permite Brasil → UF → municípios ou a malha municipal nacional.
- Território sem projeção: cinza neutro.
- Território projetado: cor do partido líder, com intensidade baseada no percentual projetado.

As malhas em `public/maps` foram copiadas dos ativos locais de `references/EleicoesView`. Elas são carregadas sob demanda: a malha municipal não é lida ao abrir as demais áreas do sistema. O desenho e a interação foram reimplementados em React/SVG, sem Leaflet ou dependência de CDN.
