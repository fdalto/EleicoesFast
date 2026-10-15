# Base geográfica por seção — Fase 1

## Preparação offline

O script `scripts/prepare_geographic_history.py` usa somente a biblioteca padrão do Python. Ele consulta a API CKAN do Portal de Dados Abertos do TSE, seleciona explicitamente o recurso “Boletim de Urna — Primeiro turno” de cada UF, retoma downloads interrompidos, calcula SHA-256 e processa ZIP/CSV em streaming para SQLite.

Exemplo controlado para Acre:

```powershell
python scripts/prepare_geographic_history.py --uf AC --output public/data/geographic
```

Exemplo nacional (downloads grandes; execute apenas com espaço e tempo disponíveis):

```powershell
python scripts/prepare_geographic_history.py --uf AC,AL,AM,AP,BA,CE,DF,ES,GO,MA,MG,MS,MT,PA,PB,PE,PI,PR,RJ,RN,RO,RR,RS,SC,SE,SP,TO,ZZ --output public/data/geographic
```

## Base nacional gerada

Em 12/10/2026, o comando nacional foi executado para eleição `6257`, pleito `3220`, primeiro turno e cargo Presidente. O manifesto contém 499.206 seções, 5.716 municípios/partições e 28 territórios (26 estados, DF e exterior). As partições somam 776.311.914 bytes. Todos os arquivos foram conferidos por tamanho e SHA-256; o SQLite passou em `PRAGMA integrity_check`.

O cache retomável dos 28 ZIPs permanece em `.cache/geographic`. O banco de auditoria local é `public/data/geographic/canonical.sqlite`; por estar coberto por `*.sqlite` no `.gitignore`, ele não deve ser publicado junto com o site. O conteúdo estático consumido pela aplicação é composto por `manifest.json` e `partitions/`.

Arquivo oficial já baixado:

```powershell
python scripts/prepare_geographic_history.py --uf AC --input C:\dados\bweb_1t_AC_051020261403.zip --output public/data/geographic
```

O comando gera `canonical.sqlite`, `manifest.json` e `partitions/<uf>/<municipio>.json`. O SQLite é artefato local de auditoria e não precisa ser publicado. As partições e o manifesto são arquivos estáticos; a aba **Seções** baixa apenas o município solicitado, confere o hash e faz cache/upsert no IndexedDB.

O parser exige Presidente e primeiro turno. Linhas nominais são separadas de linhas partidárias; PT/PL são derivados do partido oficial da candidatura e todos os candidatos nominais permanecem no JSON. Campos ausentes continuam `null`. A importação é marcada como resultado histórico final e nunca altera o estado corrente do segundo turno.

## Faixas municipais estimadas

Para agrupar municípios sem baixar uma base externa de população, o projeto materializa uma proxy local a partir dos votos válidos históricos: `população estimada = arredondar(votos válidos / 0,56)`. Ela não é população oficial do IBGE e só deve ser usada para estratificar o swing.

Execute após preparar ou substituir o SQLite:

```powershell
npm run data:2026:size-bands
```

As faixas permanecem fixas durante a apuração: E1 até 5 mil habitantes estimados (até 2.800 votos válidos), E2 até 10 mil (até 5.600), E3 até 50 mil (até 28.000), E4 até 200 mil (até 112.000) e E5 acima disso. O script também gera `municipality-history.json`, um agregado leve para o navegador, sem enviar a tabela nacional de seções.

## Operação em 25/10/2026

Selecione **2026 Official**, **2º turno** e ative o modo automático. A aplicação descobre eleição, pleito e diretórios no EA11. O ramo federal consulta EA16 por UF e grava somente transições reais de estado. `da`/`ha` geram `AUXILIARY_AVAILABLE`; a confirmação só ocorre quando a quantidade é conciliável com `countedSections` do EA20 municipal. Divergências ficam `UNCERTAIN` e são revisitadas em ciclos posteriores.

Os providers e snapshots usam namespace por turno (`..._R1`/`..._R2`). EA16 não contém votos nem coordenadas; a aplicação não fabrica nenhum desses dados. EA18 permanece dirigido/opcional nesta fase.

## GitHub Pages e tamanho

O Vite usa caminhos relativos. Publique `manifest.json` e `partitions/` sob `public/data/geographic/`; o build os copia sem incorporar os registros ao bundle JavaScript. Para uma base nacional, verifique previamente o limite do provedor de hospedagem e o tamanho total indicado no manifesto. Se o repositório ficar grande, publique o mesmo layout em hospedagem estática separada e configure o caminho do manifesto no importador.

## Validação

```powershell
npm run test:geographic-python
npm test
npm run build
```

Para validar um município real, some `validVotes` e os candidatos de suas seções no SQLite e compare com o EA20 final municipal. Diferenças devem ser registradas por destinação/anulação/cobertura; não devem ser corrigidas artificialmente.
