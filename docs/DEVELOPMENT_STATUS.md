# Estado do desenvolvimento — 15/09/2026

## Análise

Foram lidos README.md, funcoes.md e os três prompts disponíveis na raiz (prompt.md, prompt2.md, prompt3.md). Não existe diretório prompt nesta cópia.

A aplicação já possui providers 2022/2026, descoberta EA11, parsers separados, transporte com fila global, IndexedDB, motores de projeção, exportação e mapa. A documentação interna da arquitetura e dos módulos orienta a continuidade sem reexaminar a referência externa.

A interface oficial oferece consultas manuais. Os serviços de polling existem, mas ainda não estão conectados aos controles da interface. Também permanecem etapas dos prompts: replay, sincronização em lote com progresso/cancelamento e seleção de turno na tela oficial.

Existe uma diferença documentada entre prompt3.md e o comportamento municipal atual: o prompt pede extrapolação pela fração apurada e ausência de estimativa em 0%; o código/documentação atuais adotam peso histórico 2022 e distribuição estadual abaixo de 10%. Essa fórmula existente foi preservada nesta etapa; a escolha dos métodos deve ficar explícita numa evolução própria.

## Etapa implementada

Confiabilidade do polling, sem alterar URLs, parsers ou fórmulas:

- ciclos automáticos/manuais compartilham a operação em andamento;
- erros automáticos ficam disponíveis para diagnóstico;
- versões só são concluídas após download e persistência;
- falhas de EA15/EA20 ou storage mantêm a UF pendente;
- municípios vistos pela primeira vez após mudança de UF são buscados;
- resultado nacional presidencial é solicitado uma vez por ciclo alterado.

A linha de base inicial continua sem download nacional automático. Detalhes e limites em POLLING.md.

## Próximas etapas

1. Integrar iniciar/pausar/atualizar agora à interface, com ciclo de vida por provider e relatório de erros.
2. Implementar sincronização por UF com progresso e cancelamento usando a fila global.
3. Adicionar replay explicitamente simulado para verificar ingestão, persistência e interface ponta a ponta.
4. Tornar explícita a escolha entre a fórmula municipal simples do prompt e o método histórico existente.

A validação desta etapa é local com providers simulados; não confirma disponibilidade atual do ambiente TSE nem CORS.
