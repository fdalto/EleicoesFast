Quero que você projete e implemente a arquitetura inicial de um aplicativo web para coleta, armazenamento local e acompanhamento em tempo quase real dos resultados eleitorais oficiais divulgados pelo Tribunal Superior Eleitoral do Brasil (TSE).

O projeto tem como objetivo principal funcionar nas ELEIÇÕES GERAIS DE 2026.

Entretanto, durante o desenvolvimento, quero utilizar como principal conjunto de testes os dados oficiais das ELEIÇÕES GERAIS DE 2022, pois eles permitem testar exatamente os cargos que serão de interesse em 2026:

* Presidente;
* Governador;
* Senador.

IMPORTANTE:

Não quero ainda construir uma interface sofisticada de divulgação eleitoral nem implementar projeções estatísticas.

A prioridade desta primeira etapa é:

1. descobrir corretamente os arquivos oficiais disponibilizados pelo TSE;
2. baixar esses arquivos;
3. interpretar sua estrutura;
4. armazenar os JSONs originais localmente;
5. normalizar os dados;
6. consultar resultados por UF e município;
7. criar infraestrutura de atualização/polling;
8. detectar alterações de arquivos;
9. atualizar somente o necessário;
10. deixar tudo preparado para os simulados e para a eleição oficial de 2026.

==========================================================

1. TECNOLOGIA E RESTRIÇÕES
   ==========================================================

O aplicativo deve:

* funcionar integralmente no navegador;
* não depender inicialmente de servidor próprio;
* poder ser compilado como site estático;
* poder ser hospedado no GitHub Pages;
* funcionar principalmente em Chrome e Edge;
* preferencialmente usar:

  * TypeScript
  * React

Não criar backend Node.js nesta primeira versão.

Toda a comunicação com o TSE deverá inicialmente ocorrer diretamente pelo navegador utilizando Fetch API.

Criar uma abstração de transporte:

interface TSETransport {
fetchJson(...)
}

Implementação inicial:

DirectTSETransport

Criar Diversos Scripts diferentes com blocos de funções, não colocar tudo no mesmo script. Montar uma arquitetura modular. Separar visual, busca, storage, consumo e teste, criar um arquivo "funcoes.md" com nome de cada função, onde está e qual função ela executa.

==========================================================
2. TESTE DE CORS
================

Antes de desenvolver toda a integração, verificar se os endpoints oficiais do TSE podem ser consumidos diretamente por uma aplicação hospedada em outro domínio, como github.io.

Criar:

CorsDiagnosticService

Ele deverá testar requisições reais ao servidor:

https://resultados.tse.jus.br

Mostrar:

* sucesso;
* HTTP status;
* erro de CORS;
* erro de rede;
* latência;
* tamanho recebido;
* headers relevantes.

NÃO usar:

fetch(..., { mode: "no-cors" })

como solução, porque uma resposta opaque não permitirá interpretar o JSON.

Se CORS impedir o acesso:

* documentar o problema;
* manter toda a arquitetura funcionando;
* manter TSETransport desacoplado;
* não implementar backend complexo nesta etapa.

==========================================================
3. 2022 SERÁ O PRINCIPAL AMBIENTE DE TESTES
===========================================

Utilizar dados oficiais das ELEIÇÕES GERAIS DE 2022.

Quero testar com dados reais dos seguintes cargos:

Presidente:
c0001

Governador:
c0003

Senador:
c0005

Testar:

* primeiro turno;
* resultados nacionais quando aplicáveis;
* resultados estaduais;
* resultados municipais;
* diferentes UFs;
* municípios grandes e pequenos;
* candidatos;
* totais;
* votos válidos;
* brancos;
* nulos;
* eleitorado;
* comparecimento;
* abstenção;
* progresso/totalização quando presente nos arquivos.

NÃO assumir previamente os códigos de eleição/pleito de cada cargo.

Antes de hard-code qualquer identificador:

1. pesquisar a documentação oficial;
2. analisar arquivos reais;
3. descobrir como Presidente, Governador e Senador são identificados;
4. documentar a descoberta.

Podem existir diferenças entre códigos ou arquivos usados para diferentes cargos ou abrangências.

Não criar URLs por tentativa e erro em produção.

==========================================================
4. 2022 E 2026 NÃO DEVEM SER TRATADOS COMO PROTOCOLOS
OBRIGATORIAMENTE IDÊNTICOS
==========================

Este ponto é fundamental.

Os dados de 2022 serão usados para validar:

* significado dos resultados;
* cargos;
* estados;
* municípios;
* candidatos;
* armazenamento;
* parsers;
* normalização;
* interface;
* cálculos básicos;
* cache;
* comportamento da aplicação.

Entretanto, NÃO assumir que o protocolo de distribuição dos arquivos de 2022 é exatamente igual ao protocolo documentado para 2026.

Para 2026, a arquitetura deverá considerar principalmente:

EA11
EA12
EA14
EA15
EA20

Se 2022 utilizar nomes de arquivos, caminhos ou estruturas diferentes, criar adaptadores separados.

Arquitetura desejada:

TSEProvider
|
+-- TSE2022Provider
|
+-- TSE2026Provider

Ambos devem produzir a mesma camada normalizada.

Exemplo:

interface TSEElectionProvider {

```
discoverElection(...)

getStates(...)

getMunicipalities(...)

getStateResult(...)

getMunicipalityResult(...)

getNationalResult(...)

checkUpdates(...)
```

}

A interface da aplicação NÃO deve saber se os dados vieram do protocolo de 2022 ou 2026.

Essa diferença deve permanecer isolada na camada de integração.

==========================================================
5. FONTE 2022
=============

Usar preferencialmente os arquivos JSON oficiais existentes em:

https://resultados.tse.jus.br/oficial/ele2022/

Pesquisar primeiro a estrutura real atualmente disponível.

Não depender exclusivamente do Portal de Dados Abertos em CSV para o funcionamento normal do aplicativo.

O objetivo principal é reproduzir o modelo de consumo dos arquivos utilizados pela infraestrutura de Resultados do TSE.

Entretanto, o Portal de Dados Abertos poderá ser utilizado:

* para validação;
* comparação;
* documentação;
* criação de fixtures;
* confirmação dos resultados finais.

Antes de implementar TSE2022Provider:

1. mapear arquivos disponíveis;
2. identificar configuração;
3. identificar lista de municípios;
4. identificar resultados nacionais;
5. identificar resultados estaduais;
6. identificar resultados municipais;
7. identificar Presidente;
8. identificar Governador;
9. identificar Senador;
10. documentar URLs e padrões encontrados.

Criar:

docs/TSE_2022_PROTOCOL.md

==========================================================
6. 2026 SERÁ O PROTOCOLO-ALVO
=============================

A arquitetura final deverá estar preparada para os simulados e para as eleições oficiais de 2026.

Para 2026 considerar a documentação oficial de:

EA11 - configuração das eleições
EA12 - configuração dos municípios
EA14 - acompanhamento Brasil
EA15 - acompanhamento UF
EA20 - resultado unificado

Criar:

TSE2026Provider

Mesmo que inicialmente ele ainda não consiga executar todos os métodos por falta do ambiente de simulação oficial.

Quando o ambiente de simulado de 2026 estiver disponível, deverá ser possível completar TSE2026Provider sem alterar:

* IndexedDB;
* componentes React;
* normalized models;
* ProjectionEngine futuro;
* telas;
* lógica de persistência.

A troca deverá ser conceitualmente:

provider = TSE2022Provider

para:

provider = TSE2026Provider

==========================================================
7. CARGOS DE INTERESSE
======================

Criar enum ou estrutura equivalente:

ElectionOffice.PRESIDENT
ElectionOffice.GOVERNOR
ElectionOffice.SENATOR

Associar quando apropriado:

PRESIDENT -> c0001
GOVERNOR -> c0003
SENATOR -> c0005

Entretanto, separar:

officeCode

de:

electionId

Nunca assumir:

cargo = eleição.

O provider deverá descobrir ou receber corretamente os identificadores necessários.

==========================================================
8. ABRANGÊNCIAS
===============

Quero trabalhar com:

BRASIL
UF
MUNICÍPIO

Não implementar macro-regiões.

Regra fundamental:

sempre que o TSE disponibilizar diretamente o resultado de determinada abrangência, utilizar esse resultado.

Exemplo:

Brasil
-> resultado oficial Brasil

SP
-> resultado oficial SP

Ribeirão Preto
-> resultado oficial do município

NÃO reconstruir SP somando municípios se existir arquivo estadual oficial.

NÃO reconstruir Brasil somando UFs se existir arquivo nacional oficial.

A soma própria pertencerá futuramente à camada analítica/projeção, nunca à camada de ingestão oficial.

==========================================================
9. DADOS NECESSÁRIOS POR ESTADO
===============================

Para cada UF quero extrair, quando disponíveis:

IDENTIFICAÇÃO

* UF;
* nome;
* eleição;
* pleito;
* turno;
* cargo;
* data/hora de geração do TSE;
* identificador/versionamento do arquivo;
* URL original.

TOTALIZAÇÃO

* total de seções;
* seções totalizadas;
* seções não totalizadas;
* percentual das seções totalizadas;
* eleitorado;
* eleitorado apurado;
* comparecimento;
* abstenção;
* demais indicadores existentes.

VOTAÇÃO

* total de votos;
* votos válidos;
* votos nominais;
* votos brancos;
* votos nulos;
* demais categorias disponibilizadas pelo TSE.

CANDIDATOS

Para cada candidato:

* sequência;
* identificador;
* número;
* nome;
* nome na urna quando aplicável;
* partido;
* federação/coligação quando disponível;
* votos;
* percentual;
* situação;
* eleito;
* segundo turno;
* demais campos úteis.

==========================================================
10. DADOS NECESSÁRIOS POR MUNICÍPIO
===================================

Para cada município quero:

IDENTIFICAÇÃO

* UF;
* código TSE do município;
* código IBGE se disponibilizado;
* nome;
* eleição;
* turno;
* cargo.

TOTALIZAÇÃO

* total de seções;
* seções totalizadas;
* seções não totalizadas;
* percentual totalizado;
* eleitorado;
* comparecimento;
* abstenção.

VOTAÇÃO

* votos totais;
* votos válidos;
* votos brancos;
* votos nulos;
* demais categorias.

CANDIDATOS

Para Presidente, Governador e Senador:

* identificadores;
* número;
* nome;
* partido;
* votos;
* percentual;
* situação;
* demais campos presentes.

==========================================================
11. SENADOR
===========

Criar tratamento específico para Senador.

Não assumir que sua semântica é necessariamente igual à de Presidente/Governador.

A arquitetura deve aceitar eleição com mais de uma vaga e possibilidade de múltiplos votos por eleitor.

Portanto:

não assumir automaticamente:

total de votos do cargo = comparecimento.

Preservar os valores oficiais do TSE.

Criar:

ElectionOfficeRules

Exemplo:

getVoteSemantics(office)

getSeatsAvailable(office)

supportsMultipleVotesPerElector(office)

Os valores devem vir dos dados/documentação sempre que possível.

==========================================================
12. RAW DATA E NORMALIZED DATA
==============================

Manter DUAS CAMADAS.

RAW DATA

Guardar o JSON original exatamente como recebido.

Não remover campos.

Não renomear campos.

Não recalcular valores dentro do raw.

NORMALIZED DATA

Criar representação comum independente de 2022/2026.

Exemplo:

NormalizedElectionResult {
sourceVersion
electionId
pollId
round

```
office
officeCode

scope

uf

municipalityCode
municipalityName

totalSections
countedSections
pendingSections
countedSectionsPercentage

electorate
turnout
abstention

totalVotes
validVotes
blankVotes
nullVotes

candidates[]

sourceUrl
tseGeneratedAt
fetchedAt

sourceId
```

}

Se determinado dado não existir:

usar null.

NUNCA inventar valor.

==========================================================
13. STORAGE
===========

Não usar localStorage para armazenar milhares de JSONs.

Usar:

localStorage

somente para:

* preferências;
* provider selecionado;
* eleição;
* UF selecionada;
* município selecionado;
* polling interval;
* feature flags;
* pequenas configurações.

Utilizar:

IndexedDB

para:

* raw JSONs;
* resultados normalizados;
* municípios;
* eleições;
* candidatos;
* estado de sincronização;
* cache HTTP;
* logs relevantes.

Criar:

StorageAdapter

Implementação:

IndexedDBStorage

Criar stores conceitualmente semelhantes a:

elections
states
municipalities
rawFiles
results
candidates
pollingState

==========================================================
14. METADADOS DOS ARQUIVOS
==========================

Para cada arquivo armazenado registrar quando disponíveis:

* provider;
* election;
* scope;
* cargo;
* UF;
* município;
* URL;
* raw JSON;
* fetchedAt;
* tseGeneratedAt;
* ID/version;
* ETag;
* Last-Modified;
* HTTP status;
* hash opcional;
* tamanho do arquivo;
* última alteração detectada;
* última verificação.

==========================================================
15. POLLING
===========

O intervalo desejado para 2026 será:

5 segundos.

Entretanto, separar:

PollingManager

de:

TSEProvider.

O PollingManager chama:

provider.checkUpdates()

O provider decide como identificar alterações.

==========================================================
16. POLLING DE 2026
===================

Para TSE2026Provider implementar arquitetura hierárquica baseada nos arquivos de acompanhamento.

Fluxo esperado:

A CADA 5 SEGUNDOS:

EA14 Brasil

↓

detectar UFs alteradas

↓

EA15 somente das UFs alteradas

↓

detectar municípios alterados

↓

EA20 somente dos municípios/cargos necessários

Também atualizar:

EA20 estaduais da UF alterada.

Para Presidente:

atualizar EA20 Brasil quando apropriado.

Não baixar todos os milhares de municípios a cada 5 segundos.

==========================================================
17. POLLING EM 2022
===================

Os dados de 2022 atualmente armazenados pelo TSE representam uma eleição passada e provavelmente não sofrerão alterações frequentes.

Portanto eles são adequados para testar:

* Fetch;
* parser;
* IndexedDB;
* cache;
* URL builder;
* estados;
* municípios;
* Presidente;
* Governador;
* Senador;
* concorrência;
* tratamento de erros.

Mas não são suficientes sozinhos para testar uma apuração ocorrendo em tempo real.

Criar então:

ReplayElectionProvider

ou:

MockPollingProvider

capaz de reproduzir snapshots sucessivos.

Estrutura:

snapshot-001.json
snapshot-002.json
snapshot-003.json
...

A cada 5 segundos:

snapshot 1
→ snapshot 2
→ snapshot 3

Assim será possível testar:

* detecção de alteração;
* atualização da tela;
* substituição do raw JSON;
* normalização;
* IndexedDB;
* polling;
* projeção futura.

Usar dados reais de 2022 como base para criar fixtures.

Não alterar os valores dos arquivos oficiais armazenados.

Fixtures simuladas devem estar claramente separadas dos dados oficiais.

==========================================================
18. HTTP CACHE
==============

Implementar suporte a:

ETag
If-None-Match

Last-Modified
If-Modified-Since

HTTP 304 Not Modified

Se receber 304:

* não executar parsing novamente;
* não regravar o raw JSON;
* atualizar somente lastChecked.

Entretanto, não assumir que todos os arquivos históricos de 2022 fornecerão os mesmos headers da infraestrutura de 2026.

A implementação deve tolerar ausência de ETag/Last-Modified.

==========================================================
19. REQUEST SCHEDULER
=====================

Criar:

RequestScheduler

Responsável por:

* fila;
* limite de concorrência;
* requests/segundo;
* prioridade;
* retry;
* exponential backoff;
* jitter;
* prevenção de bursts.

Nunca executar milhares de requests simultaneamente com Promise.all().

Criar configuração conservadora:

maxRequestsPerSecond
maxConcurrentRequests

Não operar próximo aos limites máximos documentados pelo TSE.

==========================================================
20. NÃO GERAR 404 DESNECESSÁRIO
===============================

Não descobrir URLs fazendo brute-force.

Não adivinhar:

* município;
* eleição;
* cargo;
* pleito;
* UF.

Obter esses valores a partir de arquivos de configuração/documentação.

Centralizar criação das URLs.

Criar:

TSE2022UrlBuilder
TSE2026UrlBuilder

Não espalhar concatenação manual de URLs pelos componentes.

==========================================================
21. INTERFACE INICIAL
=====================

Criar inicialmente uma interface técnica.

Página principal:

Dashboard

Mostrar:

PROVIDER

2022 Official
2026 Simulation
2026 Official
Replay

STATUS

* conectado;
* CORS;
* eleição;
* turno;
* polling;
* último fetch;
* requests;
* respostas 200;
* respostas 304;
* erros;
* quantidade de arquivos armazenados;
* uso estimado do IndexedDB.

CONTROLES

[Carregar configuração]

[Executar teste 2022]

[Sincronizar UF]

[Sincronizar município]

[Iniciar polling]

[Pausar polling]

[Atualizar agora]

[Executar Replay]

[Limpar banco]

==========================================================
22. NAVEGAÇÃO DOS RESULTADOS
============================

Criar seletores:

Eleição
Turno
Cargo
UF
Município

Permitir visualizar:

Brasil
Estado
Município

Quando Presidente for selecionado:

Brasil deve estar disponível se houver resultado nacional.

Governador e Senador:

priorizar UF e município conforme disponibilidade oficial.

==========================================================
23. TELA DE DEBUG
=================

Criar abas:

RESUMO

RAW JSON

NORMALIZADO

REQUEST LOG

STORAGE

RESUMO

Mostrar os campos mais relevantes.

RAW JSON

Mostrar exatamente o JSON recebido.

NORMALIZADO

Mostrar o objeto NormalizedElectionResult.

REQUEST LOG

timestamp
provider
URL
tipo
status
latência
bytes
ETag
Last-Modified
resultado

STORAGE

mostrar número de objetos e espaço estimado.

==========================================================
24. TESTE INICIAL DE 2022
=========================

Criar botão:

EXECUTAR TESTE 2022

Não baixar o Brasil inteiro inicialmente.

Executar sequência controlada.

FASE A — PRESIDENTE

1. localizar/configurar 1º turno de 2022;
2. carregar resultado Brasil;
3. carregar resultado de Presidente de SP;
4. carregar resultado de Presidente de alguns municípios de SP;
5. normalizar;
6. armazenar;
7. comparar com raw JSON.

Municípios iniciais sugeridos:

São Paulo
Campinas
Ribeirão Preto
Pitangueiras

Não hard-code seus códigos TSE se puder descobri-los pela configuração oficial.

FASE B — GOVERNADOR

Carregar:

* resultado estadual de SP;
* resultado municipal de alguns municípios;
* candidatos;
* totais;
* percentuais.

FASE C — SENADOR

Fazer o mesmo.

FASE D

Permitir escolher outra UF manualmente.

==========================================================
25. SINCRONIZAÇÃO EM ESCALA
===========================

Após o teste pequeno funcionar, criar:

[Sincronizar todos os municípios de SP]

Somente depois:

[Sincronizar Brasil inteiro]

Nunca iniciar sincronização nacional automaticamente.

Mostrar progresso:

arquivos esperados
baixados
atualizados
304
falhas
faltantes

Permitir cancelar a operação.

==========================================================
26. PREPARAÇÃO PARA 2026
========================

Criar:

ProviderConfig

com:

provider
environment
baseUrl
cycle
electionId
pollId
round

Perfis:

2022_OFFICIAL

2022_REPLAY

2026_SIMULATION

2026_OFFICIAL

Para 2026_SIMULATION:

não inventar URLs antes da publicação oficial.

O sistema deverá permitir configurar a URL assim que o TSE disponibilizar o ambiente.

==========================================================
27. TESTES AUTOMATIZADOS
========================

Criar testes para:

TSE2022Provider
TSE2026Provider
ReplayProvider

URL builders

parsers

normalização

storage

mudança de arquivos

HTTP 304

ETag

Last-Modified

timeout

retry

404

rate limiting

IndexedDB

candidatos

Presidente

Governador

Senador

UF

município

==========================================================
28. FIXTURES
============

Guardar exemplos reais em:

src/test/fixtures/2022/

Separar por:

president/
governor/
senator/

Exemplo:

2022/
president/
br.json
sp.json
sp-municipality-example.json

governor/
sp.json
sp-municipality-example.json

senator/
sp.json
sp-municipality-example.json

Adicionar também:

src/test/fixtures/replay/

Nunca alterar um JSON oficial usado como fixture sem indicar claramente que passou a ser fixture simulada.

==========================================================
29. DOCUMENTAÇÃO
================

Criar:

README.md

docs/
ARCHITECTURE.md
DATA_MODEL.md
TSE_2022_PROTOCOL.md
TSE_2026_PROTOCOL.md
POLLING.md
STORAGE.md

TSE_2022_PROTOCOL.md deverá documentar:

* arquivos encontrados;
* URLs;
* estrutura;
* eleições;
* cargos;
* abrangências;
* diferenças observadas em relação a 2026.

==========================================================
30. OBJETIVOS DE UTILIZAÇÃO FUTURA DOS DADOS
============================================

IMPORTANTE:

NÃO implementar esta parte agora.

Quero apenas garantir que a arquitetura e os dados armazenados permitam desenvolver isso posteriormente.

Em uma segunda etapa quero criar uma interface que apresente simultaneamente:

1. RESULTADO OFICIAL ATUAL

Resultado exatamente como divulgado pelo TSE naquele instante.

2. PROJEÇÃO DO RESULTADO FINAL

O objetivo será tentar corrigir o viés temporal provocado pelas diferentes velocidades de apuração entre estados e municípios.

Durante uma eleição, diferentes municípios e estados podem avançar na totalização em velocidades bastante diferentes.

Consequentemente, simplesmente somar todos os votos já contabilizados naquele momento pode produzir uma fotografia temporária que não representa adequadamente a distribuição territorial do eleitorado.

Exemplo:

uma região em que o candidato A possui votação elevada pode estar com 80% da apuração concluída.

Outra região em que o candidato B possui votação elevada pode estar com apenas 30%.

A soma bruta dos votos apurados poderá então mostrar A na liderança, mesmo que a tendência ponderada das regiões ainda não totalizadas indique resultado final diferente.

No futuro quero desenvolver um:

ProjectionEngine

que utilize separadamente os resultados já observados em cada unidade geográfica.

Por MUNICÍPIO, por exemplo:

* percentual já apurado;
* número de seções totalizadas;
* total de seções;
* eleitorado;
* comparecimento observado;
* votos válidos;
* distribuição percentual de votos por candidato.

Com esses dados poderá ser estimado o resultado final daquele município.

Depois:

MunicipalityProjection[]
↓
StateProjection
↓
NationalProjection

Para Presidente:

agregar projeções municipais/estaduais para gerar projeção nacional.

Para Governador:

agregar projeções municipais dentro da UF.

Para Senador:

agregar projeções municipais respeitando as particularidades do sistema eleitoral do cargo.

IMPORTANTE:

A projeção futura NÃO deverá simplesmente calcular:

percentual nacional atual × eleitorado nacional.

Ela deverá ser ponderada por unidade territorial.

Exemplo:

Município X

50% apurado

Candidato A: 60%
Candidato B: 40%

Município Y

90% apurado

Candidato A: 30%
Candidato B: 70%

O sistema deverá projetar X e Y separadamente, considerando seu peso eleitoral e nível de apuração.

Somente depois os resultados projetados deverão ser somados.

A interface futura deverá mostrar lado a lado:

RESULTADO OFICIAL TSE

versus

PROJEÇÃO ESTATÍSTICA

Toda projeção deverá ser explicitamente identificada como:

ESTIMATIVA / PROJEÇÃO

e nunca apresentada como resultado oficial.

A camada de projeção deverá ser completamente separada da camada de ingestão.

==========================================================
31. PRINCÍPIO DE IMUTABILIDADE DA FONTE
=======================================

Nunca modificar dados oficiais recebidos.

Estrutura:

TSE RAW DATA
|
+--> Normalization
|
+--> Official Result View
|
+--> Projection Engine FUTURO

ProjectionEngine nunca altera:

RawElectionResult

nem:

NormalizedOfficialResult

Ele apenas produz novos objetos derivados.

==========================================================
32. ESTRUTURA SUGERIDA
======================

src/

app/

tse/

```
transport/
  TSETransport.ts
  DirectTSETransport.ts
  ProxyTSETransport.ts

providers/
  TSEElectionProvider.ts
  TSE2022Provider.ts
  TSE2026Provider.ts
  ReplayElectionProvider.ts

2022/
  TSE2022UrlBuilder.ts
  parsers/

2026/
  TSE2026UrlBuilder.ts
  parsers/
    EA11Parser.ts
    EA12Parser.ts
    EA14Parser.ts
    EA15Parser.ts
    EA20Parser.ts

polling/
  PollingManager.ts
  RequestScheduler.ts
  ChangeDetector.ts
```

election/

```
normalized/
  ElectionResult.ts
  CandidateResult.ts
  ElectionOffice.ts

rules/
  ElectionOfficeRules.ts
```

storage/
StorageAdapter.ts
IndexedDBStorage.ts
LocalSettingsStorage.ts

services/
ElectionDiscoveryService.ts
ElectionSyncService.ts

components/

pages/

test/
fixtures/
2022/
replay/

docs/

ARCHITECTURE.md
DATA_MODEL.md
TSE_2022_PROTOCOL.md
TSE_2026_PROTOCOL.md
POLLING.md
STORAGE.md

README.md

==========================================================
33. IMPLEMENTAÇÃO POR FASES
===========================

FASE 1

Scaffold React + TypeScript + Vite.

FASE 2

CORS Diagnostic + TSETransport.

FASE 3

Pesquisar e documentar protocolo real de 2022.

FASE 4

TSE2022Provider.

FASE 5

Presidente 2022.

Testar:

Brasil
UF
município.

FASE 6

Governador 2022.

FASE 7

Senador 2022.

FASE 8

IndexedDB + RAW + Normalized.

FASE 9

Dashboard técnico.

FASE 10

Sincronização de vários municípios.

FASE 11

ReplayProvider para simular atualização a cada 5 segundos.

FASE 12

PollingManager genérico.

FASE 13

Criar estrutura inicial do TSE2026Provider.

FASE 14

GitHub Pages.

FASE 15

Testes e documentação.

Não deixar erros TypeScript pendentes entre fases.

==========================================================
34. PRIMEIRA TAREFA DO CODEX
============================

ANTES DE ESCREVER A APLICAÇÃO COMPLETA:

1. consulte a documentação oficial atual do TSE;
2. confirme que os arquivos JSON de 2022 continuam disponíveis;
3. investigue a estrutura do diretório oficial de 2022;
4. localize arquivos reais de Presidente;
5. localize arquivos reais de Governador;
6. localize arquivos reais de Senador;
7. confirme resultados por UF;
8. confirme resultados por município;
9. identifique arquivos/configurações usados para descobrir municípios;
10. identifique os códigos reais de eleição/pleito;
11. compare a estrutura de 2022 com a documentação de 2026;
12. identifique quais partes podem compartilhar código;
13. identifique quais precisam de adapters separados;
14. teste CORS em ambiente de navegador;
15. apresente a arquitetura proposta.

Somente depois disso comece a implementar.

==========================================================
35. REGRA CONTRA SUPOSIÇÕES
===========================

NÃO inventar nomes de campos do TSE.

NÃO inventar URLs.

NÃO inventar códigos de município.

NÃO inferir que um campo de 2022 terá o mesmo nome em 2026.

Antes de criar qualquer parser:

* consultar especificação;
* analisar JSON real;
* salvar fixture real;
* criar TypeScript type baseado no observado;
* tornar o parser tolerante a campos adicionais.

Se documentação e arquivo real divergirem:

1. preservar o raw JSON;
2. documentar a divergência;
3. tornar parser resiliente;
4. não interromper toda a sincronização por causa de um campo desconhecido.

==========================================================
36. RESULTADO ESPERADO DESTA PRIMEIRA ETAPA
===========================================

Ao final quero conseguir abrir a aplicação no navegador e fazer algo como:

Provider:
2022 Official

Cargo:
Presidente

Abrangência:
SP

Resultado:

Seções totalizadas
Votos válidos
Brancos
Nulos

LULA
votos
percentual

JAIR BOLSONARO
votos
percentual

...

Depois selecionar:

Município:
Ribeirão Preto

e visualizar o resultado oficial daquele município.

Depois trocar:

Cargo:
Governador

e realizar a mesma consulta.

Depois:

Cargo:
Senador.

Os dados deverão estar armazenados localmente em IndexedDB.

A aba RAW JSON deverá permitir verificar exatamente o arquivo utilizado como fonte.

A arquitetura deverá estar pronta para que, quando o ambiente de simulação de 2026 for disponibilizado, possamos substituir:

TSE2022Provider

por:

TSE2026Provider

e começar a testar o polling real de:

EA14
→ EA15
→ EA20

aproximadamente a cada 5 segundos.
