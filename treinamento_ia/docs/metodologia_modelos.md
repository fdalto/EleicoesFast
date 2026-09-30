# Metodologia

Há dois regressores XGBoost por UF elegível: um para cada delta. A seleção de hiperparâmetros usa apenas 2018, com `GroupKFold` por `codigo_ibge`; 2022 é avaliação temporal única. O relatório compara XGBoost ao baseline que prevê o resultado da capital para todo município.

Em 2026, a entrada da capital pode ser parcial. Isso é um *covariate shift*: os modelos foram treinados com capital a 100%. `07_predict_from_capital_runtime.py` exige limiar explícito de progresso, registra o progresso e não afirma que a predição foi treinada naquele estágio. A análise de sensibilidade de ±1, ±2 e ±5 p.p. deve acompanhar qualquer uso operacional.
