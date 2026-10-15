# Simulador local de apuração do TSE

`scripts/tse_apuracao_simulator.py` disponibiliza uma API local compatível com o fluxo que o aplicativo usa para 2026: EA11, EA12, EA14, EA15, EA16 e EA20. Ela serve somente para teste de integração.

Os votos são um subconjunto do histórico do primeiro turno já presente no SQLite. Os candidatos, a eleição e o andamento são artificiais; não representam apuração, candidatos ou resultados oficiais.

## Iniciar

Com o SQLite geográfico preparado:

```powershell
npm run tse:simulator -- --uf AC --municipality 01392 --sections 20 --counted 4
```

O comando sobe em `http://127.0.0.1:8787`. A seleção padrão usa 20 seções de Rio Branco, no Acre, e inicia com nenhuma seção apurada.

Em outro terminal:

```powershell
npm run dev
```

Na aplicação, selecione **2026 Simulation**, **2º turno** e informe `http://127.0.0.1:8787` como base da simulação. A aplicação monta então a rota `http://127.0.0.1:8787/simulado2026/comum/config/ele-c.json` automaticamente.

## Simular avanço

As rotas de controle não pertencem ao contrato do TSE; existem apenas no simulador. Cada mudança incrementa a versão retornada por EA14/EA15, permitindo que o polling detecte uma atualização e então baixe EA20/EA16.

```powershell
# avançar três seções
Invoke-RestMethod -Method Post 'http://127.0.0.1:8787/control/advance?sections=3'

# definir exatamente oito seções apuradas
Invoke-RestMethod -Method Post 'http://127.0.0.1:8787/control/set-counted?count=8'

# voltar a zero
Invoke-RestMethod -Method Post 'http://127.0.0.1:8787/control/reset'
```

`GET /control/status` mostra o universo selecionado, quantidade apurada e versão corrente. O servidor escuta somente em loopback por padrão e não faz nenhuma chamada ao TSE.
