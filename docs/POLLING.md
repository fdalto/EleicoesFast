# Polling

`PollingManager` executa ações em intervalo configurável (5 s desejados, sujeitos ao limite que o TSE confirmar no simulado). `RequestScheduler` limita concorrência e início de requisições por segundo, com retry, backoff exponencial e jitter. `TSE2026PollingCoordinator` consulta EA14 federal/estadual em paralelo, cria uma linha de base no primeiro ciclo e depois segue EA14 alterado → EA15 alterado → EA20 seletivo. Nunca inicia sincronização nacional automaticamente nem baixa municípios no ciclo inicial.

## Modo automático

O modo automático da interface 2026 faz uma carga inicial ordenada: Presidente Brasil/UFs, Governador por UFs, inventários municipais e resultados municipais de Presidente/Governador. A fila municipal possui oito trabalhadores; eles colocam somente um pequeno conjunto de tarefas por vez na fila HTTP global. O agendador continua sendo a autoridade do limite: no máximo 80 inícios por segundo e 10 requisições simultâneas, uma margem de 20% sobre o limite de 100 req/s publicado pelo TSE.

Ao terminar, o coordenador estabelece a linha de base de EA14 federal/estadual e consulta a cada 10 segundos. Não existe índice/API de arquivos alterados. Conforme a orientação do TSE, EA14 indica as UFs e EA15 os municípios que provavelmente mudaram; somente então os EA20 de Presidente/Governador correspondentes são baixados. A pequena defasagem de CDN continua sendo tratada em ciclos posteriores. O TSE não publicou uma cadência recomendada além da obrigação de respeitar os limites; 10 segundos é uma escolha conservadora e configurável da aplicação.

O botão permanece ativo ao navegar para Projeções e Mapa. Desligar o modo impede novas tarefas depois das requisições já em voo. O estado operacional é salvo em `pollingState`. Raw e normalizado usam uma chave estável por provider/URL, mantendo a versão mais recente para snapshots, projeções e mapas.

## Fila global

O limite configurado é 80 inícios por janela móvel de um segundo, espaçados em aproximadamente 12,5 ms, com no máximo 10 requisições simultâneas. EA11/EA14 têm prioridade crítica; EA12/EA15, alta; EA20 Brasil/UF, normal; EA20 municipal em lote, baixa. Requisições idênticas em voo são deduplicadas.

Retry ocorre somente para timeout, falha de rede, HTTP 408, 429 e 5xx. HTTP 400/404 e JSON inválido não são repetidos. `Retry-After` é respeitado e todo novo attempt volta para a fila, portanto também conta no limite. A fila aceita cancelamento e tem capacidade máxima de 10.000 itens.

## Recuperação e concorrência

Cada coordenador compartilha um único ciclo em voo. A primeira leitura bem-sucedida de EA14 de cada eleição estabelece a linha de base, sem baixar EA15/EA20. Depois, UFs novas ou alteradas são processadas; municípios encontrados pela primeira vez nessa etapa também são baixados. Sem uma versão municipal anterior, não é possível distinguir quais mudaram: a primeira passagem pela UF busca todos os municípios listados no EA15. Nas passagens seguintes, somente versões municipais pendentes são buscadas.

As versões são confirmadas apenas depois de downloads e callback de persistência bem-sucedidos. Uma falha mantém a UF pendente para o próximo ciclo, mesmo que EA14 não mude novamente. Municípios já concluídos são preservados; resultados estaduais podem ser repetidos na recuperação. Presidente Brasil é solicitado uma vez por ciclo com alterações federais. Os monitores federal e estadual tratam erros independentemente.

`PollingManager` compartilha a execução entre timer e atualização manual. Erros automáticos ficam em `lastError`; erros de `runNow` também são propagados ao chamador. Pausar impede novos disparos, mas permite concluir o ciclo em voo. As versões do coordenador ficam em memória e são reiniciadas ao recriá-lo.

Testes simulados: `pollingCoordinator.test.ts` e `pollingManager.test.ts`. A interface oficial ainda não conecta os controles de polling a esses serviços.
