Quero implementar uma nova área completamente modular no projeto atual destinada a PROJEÇÕES ELEITORAIS.

O projeto principal já está funcionando e já:

* coleta dados oficiais do TSE;
* armazena os dados;
* normaliza os resultados;
* possui infraestrutura para estados e municípios;
* possui visualização dos resultados oficiais.

NÃO quero refatorar desnecessariamente essas partes.

Antes de modificar o projeto, analise a arquitetura existente e identifique a forma mais limpa de adicionar o novo módulo respeitando os padrões, nomes, tipos, armazenamento e convenções que já existem.

IMPORTANTE:

Não invente antecipadamente nomes de funções, variáveis, classes ou arquivos com base neste prompt.

Primeiro analise o projeto atual.

Depois escolha nomes compatíveis com sua arquitetura existente.

============================================================

1. OBJETIVO DO NOVO MÓDULO
   ============================================================

Quero criar uma área separada do site destinada exclusivamente a:

PROJEÇÕES ELEITORAIS.

Ela deverá utilizar APENAS os dados eleitorais que já foram coletados e normalizados pelo sistema principal.

O módulo de projeção:

NÃO baixa dados diretamente do TSE.

NÃO modifica os dados oficiais.

NÃO interfere no polling.

NÃO modifica JSONs originais.

NÃO modifica resultados oficiais normalizados.

Ele apenas:

1. lê uma fotografia dos dados oficiais disponíveis naquele momento;
2. executa cálculos;
3. gera novos dados derivados;
4. apresenta esses resultados em uma aba própria;
5. permite exportá-los em JSON para uso em visualizações futuras.

============================================================
2. PRINCÍPIO MATEMÁTICO DA PROJEÇÃO
===================================

A projeção tem como objetivo corrigir um problema existente durante a apuração:

Diferentes estados e municípios são totalizados em velocidades diferentes.

Por isso, a simples soma nacional dos votos que já foram apurados pode produzir uma fotografia distorcida.

Exemplo:

São Paulo:

40% das urnas/seções apuradas.

Candidato 1:
50% dos votos válidos.

Candidato 2:
35% dos votos válidos.

Maranhão:

5% das urnas/seções apuradas.

Candidato 1:
25%.

Candidato 2:
65%.

Na soma oficial daquele instante, São Paulo possui peso muito maior porque 40% das suas urnas já entraram no resultado, enquanto apenas 5% do Maranhão entrou.

Isso pode fazer o Candidato 1 aparecer artificialmente à frente no total nacional.

A projeção NÃO deve simplesmente extrapolar o percentual nacional atual.

Ela deve tratar cada unidade geográfica separadamente.

============================================================
3. REGRA CENTRAL
================

Para cada unidade territorial:

ESTADO

ou

MUNICÍPIO

devemos considerar as urnas/seções já apuradas como uma amostra provisória daquela própria unidade.

Exemplo:

São Paulo possui atualmente:

40% apurado.

Candidato 1:
50%.

Candidato 2:
35%.

Se estimamos que São Paulo terminará a eleição com X votos válidos, a projeção será:

Candidato 1:
X × 50%

Candidato 2:
X × 35%

Maranhão:

5% apurado.

Candidato 1:
25%.

Candidato 2:
65%.

Se estimamos que o Maranhão terminará com Y votos válidos:

Candidato 1:
Y × 25%

Candidato 2:
Y × 65%.

Somente DEPOIS de projetar individualmente cada unidade territorial devemos somar os resultados.

============================================================
4. ESTIMATIVA DO TOTAL FINAL DE VOTOS VÁLIDOS
=============================================

O total final de votos válidos de uma unidade ainda não é conhecido durante a apuração.

Na primeira versão do modelo, utilizar como hipótese básica:

votos válidos observados
dividido pela fração de urnas/seções já apuradas.

Exemplo:

40% apurado.

12 milhões de votos válidos observados.

Estimativa simples de votos válidos ao final:

# 12 milhões / 0,40

30 milhões.

Esse valor deverá ser tratado explicitamente como uma ESTIMATIVA.

A seguir, aplicar os percentuais atuais dos candidatos sobre esses votos válidos finais estimados.

Equivalentemente, a projeção dos votos de um candidato poderá ser entendida como:

votos atuais do candidato
dividido pela fração já apurada.

Entretanto, quero que a estrutura preserve separadamente:

* votos válidos observados;
* percentual apurado;
* votos válidos finais estimados;
* percentual observado de cada candidato;
* votos finais projetados de cada candidato.

Isso torna o cálculo auditável.

============================================================
5. HIPÓTESE ESTATÍSTICA
=======================

O primeiro método parte da hipótese simplificada de que:

"a parte já apurada de cada unidade territorial é aproximadamente representativa do resultado final daquela mesma unidade."

Essa hipótese possui limitações.

Por exemplo:

* determinadas zonas podem totalizar antes de outras;
* seções podem ter quantidades diferentes de eleitores;
* municípios podem apresentar heterogeneidade interna;
* a primeira pequena parcela apurada pode não representar adequadamente o conjunto.

Não tente corrigir essas limitações nesta primeira versão.

Quero primeiro implementar exatamente o modelo simples descrito.

Entretanto, a arquitetura deverá permitir substituir posteriormente o método estatístico sem alterar:

* coleta do TSE;
* armazenamento;
* normalização;
* interface oficial;
* sistema de exportação.

============================================================
6. MOTOR DE PROJEÇÃO POR ESTADO
===============================

Quero um primeiro motor cuja unidade básica seja a UF.

Para Presidente:

1. analisar separadamente cada UF;
2. verificar percentual de urnas/seções totalizadas;
3. obter votos válidos observados da UF;
4. estimar votos válidos finais da UF;
5. calcular a distribuição percentual atual dos candidatos na UF;
6. projetar os votos finais de cada candidato naquela UF;
7. repetir para todas as UFs;
8. somar as projeções das UFs;
9. calcular o resultado nacional projetado.

IMPORTANTE:

O peso da UF no resultado projetado não depende de quanto dela já foi apurado.

O peso depende do número estimado de votos válidos que a UF terá ao final.

Assim, uma UF com apenas 5% apurado ainda deverá contribuir aproximadamente com 100% de seu peso eleitoral estimado no resultado projetado.

============================================================
7. GOVERNADOR E SENADOR NO MOTOR POR ESTADO
===========================================

Para Governador:

a projeção estadual baseada em "estados" isoladamente possui pouco interesse, pois o próprio estado é o universo eleitoral.

Nesse caso, o principal método útil posteriormente será por município.

Para Presidente:

o motor por UF deve gerar projeção Brasil.

Para Governador:

o motor municipal deverá gerar projeção da UF.

Para Senador:

o motor municipal deverá gerar projeção da UF.

Respeitar as particularidades dos votos para Senador e os denominadores oficiais disponibilizados pelo TSE.

Não assumir que a semântica do total de votos para Senador é idêntica à de Presidente/Governador.

============================================================
8. MOTOR DE PROJEÇÃO POR MUNICÍPIO
==================================

Quero um segundo motor totalmente independente cuja unidade básica seja o MUNICÍPIO.

Para cada município:

1. verificar percentual de seções/urnas apuradas;
2. obter votos válidos já registrados;
3. estimar o total final de votos válidos;
4. observar a proporção atual de votos de cada candidato;
5. projetar votos finais de cada candidato;
6. preservar o resultado individual desse município.

Depois agregar.

Para Presidente:

Municípios
→ Estados
→ Brasil.

Para Governador:

Municípios da UF
→ resultado estadual projetado.

Para Senador:

Municípios da UF
→ resultado estadual projetado.

O resultado do motor municipal NÃO deve utilizar como entrada a projeção do motor estadual.

Os dois métodos devem ser independentes.

Assim futuramente poderemos comparar:

resultado oficial atual

versus

projeção por estados

versus

projeção por municípios.

============================================================
9. INDEPENDÊNCIA ENTRE OS DOIS MÉTODOS
======================================

É um requisito importante.

MOTOR POR ESTADO

utiliza diretamente os resultados oficiais por UF.

MOTOR POR MUNICÍPIO

utiliza diretamente os resultados oficiais de cada município.

Não fazer:

municípios
→ criar estado projetado
→ alimentar motor estadual.

Isso confundiria os métodos.

Ambos devem partir da fonte oficial normalizada e produzir resultados próprios.

============================================================
10. INDICADOR DE MATURIDADE DA AMOSTRA
======================================

Quero uma classificação simples baseada no percentual de urnas/seções apuradas.

Essa classificação NÃO representa um intervalo de confiança estatístico formal.

É apenas um indicador visual de maturidade da amostra.

MENOS DE 10%

Mostrar destaque forte:

"PROJEÇÃO MUITO PRELIMINAR"

e aviso equivalente a:

"Menos de 10% das urnas/seções desta unidade foram apuradas. A amostra ainda é pequena e a projeção pode apresentar grande variação."

ENTRE 10% E 20%

Mostrar:

"PROJEÇÃO PRELIMINAR"

A projeção já possui mais informação, mas ainda deve ser interpretada com cautela.

20% OU MAIS

Mostrar:

"MAIOR MATURIDADE DA AMOSTRA"

Mensagem:

"Com mais de 20% das urnas/seções apuradas, a projeção tende a apresentar maior estabilidade, embora ainda possa sofrer alterações."

IMPORTANTE:

Não apresentar:

10%
ou
20%

como limites científicos comprovados de precisão.

São limiares operacionais definidos para esta aplicação.

============================================================
11. UNIDADES COM ZERO DE APURAÇÃO
=================================

Uma unidade com:

0% de urnas/seções apuradas

não possui amostra eleitoral atual.

Portanto NÃO inventar percentual de candidato.

Não assumir resultado nacional.

Não utilizar automaticamente eleição anterior.

Não utilizar automaticamente resultado estadual.

Marcar a unidade como:

SEM DADOS SUFICIENTES PARA PROJEÇÃO.

O resultado agregado deve informar claramente:

* quantas unidades puderam ser projetadas;
* quantas ainda estão sem dados;
* qual parcela territorial/eleitoral estimada ainda não possui projeção.

Se houver unidades relevantes ainda sem nenhuma apuração, o resultado global deverá ser identificado como:

PROJEÇÃO PARCIAL.

Não esconder essa limitação.

============================================================
12. COBERTURA DA PROJEÇÃO
=========================

Quero separar dois conceitos:

APURAÇÃO OFICIAL

e

COBERTURA DA PROJEÇÃO.

Exemplo:

Brasil pode estar com:

35% das seções oficialmente apuradas.

Mas o motor por estados pode já possuir algum resultado em:

27 de 27 UFs.

Nesse caso existe ampla cobertura territorial para realizar a projeção.

No motor municipal pode haver:

5.200 municípios com alguma apuração;

370 ainda sem qualquer dado.

Quero que o sistema informe isso.

Exemplos conceituais de indicadores:

* unidades totais;
* unidades projetáveis;
* unidades ainda zeradas;
* percentual aproximado do peso eleitoral coberto;
* menor percentual apurado;
* mediana de apuração;
* percentual ponderado de apuração.

Não confundir cobertura territorial com percentual oficial de apuração.

============================================================
13. RESULTADOS INTERMEDIÁRIOS
=============================

Não quero guardar apenas:

"Candidato 1 terá 52,3% nacionalmente."

Quero preservar a decomposição completa que levou ao resultado.

Para cada UF no motor estadual preservar conceitualmente:

* identificação territorial;
* percentual apurado;
* total de seções;
* seções apuradas;
* votos válidos observados;
* votos válidos finais estimados;
* candidatos;
* votos observados por candidato;
* percentual observado;
* votos projetados;
* percentual projetado;
* classificação da maturidade da amostra;
* avisos;
* timestamp da fonte.

Para cada município no motor municipal preservar as mesmas informações.

============================================================
14. AUDITABILIDADE
==================

Preciso conseguir selecionar, por exemplo:

MARANHÃO

e compreender:

"Por que o sistema está projetando X votos para o candidato?"

A resposta deve poder ser reconstruída pelos dados exportados:

5% apurado;

votos válidos observados;

estimativa de votos válidos finais;

Candidato 1 = 25%;

Candidato 2 = 65%;

cálculo resultante.

Não criar um resultado agregado que perca os cálculos intermediários.

============================================================
15. SNAPSHOT
============

Cada cálculo deverá utilizar uma fotografia consistente dos dados.

Exemplo:

18:03:25

A projeção iniciada nesse momento deverá usar o conjunto de dados correspondente àquela fotografia.

Se o TSE atualizar arquivos enquanto a projeção está sendo calculada:

não substituir dados no meio daquela execução.

A atualização deverá ser utilizada na próxima execução.

Isso será importante principalmente no motor municipal, que poderá processar milhares de unidades.

============================================================
16. FREQUÊNCIA
==============

Não acoplar a projeção ao polling de 5 segundos do TSE.

A coleta oficial deve sempre ter prioridade.

Nesta primeira versão permitir:

* projeção manual;
* atualização manual.

Preparar a arquitetura para futuramente permitir projeção automática em intervalo configurável.

Por exemplo:

a cada 15 segundos;
a cada 30 segundos;
ou após quantidade relevante de atualizações.

Não executar cálculos pesados indiscriminadamente após cada JSON individual recebido.

============================================================
17. PÁGINA DE PROJEÇÃO
======================

Adicionar uma nova área/aba ao site sem alterar a tela oficial existente.

A navegação deverá permitir distinguir claramente:

RESULTADO OFICIAL

PROJEÇÕES

DEBUG

Na área de projeções quero duas subabas principais:

POR ESTADO

POR MUNICÍPIO.

============================================================
18. ABA "POR ESTADO"
====================

Principalmente para Presidente.

Mostrar:

RESULTADO OFICIAL NACIONAL ATUAL

e ao lado:

RESULTADO NACIONAL PROJETADO POR UF.

Para cada candidato:

* votos oficiais atuais;
* percentual oficial atual;
* votos finais projetados;
* percentual final projetado;
* diferença entre percentual oficial e projetado.

Mostrar também tabela das UFs.

Para cada UF:

* percentual apurado;
* classificação da maturidade;
* votos válidos observados;
* votos válidos finais estimados;
* percentual atual de cada candidato;
* votos projetados;
* impacto daquela UF na projeção nacional.

Permitir ordenar por:

* percentual apurado;
* quantidade estimada de votos;
* diferença entre resultado observado e projeção nacional;
* impacto no resultado.

============================================================
19. ABA "POR MUNICÍPIO"
=======================

Mostrar resultado projetado utilizando municípios como unidades independentes.

Para Presidente:

mostrar:

projeção Brasil

com possibilidade de:

Brasil
→ Estado
→ Municípios.

Para Governador/Senador:

mostrar:

UF
→ Municípios.

Permitir identificar rapidamente municípios:

* ainda sem apuração;
* abaixo de 10%;
* entre 10% e 20%;
* acima de 20%;
* completamente apurados.

============================================================
20. COMPARAÇÃO DOS MÉTODOS
==========================

Para Presidente, quando houver dados suficientes, quero poder mostrar simultaneamente:

RESULTADO OFICIAL TSE

PROJEÇÃO POR ESTADOS

PROJEÇÃO POR MUNICÍPIOS.

Os motores devem calcular separadamente.

A interface deve permitir comparar:

* votos;
* percentual;
* candidato líder;
* diferença entre candidatos;
* diferença entre os métodos.

============================================================
21. DADOS OFICIAIS NÃO DEVEM SER ALTERADOS
==========================================

Esse requisito é absoluto.

A projeção deve consumir os dados oficiais somente para leitura.

Não:

* alterar votos oficiais;
* substituir votos válidos;
* inserir campos de projeção nos objetos oficiais;
* modificar raw JSON;
* modificar timestamps oficiais;
* modificar resultados normalizados.

Toda projeção deve resultar em um novo conjunto de dados derivados.

============================================================
22. ARMAZENAMENTO DOS RESULTADOS DERIVADOS
==========================================

Analise a arquitetura de armazenamento existente.

As projeções devem permanecer logicamente separadas dos:

* JSONs brutos do TSE;
* resultados oficiais normalizados.

Quero poder futuramente salvar várias execuções.

Exemplo conceitual:

18:00
18:05
18:10
18:15

e depois comparar a evolução da projeção.

Cada execução deverá preservar:

* momento;
* eleição;
* turno;
* cargo;
* método;
* cobertura;
* snapshot utilizado;
* parâmetros;
* resultado agregado;
* resultados territoriais detalhados.

============================================================
23. EXPORTAÇÃO — REQUISITO IMPORTANTE
=====================================

Quero que o módulo tenha uma camada independente de EXPORTAÇÃO.

O motor estatístico não deve conhecer detalhes da futura interface gráfica.

Quero produzir dois tipos de saída.

TIPO A — EXPORTAÇÃO COMPLETA / AUDITÁVEL

Deve preservar toda a informação da execução:

* metadados;
* timestamp;
* eleição;
* turno;
* cargo;
* método utilizado;
* cobertura;
* avisos;
* resultado nacional/estadual agregado;
* todos os resultados por UF;
* todos os resultados por município quando aplicável;
* valores observados;
* valores projetados;
* nível de apuração;
* classificação da maturidade;
* dados necessários para reproduzir o cálculo.

Esse será nosso formato interno e de pesquisa.

Ele deve ser independente de qualquer visualizador.

TIPO B — EXPORTAÇÃO COMPACTA PARA VISUALIZAÇÃO

Quero também gerar uma representação muito mais simples destinada a mapas e interfaces.

Use como REFERÊNCIA CONCEITUAL o projeto externo EleicoesView, especialmente:

* o script de processamento;
* a pasta de dados;
* a forma como o frontend lê os JSONs;
* a organização territorial por estados e municípios.

Se o repositório estiver disponível dentro da pasta de referências do projeto, examine-o diretamente.

NÃO criar dependência de runtime com o projeto externo.

NÃO importar código diretamente dele.

NÃO alterar o repositório externo.

Ele serve apenas como referência.

============================================================
23. REPOSITÓRIO ELEICOESVIEW JÁ DISPONÍVEL LOCALMENTE
=====================================================

O projeto externo EleicoesView JÁ FOI CLONADO e está disponível dentro deste projeto em:

./references/EleicoesView/

Esse diretório é apenas uma REFERÊNCIA EXTERNA.

Ele não faz parte do código-fonte principal desta aplicação e está intencionalmente separado.

IMPORTANTE:

* NÃO fazer novo clone do repositório;
* NÃO procurar outra cópia na internet se a versão local for suficiente;
* NÃO mover esse diretório;
* NÃO modificar seus arquivos;
* NÃO modificar seu .git;
* NÃO adicionar dependências do projeto principal apontando para esse diretório;
* NÃO criar imports em runtime a partir de ./references/EleicoesView/;
* NÃO copiar grandes partes do projeto sem necessidade;
* NÃO transformar EleicoesView em submódulo ou dependência do projeto.

O aplicativo principal deve continuar funcionando normalmente mesmo que:

./references/

seja completamente removido.

O EleicoesView serve exclusivamente como documentação prática e referência para compreender:

* o formato dos arquivos usados pelo visualizador;
* como resultados são organizados territorialmente;
* como estados são identificados;
* como municípios são identificados;
* como candidatos e votos são representados;
* como o frontend lê os JSONs;
* como os mapas utilizam esses dados.

============================================================
24. USO EFICIENTE DO REPOSITÓRIO DE REFERÊNCIA
==============================================

Quero evitar gasto desnecessário de contexto/tokens analisando repetidamente um projeto externo inteiro.

Portanto, NÃO faça uma análise ampla de todo:

./references/EleicoesView/

em cada etapa.

Faça uma investigação direcionada.

Comece identificando somente os arquivos relevantes para a integração que estamos desenvolvendo.

Prioridade inicial:

./references/EleicoesView/processador.py

e os arquivos diretamente envolvidos em:

* leitura dos JSONs produzidos pelo processador;
* estrutura da pasta data;
* seleção de eleição;
* seleção de turno;
* seleção de cargo;
* mapas de estados;
* mapas de municípios.

Não examine arquivos não relacionados sem necessidade.

============================================================
25. CRIAR UM RESUMO LOCAL DA REFERÊNCIA
=======================================

Na primeira análise do EleicoesView:

1. examine os arquivos necessários;
2. descubra o contrato de dados utilizado pelo visualizador;
3. documente o que foi encontrado dentro do NOSSO projeto.

Crie uma documentação curta, por exemplo dentro da documentação já existente do projeto, contendo:

* quais arquivos do EleicoesView foram analisados;
* quais JSONs ele espera;
* estrutura desses JSONs;
* identificadores territoriais utilizados;
* campos necessários para os mapas;
* diferenças ou inconsistências encontradas;
* decisões de compatibilidade adotadas no nosso projeto.

Depois dessa documentação ser criada, utilize-a como referência principal.

NÃO volte a analisar todo o EleicoesView a cada nova implementação, salvo quando houver uma dúvida concreta que a documentação local não responda.

A intenção é transformar:

./references/EleicoesView/

em uma fonte consultada pontualmente,

e não em uma parte constantemente carregada do contexto de desenvolvimento.

============================================================
26. SEPARAÇÃO EM MÓDULOS PARA REDUZIR COMPLEXIDADE
==================================================

Quero manter a implementação das projeções dividida em módulos pequenos e independentes.

Evite criar arquivos enormes contendo:

* leitura dos resultados;
* projeção;
* agregação;
* exportação;
* interface;
* adaptação para EleicoesView

no mesmo local.

As responsabilidades conceituais devem permanecer separadas:

DADOS OFICIAIS NORMALIZADOS
↓
MOTOR DE PROJEÇÃO
↓
RESULTADO DERIVADO
↓
EXPORTAÇÃO
↓
VISUALIZAÇÃO

O motor de projeção NÃO deve conhecer EleicoesView.

O adaptador de exportação para visualizadores é que poderá conhecer o formato necessário para integração visual.

============================================================
27. DOIS MOTORES DE PROJEÇÃO INDEPENDENTES
==========================================

Manter também separados:

MOTOR POR ESTADOS

e

MOTOR POR MUNICÍPIOS.

Eles podem compartilhar pequenas rotinas matemáticas genéricas quando realmente fizer sentido, mas um não deve depender do resultado calculado pelo outro.

O motor por estados deverá trabalhar diretamente com os dados oficiais normalizados por UF.

O motor por municípios deverá trabalhar diretamente com os dados oficiais normalizados por município.

Isso é importante tanto para a validade da comparação quanto para manter o código pequeno e compreensível.

============================================================
28. PROCESSAMENTO ORIENTADO À TAREFA
====================================

Ao executar esta implementação, trabalhe de maneira incremental.

Não carregue nem analise todos os módulos do projeto se a tarefa atual depende apenas de uma pequena parte.

Por exemplo:

Para desenvolver o motor por estados, examine somente:

* modelo oficial normalizado;
* armazenamento necessário;
* dados de UF;
* código novo do motor estadual;
* testes relacionados.

Não é necessário estudar nesse momento toda a interface municipal ou todo o EleicoesView.

Para desenvolver o motor municipal, examine somente:

* modelo municipal;
* armazenamento relacionado;
* motor municipal;
* agregação;
* testes relacionados.

Para desenvolver o adaptador visual:

somente então examine:

./references/EleicoesView/

e nossa documentação de compatibilidade.

============================================================
29. NÃO DUPLICAR CONTEXTO
=========================

Quando já existir documentação interna explicando uma parte da arquitetura, prefira consultá-la em vez de reexaminar dezenas de arquivos.

Se durante a primeira análise você descobrir o contrato de dados do EleicoesView, registre-o.

Nas tarefas seguintes:

NÃO faça novamente:

"analisar todo o EleicoesView"

sem uma razão específica.

Consulte somente os arquivos necessários para responder uma dúvida ainda não documentada.

============================================================
30. ELEICOESVIEW COMO ADAPTADOR OPCIONAL
========================================

Nossa arquitetura deverá ser:

Projection Result interno
|
+---- Exportação completa/auditável
|
+---- Exportação compacta genérica
|
+---- Adaptador compatível com EleicoesView

O formato interno do motor NÃO deve ser desenhado em função do EleicoesView.

O adaptador EleicoesView deve ficar na periferia da arquitetura.

Assim, futuramente poderemos:

* substituir EleicoesView;
* desenvolver nosso próprio mapa;
* trocar biblioteca de mapas;
* mudar o formato do frontend;

sem alterar os motores de projeção.

============================================================
31. PRIMEIRA ANÁLISE DO ELEICOESVIEW
====================================

Quando chegar especificamente à etapa de integração visual:

analise primeiro:

./references/EleicoesView/processador.py

Depois descubra quais arquivos do frontend realmente consomem os JSONs gerados por esse script.

Não faça leitura indiscriminada do repositório.

Responda especificamente:

1. Qual estrutura JSON é produzida?

2. Quais arquivos são gravados na pasta data?

3. Como eleição, turno e cargo são representados?

4. Como uma UF é identificada?

5. Como um município é identificado?

6. Como candidatos são representados?

7. Quais campos o mapa realmente utiliza?

8. O frontend utiliza votos absolutos, percentuais ou ambos?

9. Existe alguma incompatibilidade entre o que processador.py produz e o que o frontend atual espera?

10. Qual é a menor camada de adaptação necessária para alimentar esse visualizador com nossas projeções?

Depois registre essas conclusões na documentação do nosso projeto.

============================================================
32. IMPORTANTE SOBRE O GIT
==========================

O diretório:

./references/

é externo ao projeto principal e deve permanecer ignorado pelo Git do projeto principal.

Não altere essa decisão.

Não execute comandos que façam:

./references/EleicoesView/

ser incluído no commit principal.

Também não é necessário modificar o repositório de referência.

Ele serve apenas como material de consulta.

============================================================
33. OBJETIVO DE MODULARIDADE
============================

A arquitetura final deve permitir que cada uma destas partes seja compreendida e modificada isoladamente:

1. ingestão TSE;

2. normalização oficial;

3. projeção por estado;

4. projeção por município;

5. armazenamento das projeções;

6. exportação completa;

7. exportação compacta;

8. adaptador EleicoesView;

9. interface de projeções.

Ao trabalhar em uma dessas áreas, evite carregar ou modificar as demais sem necessidade.

Essa separação é desejada tanto para manutenção do projeto quanto para reduzir contexto e complexidade durante futuras sessões de desenvolvimento com agentes de código.

============================================================
34. PRINCÍPIO FINAL PARA O REPOSITÓRIO DE REFERÊNCIA
====================================================

Considere:

./references/EleicoesView/

como se fosse uma documentação externa local.

Pode:

* ler;
* pesquisar;
* comparar;
* compreender contratos de dados.

Não pode:

* virar dependência;
* ser importado;
* ser modificado;
* ser necessário para o build;
* ser necessário para a execução;
* determinar a arquitetura interna do motor de projeção.

O fluxo correto deve ser:

EleicoesView
↓
entender formato visual
↓
documentar contrato
↓
criar adaptador isolado

e NÃO:

EleicoesView
↓
modelar todo nosso projeto ao redor dele.


============================================================
24. FORMATO VISUAL COMPACTO
===========================

A exportação compacta deve ser fácil de consumir por um site estático.

Conceitualmente quero algo equivalente a:

ELEIÇÃO / TURNO / CARGO

→ metadados

→ estados
→ estado
→ candidato
→ votos projetados

→ municípios
→ município
→ candidato
→ votos projetados

Não copie cegamente o formato do projeto de referência.

Primeiro examine como sua versão atual funciona.

Crie uma camada adaptadora.

O formato interno completo das projeções deve continuar independente.

============================================================
25. IDENTIFICADORES TERRITORIAIS
================================

Este ponto é importante para mapas.

Quero preservar, sempre que disponíveis:

ESTADO:

* sigla UF;
* código IBGE da UF.

MUNICÍPIO:

* código TSE;
* código IBGE;
* nome;
* UF.

Não descartar nenhum dos dois códigos municipais.

Isso permitirá adaptar os resultados tanto às fontes do TSE quanto a GeoJSONs baseados no IBGE.

A exportação destinada ao mapa deverá utilizar um identificador compatível com a malha geográfica que efetivamente estiver sendo usada pelo visualizador.

Não fazer conversões frágeis baseadas apenas em comprimento de string.

============================================================
26. ELEICOESVIEW COMO REFERÊNCIA, NÃO COMO CONTRATO
===================================================

Analise o projeto EleicoesView existente na pasta de referências.

Observe:

* como os dados são agrupados;
* como os estados são identificados;
* como os municípios são identificados;
* como candidatos são identificados;
* como turno e cargo são selecionados;
* quais arquivos o frontend carrega;
* quais informações o mapa realmente utiliza.

Depois crie nossa exportação compacta para que seja simples:

1. adaptar o EleicoesView;
   ou
2. reutilizar parte de seu conceito visual;
   ou
3. construir um visualizador semelhante.

NÃO force o motor de projeção a produzir internamente exatamente a estrutura antiga do EleicoesView.

A compatibilidade deve existir exclusivamente na camada de exportação.

============================================================
27. DADOS PARA COLORIR MAPAS
============================

A exportação compacta deve permitir facilmente descobrir, em cada território:

* candidato líder;
* votos projetados por candidato;
* percentual projetado por candidato;
* margem entre primeiro e segundo colocados;
* percentual apurado;
* maturidade da amostra.

Assim futuramente poderemos pintar um mapa segundo:

candidato vencedor projetado

e intensidade segundo:

percentual ou margem.

============================================================
28. EXPORTAÇÃO POR MÉTODO
=========================

Manter separadas as exportações de:

PROJEÇÃO POR ESTADO

e

PROJEÇÃO POR MUNICÍPIO.

Não sobrescrever uma pela outra.

Para Presidente deverá ser possível produzir:

* resultado projetado pelo método estadual;
* resultado projetado pelo método municipal.

Isso permitirá ao frontend alternar entre:

Oficial
Estado
Município.

============================================================
29. RESULTADO NACIONAL COM MÉTODO ESTADUAL
==========================================

O resultado nacional projetado pelo método estadual deve ser calculado SOMENTE depois de projetar individualmente todas as UFs projetáveis.

Conceitualmente:

Para cada UF:

estimar votos válidos finais;

multiplicar pelos percentuais atuais de cada candidato;

obter votos projetados da UF.

Depois:

somar votos projetados de todas as UFs.

Somente então calcular:

percentual nacional projetado de cada candidato.

NÃO fazer média simples dos percentuais dos estados.

============================================================
30. RESULTADO NACIONAL COM MÉTODO MUNICIPAL
===========================================

Mesma regra.

Para cada município:

estimar votos válidos finais;

aplicar percentuais atuais dos candidatos;

produzir votos projetados.

Depois:

somar municípios dentro da UF.

Depois:

somar UFs para Presidente.

Somente ao final calcular os percentuais agregados.

NÃO fazer média simples dos percentuais municipais.

============================================================
31. ARREDONDAMENTO
==================

Evitar erro acumulado por arredondamento.

Durante os cálculos internos:

manter precisão suficiente.

Arredondar somente para:

* apresentação;
* exportação de contagem de votos quando necessário.

A soma das projeções territoriais deve permanecer coerente com os totais agregados.

Documentar qualquer diferença causada por arredondamento.

============================================================
32. VALIDAÇÕES
==============

Criar validações para detectar situações impossíveis ou suspeitas.

Exemplos:

* percentual apurado menor que 0;
* percentual maior que 100;
* seções apuradas maiores que total de seções;
* votos válidos negativos;
* candidato com votos negativos;
* percentuais incompatíveis;
* unidade sem identificação;
* divisão por zero;
* dados incompletos.

Uma unidade com erro não deve derrubar toda a projeção.

Marcar a unidade como inválida, registrar o motivo e continuar quando possível.

============================================================
33. RESULTADOS COM 100% DE APURAÇÃO
===================================

Quando uma unidade atingir 100%:

o resultado projetado daquela unidade deve convergir para o próprio resultado oficial.

Não continuar extrapolando artificialmente além de 100%.

Essa condição deve possuir teste automatizado.

============================================================
34. TESTES MATEMÁTICOS
======================

Criar testes automatizados com cenários simples e verificáveis manualmente.

Exemplo A:

UF A:
40% apurado;
12 milhões de votos válidos;
Candidato 1 = 50%;
Candidato 2 = 35%.

Verificar estimativa e projeção.

Exemplo B:

UF B:
5% apurado;
Candidato 1 = 25%;
Candidato 2 = 65%.

Verificar que a UF recebe seu peso FINAL estimado e não apenas o peso dos 5% já apurados.

Criar também:

* cenário 0%;
* cenário 9,9%;
* cenário 10%;
* cenário 19,9%;
* cenário 20%;
* cenário 100%;
* várias UFs com velocidades diferentes;
* vários municípios com velocidades diferentes;
* unidade com dados ausentes.

============================================================
35. TESTE PRINCIPAL DE VIÉS DE VELOCIDADE
=========================================

Criar explicitamente um teste demonstrando o problema que o projeto pretende corrigir.

Construir duas unidades:

uma grande e muito adiantada na apuração favorável ao Candidato 1;

uma menos adiantada e fortemente favorável ao Candidato 2.

Demonstrar que:

RESULTADO OFICIAL PARCIAL

pode apresentar Candidato 1 à frente;

enquanto:

PROJEÇÃO TERRITORIAL PONDERADA

pode indicar resultado diferente.

Esse teste deve verificar matematicamente a implementação.

============================================================
36. TESTES COM DADOS DE 2022
============================

O projeto já utiliza dados históricos de 2022.

Quero que futuramente seja possível validar o modelo usando snapshots/replay da eleição de 2022.

A arquitetura deve permitir comparar:

projeção em determinado estágio

versus

resultado final verdadeiro.

Não é obrigatório reconstruir toda a sequência temporal de 2022 nesta tarefa.

Mas os resultados exportados devem possuir metadados suficientes para permitir esse estudo posteriormente.

============================================================
37. INTERFACE INICIAL
=====================

Não quero ainda copiar toda a aparência do EleicoesView.

Nesta etapa, criar uma interface funcional e técnica.

Quero principalmente:

* aba por estados;
* aba por municípios;
* resultado projetado;
* comparação com oficial;
* tabelas territoriais;
* avisos de baixa apuração;
* possibilidade de exportar JSON;
* possibilidade de inspecionar detalhes do cálculo.

A parte visual sofisticada poderá ser desenvolvida posteriormente utilizando os arquivos compactos exportados.

============================================================
38. PERFORMANCE
===============

O cálculo por municípios poderá envolver mais de 5.500 unidades.

Não permitir que isso prejudique:

* polling;
* armazenamento dos dados oficiais;
* interface oficial.

Avalie a necessidade de processamento fora da thread principal do navegador caso o cálculo produza travamentos perceptíveis.

Não implemente complexidade desnecessária se o cálculo for suficientemente rápido.

Primeiro meça.

============================================================
39. NÃO CRIAR DEPENDÊNCIA COM PYTHON
====================================

O EleicoesView possui um processador em Python usado para gerar seus arquivos estáticos.

Nosso aplicativo roda no navegador.

Não quero tornar Python obrigatório no funcionamento do site.

A geração da representação compacta deve poder ocorrer dentro da arquitetura atual do projeto.

Opcionalmente, futuramente poderá existir uma ferramenta offline auxiliar, mas ela não deve ser necessária para utilizar o aplicativo.

============================================================
40. PRIMEIRA ENTREGA
====================

ANTES DE IMPLEMENTAR:

1. analise o projeto atual;

2. identifique onde estão os dados oficiais normalizados;

3. identifique como estados e municípios são armazenados;

4. identifique quais campos representam:

   * seções totais;
   * seções apuradas;
   * percentual apurado;
   * votos válidos;
   * votos dos candidatos;

5. analise o projeto EleicoesView disponível como referência;

6. documente exatamente qual estrutura de JSON o visualizador de referência consome atualmente;

7. identifique eventuais inconsistências entre seu processador e seu frontend;

8. proponha a arquitetura modular do novo sistema;

9. explique como os dois motores permanecerão independentes;

10. proponha a estrutura do formato completo de exportação;

11. proponha a estrutura do formato compacto para visualização;

12. explique como serão tratados códigos TSE e IBGE dos municípios;

13. explique como serão tratados 0%, <10%, 10–20%, >=20% e 100% de apuração;

14. explique como preservar snapshots;

15. apresente o plano de implementação.

Depois dessa análise, implemente por etapas.

============================================================
41. CRITÉRIO FINAL DE MODULARIDADE
==================================

Quero poder apagar completamente todo o módulo de projeção e ainda ter um aplicativo funcional de resultados oficiais do TSE.

Também quero poder trocar completamente a fórmula estatística de projeção sem alterar a coleta do TSE.

E quero poder trocar completamente o visualizador/mapa sem alterar os cálculos de projeção.

Portanto devem existir três responsabilidades independentes:

DADOS OFICIAIS
↓
CÁLCULO DE PROJEÇÃO
↓
ADAPTAÇÃO / EXPORTAÇÃO VISUAL

A dependência deve ocorrer apenas nesse sentido.

O visualizador nunca deve determinar a estrutura interna do motor estatístico.
