# Projeções eleitorais

O módulo `src/projection` depende somente de fotografias imutáveis de `NormalizedElectionResult`. Não acessa transporte, providers, raw JSON ou polling. Pode ser removido sem afetar a área oficial.

## Fluxo

Resultados normalizados → snapshot consistente → motor por UF **ou** motor por município → execução derivada → storage próprio → exportadores → página técnica.

Os motores são independentes: o estadual lê somente resultados oficiais `scope=UF`; o municipal lê somente `scope=MUNICIPALITY`. O método municipal pode agregar seus próprios territórios por UF e Brasil, mas nunca alimenta o motor estadual.

## Peso histórico no motor municipal

O motor municipal usa os votos válidos oficiais de 2022 como peso fixo até o município concluir a apuração. Abaixo de 10%, distribui esse peso pelos percentuais oficiais atuais da UF. De 10% até menos de 100%, distribui o mesmo peso pelos percentuais atuais do município. Em 100%, descarta a base histórica e usa exatamente os votos oficiais de 2026. Os votos por candidato de 2022 nunca são reutilizados. Sem base histórica ou sem uma distribuição atual válida, a unidade permanece `NO_DATA` e a execução é marcada como parcial.

A base embarcada é `municipios-votos-validos-2022.json`. Ela foi produzida a partir do recurso oficial “Detalhe da apuração por município e zona”, somando `QT_TOTAL_VOTOS_VALIDOS` das zonas de cada município. A eleição suplementar 6278 e a abrangência exterior `ZZ` foram excluídas. O arquivo cobre 5.570 municípios: Presidente nos dois turnos, Governador no primeiro turno e nos 12 estados que tiveram segundo turno, e Senador no primeiro turno.

## Exterior (`ZZ`)

Para Presidente, `ZZ` é tratado como o território fictício **Exterior**. Suas localidades são baixadas do EA12/EA15 e entram na projeção municipal. Como não há base municipal histórica de 2022 para o exterior, cada localidade usa os votos válidos observados divididos pela fração de seções apuradas; em 100% de apuração, usa exatamente o total oficial. A soma dessas localidades integra os votos válidos finais projetados do Brasil. O exterior não é consultado para Governador ou Senador.

## Método simples v1

Para cada unidade válida com fração apurada `f > 0`, estima-se `votosVálidosFinais = votosVálidosObservados / f` e `votosProjetadosCandidato = votosObservadosCandidato / f`. Em 100%, a estimativa é exatamente o observado. Cálculos permanecem em ponto flutuante; arredondamento ocorre só na apresentação/exportação compacta.

Unidades com 0% ficam `NO_DATA`; dados impossíveis ficam `INVALID` sem interromper a execução. Maturidade usa limiares operacionais, não intervalos científicos: `<10%` muito preliminar; `10–<20%` preliminar; `>=20%` maior maturidade; 100% completo.

## Snapshot e cobertura

A leitura ocorre dentro de uma transação IndexedDB e é clonada antes do cálculo; atualizações posteriores entram apenas na próxima execução. Para Governador e Senador, o snapshot possui uma UF-alvo explícita, impedindo a mistura de disputas estaduais que compartilhem o mesmo identificador de eleição. A cobertura separa total, projetáveis, zeradas e inválidas, mínimo/mediana/percentual ponderado de apuração. O motor estadual enumera as 27 UFs; o municipal inclui o inventário de municípios EA12 disponível. O peso coberto é aproximado: votos válidos finais estimados nas projetáveis e eleitorado como proxy onde não há amostra.

## Exportações

- Completa: execução integral, parâmetros, snapshot, cobertura, agregados e decomposição territorial auditável.
- Compacta genérica: metadados e territórios com líder, votos/percentuais projetados, margem, apuração, maturidade e identificadores TSE/IBGE distintos.
- EleicoesView: adaptador opcional descrito em `ELEICOESVIEW_REFERENCE.md`.

Senador preserva os denominadores e votos oficiais recebidos; o motor não iguala votos do cargo a comparecimento nem presume uma vaga.
