# GeographicSwingEngine 1.0

O motor é uma projeção presidencial de segundo turno, executada no navegador. É uma simplificação auditável: não implementa regressão, coeficiente de perfil, BU individual ou ASN.1.

## Fluxo e responsabilidades

1. EA16 identifica seções efetivamente confirmadas.
2. EA20 fornece os votos atuais agregados por município.
3. O site envia apenas as chaves dessas seções à API Python local.
4. A API devolve os totais do primeiro turno de 2026 dessas mesmas seções.
5. O TypeScript calcula 25 swings e cinco fatores de volume, projeta municípios e soma UF/Brasil.

O JSON leve `public/data/geographic/municipality-history.json` é derivado offline do SQLite e contém somente totais municipais completos de 1T 2026, população estimada e estrato. A tabela seccional nacional nunca é baixada pelo navegador.

## Faixas e regiões

`população estimada = votos válidos 1T / 0,56`; é uma proxy operacional, não população censitária. A faixa é fixa durante a apuração:

| Estrato | População estimada |
| --- | --- |
| E1 | até 5 mil |
| E2 | mais de 5 mil até 10 mil |
| E3 | mais de 10 mil até 50 mil |
| E4 | mais de 50 mil até 200 mil |
| E5 | acima de 200 mil |

Os 25 grupos são as cinco macrorregiões brasileiras (DF em Centro-Oeste) vezes esses cinco estratos. Exterior não entra artificialmente nos grupos.

## Matemática

Para cada município sincronizado entre EA16 e EA20, usando `eps=0,5`:

`delta_m = ln((PT_2 + eps)/(PL_2 + eps)) - ln((PT_1_A + eps)/(PL_1_A + eps))`

Para cada grupo, o swing é a média ponderada de `delta_m`, com peso igual aos votos válidos atuais do município. Há fallback explícito: grupo → região → Brasil → zero. Os limiares iniciais são dois municípios e 100 votos válidos informativos.

Em paralelo, cada região recebe `F = soma(válidos atuais) / soma(válidos históricos das mesmas seções)`, com fallback região → Brasil → 1. O fator incorpora comparecimento e composição de válidos; não é uma medida isolada de abstenção.

Para município abaixo de 100%, a previsão usa o município histórico inteiro:

`p_PT = exp(delta) * PT_1 / (exp(delta) * PT_1 + PL_1)`

`válidos estimados = válidos históricos completos * F_região`

Não se subtraem seções já apuradas e não se somam votos parciais à estimativa. Em 100%, entra exclusivamente o EA20 oficial. Esse desenho pode gerar um salto na virada para 100% e até uma estimativa abaixo do parcial; a interface sinaliza isso sem correção silenciosa.

## Uso

1. Gere/recrie o agregado municipal: `npm run data:2026:size-bands`.
2. Inicie a API: `npm run geographic:server`.
3. Inicie o site: `npm run dev`.
4. Em **Projeções eleitorais**, selecione um snapshot presidencial de 2º turno e abra **POR SEÇÃO** (laranja). Use **Diagnosticar API** e depois **Calcular projeção**.

O resultado expõe seções encontradas/faltantes, municípios sincronizados/inconsistentes, matriz 5×5, fatores regionais e as barras de resultado. Enquanto EA16/EA20 ou a API histórica não estiverem disponíveis, as projeções por estado e município continuam independentes.

## Limites de qualidade

A correspondência é estrita: EA20 precisa ter a mesma quantidade de seções que o conjunto EA16 enviado, e todas precisam ser encontradas no histórico. Não há promessa de margem de erro. A API local deve ser testada no navegador do ambiente usado; páginas HTTPS podem impedir acesso a `localhost` HTTP.
