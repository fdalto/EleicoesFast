export const UF_IBGE:Record<string,string>={AC:'12',AL:'27',AM:'13',AP:'16',BA:'29',CE:'23',DF:'53',ES:'32',GO:'52',MA:'21',MG:'31',MS:'50',MT:'51',PA:'15',PB:'25',PE:'26',PI:'22',PR:'41',RJ:'33',RN:'24',RO:'11',RR:'14',RS:'43',SC:'42',SE:'28',SP:'35',TO:'17'};
export const EXTERIOR_UF='ZZ';
export const EXTERIOR_NAME='Exterior';
export const isBrazilianUf=(uf:string)=>Object.hasOwn(UF_IBGE,uf.toUpperCase());
export const isProjectionTerritory=(uf:string)=>isBrazilianUf(uf)||uf.toUpperCase()===EXTERIOR_UF;
export interface MunicipalityIdentity {tseCode:string;ibgeCode:string|null;name:string|null;uf:string}
export interface TerritoryRegistry {municipality(uf:string,tseCode:string):MunicipalityIdentity|null;municipalities(uf?:string|null):MunicipalityIdentity[]}
export class EmptyTerritoryRegistry implements TerritoryRegistry {municipality(){return null}municipalities(){return[]}}
export class MapTerritoryRegistry implements TerritoryRegistry {private entries:Map<string,MunicipalityIdentity>;constructor(entries:MunicipalityIdentity[]){this.entries=new Map(entries.map(e=>[`${e.uf.toUpperCase()}:${e.tseCode}`,{...e,uf:e.uf.toUpperCase()}]))}municipality(uf:string,tseCode:string){return this.entries.get(`${uf.toUpperCase()}:${tseCode}`)??null}municipalities(uf?:string|null){const entries=[...this.entries.values()];return uf?entries.filter(e=>e.uf===uf.toUpperCase()):entries}}
