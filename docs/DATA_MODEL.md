# Modelo de dados

`NormalizedElectionResult` preserva identidade, abrangência, totalização, comparecimento, categorias de votos, candidatos e metadados de origem. Campos ausentes são `null`; não há soma geográfica nem projeção. O objeto raw é preservado integralmente e nunca é modificado.

Cargo (`officeCode`) é separado de eleição (`electionId`). Presidente 2022 usa eleição 544; Governador/Senador usam 546.
