import {ElectionOffice,OFFICE_CODE} from '../../election/normalized/ElectionOffice';
import {DirectoryTemplateResolver} from './DirectoryTemplateResolver';
import {formatElectionFileCode,formatMunicipalityCode,formatOfficeCode} from './formatters';
import type {DiscoveredElection2026,EA11Directory} from './types/EA11';

export interface TSE2026RuntimeConfig {baseUrl:string;environment:'oficial'|'simulado'|string}
export class TSE2026UrlBuilder {
  constructor(private runtime:TSE2026RuntimeConfig,private discovery:DiscoveredElection2026,private resolver=new DirectoryTemplateResolver()){}
  electionFor(office:ElectionOffice){return office===ElectionOffice.PRESIDENT?this.discovery.federalElectionId:this.discovery.stateElectionId}
  private directory(type:string,electionId:string,uf?:string){const entry=this.discovery.directories.find(a=>a.tp===type);if(!entry)throw new Error(`EA11 não forneceu arq[].dir para tp=${type}`);return this.resolver.resolve(entry.dir,{base:this.runtime.baseUrl,environment:this.runtime.environment,cycle:this.discovery.cycle,electionId,uf,pollId:this.discovery.pollId})}
  private join(dir:string,file:string){return`${dir}/${file}`}
  private ensureState(uf:string,office:ElectionOffice){const state=uf.toUpperCase();const allowed=office===ElectionOffice.PRESIDENT?this.discovery.federalStates:this.discovery.stateStates;if(!allowed.includes(state))throw new Error(`UF ${state} não pertence à eleição ${this.electionFor(office)}`);return state.toLowerCase()}
  ea12(office:ElectionOffice){const e=this.electionFor(office);return this.join(this.directory('cm',e),`mun-e${formatElectionFileCode(e)}-cm.json`)}
  ea14(kind:'federal'|'state'){const e=kind==='federal'?this.discovery.federalElectionId:this.discovery.stateElectionId;return this.join(this.directory('ab',e,'br'),`br-e${formatElectionFileCode(e)}-ab.json`)}
  ea15(uf:string,kind:'federal'|'state'){const office=kind==='federal'?ElectionOffice.PRESIDENT:ElectionOffice.GOVERNOR;const state=this.ensureState(uf,office);const e=kind==='federal'?this.discovery.federalElectionId:this.discovery.stateElectionId;return this.join(this.directory('ab',e,state),`${state}-e${formatElectionFileCode(e)}-ab.json`)}
  ea20(scope:'BRASIL'|'UF'|'MUNICIPALITY',office:ElectionOffice,uf?:string,municipalityCode?:string,knownMunicipalities?:Set<string>){const e=this.electionFor(office),cargo=formatOfficeCode(OFFICE_CODE[office]);if(scope==='BRASIL'){if(office!==ElectionOffice.PRESIDENT)throw new Error('EA20 Brasil é permitido somente para Presidente');return this.join(this.directory('u',e,'br'),`br-c${cargo}-e${formatElectionFileCode(e)}-u.json`)}const state=this.ensureState(String(uf),office);if(scope==='UF')return this.join(this.directory('u',e,state),`${state}-c${cargo}-e${formatElectionFileCode(e)}-u.json`);const municipality=formatMunicipalityCode(String(municipalityCode));if(!knownMunicipalities?.has(municipality))throw new Error(`Município ${municipality} não foi validado pelo EA12 da eleição ${e}`);return this.join(this.directory('u',e,state),`${state}${municipality}-c${cargo}-e${formatElectionFileCode(e)}-u.json`)}
  static directoryTypes(directories:EA11Directory[]){return new Set(directories.map(d=>d.tp))}
}
