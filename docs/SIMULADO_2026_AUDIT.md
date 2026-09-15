# Auditoria do simulado de 15/09/2026

## Conclusão

O ambiente do TSE está acessível diretamente pelo navegador local. O site atual ainda NÃO está pronto para executar o roteiro completo de teste e polling pela interface. Há bloqueios reproduzidos com os arquivos reais, apesar dos 47 testes unitários existentes passarem na etapa anterior.

Documento avaliado: `D:/eleicoesFast/teste.md`. A janela de hoje, 15/09/2026, das 14h às 17h, e os parâmetros do ambiente foram confirmados na [página técnica oficial](https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados).

Esta entrega é uma auditoria e um procedimento. Os problemas do aplicativo abaixo ainda não foram corrigidos. Foi acrescentada somente uma página auxiliar de diagnóstico, independente da interface e do IndexedDB.

## Evidência real — 11h14 de Brasília

Foi executado Fetch no navegador integrado, a partir de `http://127.0.0.1:5173`, com os parsers TypeScript atuais e sete URLs de exemplo publicadas pelo TSE/documento. Todos retornaram HTTP 200:

| Recurso | Resultado observado |
|---|---|
| EA11 | Ciclo ele2026; pleito 17801; federal 21270; estadual 21272; listas de UFs vazias no parser atual |
| EA12 federal | 22 municípios do AC; Acrelândia: TSE 01120, IBGE 1200013 |
| EA14 federal | Parser retornou 29 abrangências, incluindo BR e ZZ |
| EA15 federal AC | 22 municípios lidos |
| Presidente Brasil | 13 candidatos; 99,99% apurado; votos válidos 100.982.116 |
| Governador AC | 9 candidatos; 100% apurado; votos válidos 449.936 |
| Senador Acrelândia | 24 candidatos; 100% apurado; 16.896 votos totais e 8.448 comparecimentos; nv=2 no raw |

Esses números pertencem à janela da manhã e não devem ser usados como expectativa fixa para a tarde. A página auxiliar consulta endpoints diretos conhecidos para separar o teste de CORS/parser dos bloqueios do provider; seu sucesso NÃO significa que as consultas pela interface oficial estejam funcionando.

O navegador expôs Last-Modified, mas não ETag. Uma requisição ao EA11 com If-Modified-Since terminou em `Failed to fetch`; não houve confirmação de HTTP 304 utilizável. Uma consulta OPTIONS separada retornou 200 e permitiu esse header; portanto a causa da falha condicional ainda não foi isolada. Não classificar a leitura normal como bloqueada por CORS. GitHub Pages não foi testado.

## Checklist de compatibilidade

### 1. Descoberta — parcialmente correta, com bloqueio territorial

`EA11Parser.ts` resolve ciclo, pleito, turno, tipos e cargos corretamente, sem selecionar pelo nome. Contudo, o EA11 real declara as eleições com `abr[].cd = br`. O parser remove BR e retorna `federalStates=[]` e `stateStates=[]`. O URL builder então lança `UF AC não pertence à eleição 21272` antes do fetch. É preciso resolver a abrangência nacional consultando o inventário oficial de UFs do EA12 da respectiva eleição; não inventar uma lista a partir de tentativas de URLs.

### 2. Configuração e URLs — endereço do perfil incompatível

O campo da interface alimenta baseUrl, mas App.tsx fixa environment como `simulado`. Configuração correta:

- baseUrl: `https://resultados-sim.tse.jus.br/simulado`
- environment: `simulado2026`
- bootstrap: `https://resultados-sim.tse.jus.br/simulado/simulado2026/comum/config/ele-c.json`

Não basta colar a URL completa no campo atual: ele acrescenta o ambiente errado. Ao introduzir `simulado2026`, ajustar também a identificação do provider: TSE2026Provider atualmente só reconhece `environment === simulado` como simulação, classificando qualquer outro texto como oficial.

Templates e preenchimento de zeros estão corretos: diretório 21270, arquivo e021270, cargo c0001, município 01120. Presidente usa a federal; Governador e Senador usam a estadual.

### 3. Municípios — leitura básica correta

EA12 preserva TSE, IBGE e zeros. O provider valida existência municipal antes de montar o endpoint. O cache EA12 está separado por eleição/UF, embora repita o mesmo arquivo nacional ao consultar várias UFs. No storage, o catálogo municipal usa chave UF:código, sem separar eleição/provider; evitar assumir que os inventários serão sempre idênticos.

### 4. Acompanhamento — parsers parciais, fluxo completo pendente

EA14/EA15 extraem as abrangências e datas, mas EA14 aceita BR como se fosse UF. ZZ representa exterior e precisa de uma política explícita; não deve entrar nas 27 UFs do mapa. O coordenador precisa filtrar abrangências antes de gerar EA15/EA20.

As correções anteriores evitam sobreposição e recuperam falhas HTTP/storage. Entretanto, um EA20 antigo recebido com HTTP 200 ainda é considerado concluído. Não há reconciliação posterior da defasagem EA14/EA15 → EA20. Não comparar IDGs de arquivos distintos: usar versão por URL e informações temporais/andamento apropriadas.

### 5. Resultados — contagens básicas corretas; semântica incompleta

Os parsers reais retornaram candidatos, seções, comparecimento e agregados oficiais. Não somam candidatos para reconstruir votos válidos. Contudo, a normalização não preserva `nv`, `dvt`, `and`, `dt/ht`, nem todos os agregados anulados/denominadores. Esses campos continuam no raw.

Para Senador, os números já preservam votos totais diferentes de comparecimento, mas as duas vagas não chegam ao modelo normalizado. Um candidato com dvt=Anulado aparece com status normalizado nulo, porque o parser lê st/sit e ignora dvt.

O motor estadual projeta todos os candidatos e divide por validVotes, sem distinguir anulados. No simulado, isso pode gerar percentuais agregados incoerentes. Não validar os resultados das projeções como corretos antes de revisar destinação dos votos e denominadores. O método municipal histórico também merece validação separada; os números artificiais do simulado não comprovam precisão eleitoral real.

### 6. Polling de 5 segundos — seguro somente em escopo controlado

O serviço existe, mas não há controles de iniciar/pausar/atualizar ligados ao coordenador na interface. A primeira leitura cria baseline sem coletar resultados; ao primeiro avanço de uma UF, o coordenador consulta todos os municípios ainda desconhecidos dessa UF. Quando todas as UFs avançarem, isso pode gerar milhares de downloads ao longo do ciclo.

A fila limita a 80 req/s e 10 concorrentes por instância. Isso não é uma margem conservadora em relação ao limite publicado de 100 req/s por IP; abas e outros usuários no mesmo IP somam tráfego. Para o ensaio inicial, usar uma UF e um município, teto de 10 req/s e duas requisições simultâneas. Esses valores são uma proposta operacional local, não uma recomendação oficial do TSE.

### 7. Cache HTTP — infraestrutura sem integração completa

DirectTSETransport aceita validadores e 304; App grava alguns headers. Mas TSE2026Provider não reenvia os validadores persistidos e rejeita resultado com data=null. Não existe o caminho completo de 304 → atualizar apenas lastChecked sem reparse/regravação. O teste do navegador também não confirmou que o 304 seja utilizável nesse ambiente.

### 8. Storage — estado atual preservado; histórico oficial não

Raw e normalizado são salvos em transação, em tabelas separadas. Cada nova versão substitui a anterior sob a mesma chave de URL/provider: o banco não preserva a série temporal oficial completa. As projeções possuem execuções próprias, mas os metadados de snapshot referenciam chaves que podem ser sobrescritas. Para comparar estágios, exportar/preservar explicitamente os dados de entrada de cada captura.

### 9. CORS — leitura local aprovada; outros cenários pendentes

Os sete GETs reais funcionaram no navegador. O botão Diagnóstico CORS do aplicativo testa o host de produção, portanto não comprova acesso ao simulado. Deve usar o perfil ativo. Validar novamente no Chrome/Edge utilizado na tarde e no endereço GitHub Pages caso seja o local de execução. A página auxiliar funciona pelo servidor Vite e não integra o build de produção.

### 10. Interface — insuficiente para operação contínua

Há indicação 2026 Simulation, mas faltam rótulo explícito de dados fictícios, horários separados de geração/coleta, andamento final e percentual no resumo. Trocas de perfil/UF/cargo não limpam resultados e listas municipais anteriores, podendo mostrar informação de uma seleção antiga. Evitar essa ambiguidade antes do ensaio.

## Mudanças indispensáveis antes das 14h

1. Corrigir perfil simulado2026 e sua identificação; atualizar diagnóstico para o host ativo.
2. Resolver as UFs pelo EA12 e filtrar BR/ZZ adequadamente no acompanhamento.
3. Testar o provider de ponta a ponta com fixtures reais dos três cargos; corrigir campos nv/dvt/and e os denominadores antes de habilitar projeções.
4. Ligar polling à interface com escopo restrito, pausa, relatório, tratamento de defasagem CDN e limites conservadores.
5. Preservar snapshots exportáveis e mostrar fonte/horários/ambiente na tela.

Podem esperar: sincronização nacional, aperfeiçoamento visual, replay completo, otimização ampla de bundle. A otimização por 304 pode esperar para um ensaio pequeno usando GET normal, desde que não seja anunciada como validada.

## Como executar hoje

### Agora — diagnóstico disponível

1. No diretório `D:/eleicoesFast/EleicoesFast`, executar `npm run dev` (Node/npm precisam estar no PATH).
2. Abrir `/audit-simulado.html` no endereço local informado pelo Vite. Nesta auditoria: `http://127.0.0.1:5173/audit-simulado.html`.
3. Clicar **Verificar endpoints e parsers** uma vez. São sete GETs sequenciais e, quando houver validador acessível, uma tentativa condicional ao EA11. Não há polling nem gravação no IndexedDB.
4. Clicar **Exportar relatório**. Registrar a falha de UF e de cache como evidências, sem repetir consultas em loop.

### À tarde — roteiro após corrigir os bloqueios

- **13h40–13h55:** conferir configuração, build/testes e CORS no navegador de uso; abrir também o [visualizador oficial](https://resultados-sim.tse.jus.br/simulado/simulado2026/app/index.html). Iniciar uma sessão de captura separada da manhã.
- **A partir das 14h:** confirmar geração da nova janela. Zero votos é válido; dados da manhã ainda em cache não comprovam que o reinício da tarde já chegou.
- **Primeiro ensaio:** Presidente Brasil, Governador AC e Senador Acrelândia/AC. Selecionar Acrelândia pelo EA12, confirmar TSE 01120 e IBGE 1200013. Depois acrescentar Presidente AC/Acrelândia e Governador Acrelândia/Senador AC.
- **Vários ciclos:** iniciar em 5 segundos, limitado a AC/município escolhido. Registrar URL, status, IDG por URL, dg/hg, dt/ht, and, seções, votos e horário local. Verificar que pausar para novos disparos e que falha transitória não perde atualização.
- **A cada estágio disponível:** preservar raw e normalizado, antes de calcular/exportar projeções. Escolher capturas em <10%, 10–20%, 20–50%, 50–80%, >80% e 100%, se a progressão permitir. Medir cobertura; não apresentar projeção nacional completa a partir de uma UF.
- **Perto das 17h:** conferir 100% e o andamento final no mesmo recorte. Comparar com o visualizador usando timestamps compatíveis; 100% de seções e atribuição final de eleitos são verificações distintas.
- **Em erro:** guardar evidência antes de repetir. Em 404, parar a URL e conferir construção. Em bloqueio, interromper tráfego e respeitar a janela informada pelo TSE; não insistir continuamente.

Sem essas correções, usar hoje a página auxiliar e o visualizador oficial para verificar endpoints e guardar relatórios. O aplicativo principal ainda não oferece o teste completo descrito no documento.

## Correção aplicada após a auditoria

O perfil da interface agora usa `https://resultados-sim.tse.jus.br/simulado` como base predefinida e `simulado2026` como ambiente. O provider mantém a identificação `2026_SIMULATION`. Para eleições com abrangência BR no EA11, o bootstrap consulta o EA12 de cada eleição e usa suas UFs para validar consultas estaduais/municipais; os municípios são reutilizados em cache. O diagnóstico CORS consulta o EA11 do perfil ativo. Esses bloqueios de consulta foram corrigidos; as demais pendências de polling, projeções e histórico descritas acima permanecem.

Validação: 50 testes passaram; build de produção gerado em `dist`.
