import {ElectionOffice,OFFICE_CODE} from '../../election/normalized/ElectionOffice';
import {ElectionDiscoveryService} from '../../services/ElectionDiscoveryService';
import {TSE2026UrlBuilder,type TSE2026RuntimeConfig} from '../2026/TSE2026UrlBuilder';
import {parseEA12} from '../2026/parsers/EA12Parser';
import {parseEA14} from '../2026/parsers/EA14Parser';
import {parseEA15} from '../2026/parsers/EA15Parser';
import {parseEA20} from '../2026/parsers/EA20Parser';
import type {DiscoveredElection2026} from '../2026/types/EA11';
import type {TSETransport,TransportResponse} from '../transport/TSETransport';
import {RequestPriority} from '../polling/RequestScheduler';
import type {Municipality,ProviderResult,TSEElectionProvider} from './TSEElectionProvider';

export class TSE2026Provider implements TSEElectionProvider {
  readonly id:string;
  private discovery?:DiscoveredElection2026;
  private builder?:TSE2026UrlBuilder;
  private municipalityCache=new Map<string,Municipality[]>();
  private fingerprints=new Map<string,string>();
  constructor(private transport:TSETransport,private runtime:TSE2026RuntimeConfig={baseUrl:'https://resultados.tse.jus.br',environment:'oficial'},private round=1,private pollId?:string){this.id=runtime.environment==='simulado'?'2026_SIMULATION':'2026_OFFICIAL'}
  async bootstrap(force=false){if(this.discovery&&!force)return this.discovery;const response=await new ElectionDiscoveryService(this.transport).discover(this.runtime.baseUrl,this.runtime.environment,this.round,this.pollId);this.discovery=response.discovery;this.builder=new TSE2026UrlBuilder(this.runtime,this.discovery);this.municipalityCache.clear();return this.discovery}
  private async ready(){const discovery=await this.bootstrap();return{discovery,builder:this.builder!}}
  async discoverElection(office:ElectionOffice){const {builder}=await this.ready();return builder.electionFor(office)}
  async getStates(){const {discovery}=await this.ready();return[...new Set([...discovery.federalStates,...discovery.stateStates])].sort()}
  async getMunicipalities(uf:string,office:ElectionOffice){const {builder}=await this.ready();const election=builder.electionFor(office),key=`${election}:${uf.toUpperCase()}`;const cached=this.municipalityCache.get(key);if(cached)return cached;const response=await this.transport.fetchJson<Record<string,unknown>>({url:builder.ea12(office),priority:RequestPriority.HIGH});if(!response.data)throw new Error('EA12 retornou resposta vazia');const municipalities=parseEA12(response.data,uf);this.municipalityCache.set(key,municipalities);return municipalities}
  private async result(url:string,office:ElectionOffice,scope:'BRASIL'|'UF'|'MUNICIPALITY',uf?:string,municipality?:Municipality):Promise<ProviderResult>{const {discovery,builder}=await this.ready();const transport=await this.transport.fetchJson<Record<string,unknown>>({url,priority:scope==='MUNICIPALITY'?RequestPriority.BULK:RequestPriority.NORMAL});if(!transport.data)throw new Error('EA20 retornou resposta vazia');return{raw:transport.data,transport,normalized:parseEA20(transport.data,{office,officeCode:OFFICE_CODE[office],electionId:builder.electionFor(office),pollId:discovery.pollId,round:discovery.round,scope,uf:uf??null,municipalityCode:municipality?.code??null,municipalityName:municipality?.name??null,sourceUrl:url,fetchedAt:transport.fetchedAt})}}
  async getNationalResult(office:ElectionOffice){const {builder}=await this.ready();return this.result(builder.ea20('BRASIL',office),office,'BRASIL')}
  async getStateResult(uf:string,office:ElectionOffice){const {builder}=await this.ready();return this.result(builder.ea20('UF',office,uf),office,'UF',uf)}
  async getMunicipalityResult(uf:string,code:string,office:ElectionOffice){const {builder}=await this.ready();const municipalities=await this.getMunicipalities(uf,office),municipality=municipalities.find(m=>m.code===String(code).padStart(5,'0'));if(!municipality)throw new Error(`Município ${code} não existe no EA12 da eleição ${builder.electionFor(office)}`);const known=new Set(municipalities.map(m=>m.code));return this.result(builder.ea20('MUNICIPALITY',office,uf,municipality.code,known),office,'MUNICIPALITY',uf,municipality)}
  async getEA14(kind:'federal'|'state'):Promise<{transport:TransportResponse;states:ReturnType<typeof parseEA14>}>{const {builder}=await this.ready();const url=builder.ea14(kind),transport=await this.transport.fetchJson<Record<string,unknown>>({url,priority:RequestPriority.CRITICAL});if(!transport.data)throw new Error('EA14 retornou resposta vazia');return{transport,states:parseEA14(transport.data)}}
  async getEA15(uf:string,kind:'federal'|'state'){const {builder}=await this.ready();const url=builder.ea15(uf,kind),transport=await this.transport.fetchJson<Record<string,unknown>>({url,priority:RequestPriority.HIGH});if(!transport.data)throw new Error('EA15 retornou resposta vazia');return{transport,municipalities:parseEA15(transport.data)}}
  async checkUpdates(){const responses=await Promise.all([this.getEA14('federal'),this.getEA14('state')]);const changes:string[]=[];for(const response of responses)for(const state of response.states){const key=`${response.transport.url}:${state.uf}`,next=state.version??state.generatedAt??JSON.stringify(state.raw);if(this.fingerprints.get(key)!==next)changes.push(key);this.fingerprints.set(key,next)}return changes}
}
