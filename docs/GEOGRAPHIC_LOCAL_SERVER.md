# API local de histórico geográfico

`scripts/geographic_server.py` é somente uma ponte local, em modo leitura, entre a tabela nacional de seções do primeiro turno de 2026 e o navegador. Ela não consulta o TSE, não recebe votos atuais, não calcula swing e não gera projeções.

```powershell
npm run data:2026:size-bands
npm run geographic:server
npm run dev
```

O servidor atende em `127.0.0.1:8765`. Por padrão, CORS só permite `http://127.0.0.1:5173` e `http://localhost:5173`. Para outra origem local, repita `--cors-origin ORIGEM` ao iniciar o script. Uma página HTTPS publicada pode ser bloqueada pelo navegador ao tentar alcançar o loopback HTTP; este projeto é local neste estágio.

## Contrato

- `GET /health` (ou `/api/health`): estado, referência, contagens e manifesto da base. `?verify=1` executa a verificação SQLite mais cara.
- `POST /api/historico/secoes/resumo`: recebe no máximo 200 chaves de seção e devolve somas históricas por município.

```json
{"referencia":{"ano":2026,"turno":1,"cargo":"PRESIDENTE"},"secoes":[{"uf":"SP","municipio_tse":"00001","zona":1,"secao":2}]}
```

A chave é `UF + código TSE municipal + zona + seção`; duplicatas são descartadas. O retorno soma PT, PL, outros e válidos antes de calcular percentuais. Seções ausentes não contam como votos zero e aparecem em `secoes_nao_encontradas`/`status`.

O site envia apenas essas chaves e cruza a resposta com EA20 no mesmo snapshot. A projeção GeographicSwing e todo o cálculo matemático ficam em TypeScript.
