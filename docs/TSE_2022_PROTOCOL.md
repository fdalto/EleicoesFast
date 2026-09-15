# Protocolo TSE 2022

Pesquisa validada em 08/08/2026 no CDN oficial.

- Pleito do 1º turno: `406`.
- Eleição federal: `544`; cargo Presidente: `c0001`.
- Eleição estadual: `546`; Governador: `c0003`; Senador: `c0005`.
- EA12 nacional confirmado: `https://resultados.tse.jus.br/oficial/ele2022/544/config/mun-e000544-cm.json`. A estrutura observada é `abr[]` (UF) → `mu[]`, com `cd` TSE, `cdi` IBGE, `nm` e zonas `z`.
- Simplificado Brasil: `.../544/dados-simplificados/br/br-c0001-e000544-r.json`.
- Simplificado UF: `.../{eleição}/dados-simplificados/{uf}/{uf}-c{cargo}-e000{eleição}-r.json`.

Foram confirmados HTTP 200 para Presidente BR/SP, Governador SP e Senador SP. Os JSONs observados têm totalização (`s`, `st`, `snt`, `pst`), eleitorado (`e`), comparecimento (`c`), abstenção (`a`), votos (`tv`, `vv`, `vnom`, `vb`, `tvn`) e `cand[]`.

2022 é anterior ao resultado unificado EA20: utiliza EA01 (fixo), EA02 (variável) e EA04/consolidado, além dos simplificados. Por isso não compartilha URL builder/parser com 2026. O padrão municipal validado é `.../{eleição}/dados/{uf}/{uf}{codigoTSE}-c{cargo}-e000{eleição}-v.json`; Ribeirão Preto (`69698`) retornou HTTP 200. O registro `abr[]` com `tpabr=MU` traz totais e votos, e os metadados dos candidatos são combinados pelo número com o resultado estadual.
