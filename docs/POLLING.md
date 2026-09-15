# Polling

`PollingManager` executa ações em intervalo configurável (5 s desejados, sujeitos ao limite que o TSE confirmar no simulado). `RequestScheduler` limita concorrência e início de requisições por segundo, com retry, backoff exponencial e jitter. `TSE2026PollingCoordinator` consulta EA14 federal/estadual em paralelo, cria uma linha de base no primeiro ciclo e depois segue EA14 alterado → EA15 alterado → EA20 seletivo. Nunca inicia sincronização nacional automaticamente nem baixa municípios no ciclo inicial.

## Fila global

O limite configurado é 80 inícios por janela móvel de um segundo, espaçados em aproximadamente 12,5 ms, com no máximo 10 requisições simultâneas. EA11/EA14 têm prioridade crítica; EA12/EA15, alta; EA20 Brasil/UF, normal; EA20 municipal em lote, baixa. Requisições idênticas em voo são deduplicadas.

Retry ocorre somente para timeout, falha de rede, HTTP 408, 429 e 5xx. HTTP 400/404 e JSON inválido não são repetidos. `Retry-After` é respeitado e todo novo attempt volta para a fila, portanto também conta no limite. A fila aceita cancelamento e tem capacidade máxima de 10.000 itens.
