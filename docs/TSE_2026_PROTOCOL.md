# Protocolo-alvo 2026

Implementação baseada na documentação vigente em 08/08/2026. A única URL de bootstrap conhecida é `<base>/<ambiente>/comum/config/ele-c.json` (EA11). O ciclo usa prioritariamente `pl[].c`, tolerando `root.c` para arquivos antigos. Os diretórios restantes são resolvidos exclusivamente de `arq[].dir`.

O discovery seleciona por pleito, turno, tipo e cargo em `abr[].cp[]`, nunca pelo nome: Presidente exige eleição federal `tp=8` com cargo 1; Governador e Senador exigem eleição estadual `tp=1` contendo cargos 3 e 5. Não existe fallback de ID. Na ausência, a interface informa “Eleição Geral 2026 ainda não disponível neste ambiente”.

EA12 é baixado por eleição. EA14 federal e estadual são monitorados separadamente; uma UF alterada direciona seu EA15 e só municípios alterados direcionam EA20 municipal. Presidente usa a eleição federal; Governador e Senador, a estadual. Um município só gera URL depois de validado no EA12 correspondente.

O IDG identifica cada arquivo, não uma carga compartilhada. ETag, Last-Modified e 304 são suportados, mas 304 também conta no rate limit. Em 08/08/2026, a URL do simulado ainda não foi publicada e o TSE informou que o intervalo recomendado será avaliado nos simulados de setembro. Portanto os 5 segundos são configuráveis e não iniciam automaticamente.

Fonte: página técnica oficial do TSE para divulgação de resultados 2026.
