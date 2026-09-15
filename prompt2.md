CORREÇÕES IMPORTANTES PARA A INTEGRAÇÃO 2026

1. Não existe um único electionId para os cargos de interesse.

O TSE define:

- Presidente -> Eleição Federal (tp=8)
- Governador -> Eleição Estadual (tp=1)
- Senador -> Eleição Estadual (tp=1)

O ElectionDiscoveryService deverá descobrir separadamente:

federalElectionId
stateElectionId

através do EA11.

Não selecionar eleição pelo texto de "nm".
Selecionar por:

- pleito;
- turno;
- tp;
- cargos presentes em abr[].cp[].


2. O EA11 é o bootstrap da arquitetura.

Única URL inicialmente conhecida:

<base>/<environment>/comum/config/ele-c.json

Depois de baixar EA11, utilizar arq[].dir para obter os templates de
diretórios dos demais arquivos.

Não hard-code:

/dados/
/config/

quando essas informações puderem ser obtidas de arq[].dir.


3. Criar DirectoryTemplateResolver.

Ele deverá resolver os tokens documentados:

<base>
<ambiente>
<ciclo>
<cd_eleicao>
<uf>
<cd_pleito>

IMPORTANTE:

<cd_eleicao> dentro do diretório usa o código bruto da eleição.

Exemplo:

544

NÃO:

000544


4. Criar formatadores diferentes para nomes de arquivos:

formatOfficeCode(1)
=> "0001"

formatElectionFileCode(544)
=> "000544"

formatPleitoFileCode(304)
=> "000304"

formatMunicipalityCode(...)
=> exatamente 5 dígitos.


5. EA12

Nome:

mun-e<ELEICA>-cm.json

Criar um EA12 para cada eleição descoberta.

Não assumir que o EA12 federal e estadual são necessariamente iguais.


6. EA14

Nome:

br-e<ELEICA>-ab.json

Como existem eleição federal e estadual, o PollingManager deverá
monitorar separadamente:

EA14 federal
EA14 estadual


7. EA15

Nome:

<uf>-e<ELEICA>-ab.json

Ao detectar mudança de UF:

EA14 federal
-> EA15 federal da UF

EA14 estadual
-> EA15 estadual da UF


8. EA20

Presidente utiliza federalElectionId.

Brasil:
br-c0001-e<ELEICA_FEDERAL>-u.json

UF:
<uf>-c0001-e<ELEICA_FEDERAL>-u.json

Município:
<uf><MUNIC>-c0001-e<ELEICA_FEDERAL>-u.json


Governador utiliza stateElectionId.

UF:
<uf>-c0003-e<ELEICA_ESTADUAL>-u.json

Município:
<uf><MUNIC>-c0003-e<ELEICA_ESTADUAL>-u.json


Senador utiliza stateElectionId.

UF:
<uf>-c0005-e<ELEICA_ESTADUAL>-u.json

Município:
<uf><MUNIC>-c0005-e<ELEICA_ESTADUAL>-u.json


9. Polling desejado:

a cada 5 segundos:

PARALELO:

EA14 federal
EA14 estadual

Se federal mudou:
    identificar UFs alteradas
    atualizar EA20 Presidente Brasil
    para cada UF alterada:
        EA15 federal UF
        atualizar EA20 Presidente UF
        identificar municípios alterados
        atualizar EA20 Presidente dos municípios alterados

Se estadual mudou:
    identificar UFs alteradas
    para cada UF alterada:
        EA15 estadual UF
        atualizar:
            EA20 Governador UF
            EA20 Senador UF

        identificar municípios alterados

        para cada município alterado:
            EA20 Governador município
            EA20 Senador município


10. O código NÃO deve possuir fallback de electionId para 2026.

Se o EA11 ainda não apresentar eleição:

tp=8 + Presidente

ou:

tp=1 + Governador/Senador

mostrar:

"Eleição Geral 2026 ainda não disponível neste ambiente"

e aguardar o ambiente oficial/simulado.


11. Compatibilidade do parser EA11:

A especificação 2026 define ciclo em:

pl[].c

Arquivos antigos podem possuir ciclo na raiz:

root.c

Portanto permitir:

cycle = pleito.c ?? config.c

mas considerar pl[].c como estrutura primária de 2026.


12. Nunca gerar URLs por tentativa.

Antes de fazer EA20 municipal:

- município precisa existir no EA12;
- cargo precisa existir no EA11;
- eleição precisa ter sido descoberta no EA11;
- UF precisa pertencer à eleição.

Isso reduz 404 e risco de bloqueio pelo TSE.