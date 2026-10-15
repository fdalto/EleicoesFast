export type BrazilRegion='NORTE'|'NORDESTE'|'CENTRO_OESTE'|'SUDESTE'|'SUL';

const BY_UF:Record<string,BrazilRegion>={AC:'NORTE',AP:'NORTE',AM:'NORTE',PA:'NORTE',RO:'NORTE',RR:'NORTE',TO:'NORTE',AL:'NORDESTE',BA:'NORDESTE',CE:'NORDESTE',MA:'NORDESTE',PB:'NORDESTE',PE:'NORDESTE',PI:'NORDESTE',RN:'NORDESTE',SE:'NORDESTE',DF:'CENTRO_OESTE',GO:'CENTRO_OESTE',MS:'CENTRO_OESTE',MT:'CENTRO_OESTE',ES:'SUDESTE',MG:'SUDESTE',RJ:'SUDESTE',SP:'SUDESTE',PR:'SUL',RS:'SUL',SC:'SUL'};
export const BRAZIL_REGIONS:BrazilRegion[]=['NORTE','NORDESTE','CENTRO_OESTE','SUDESTE','SUL'];
export function regionForUf(uf:string):BrazilRegion|null{return BY_UF[uf.toUpperCase()]??null}
export function regionLabel(region:BrazilRegion){return{NORTE:'Norte',NORDESTE:'Nordeste',CENTRO_OESTE:'Centro-Oeste',SUDESTE:'Sudeste',SUL:'Sul'}[region]}
