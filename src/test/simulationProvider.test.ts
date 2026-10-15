import {describe,it,expect,vi} from 'vitest';
import {TSE2026Provider} from '../tse/providers/TSE2026Provider';
import {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {TSETransport,TransportRequest} from '../tse/transport/TSETransport';

// Reduced fixture matching the national coverage published for the September simulado.
const config={arq:[{tp:'cm',dir:'<base>/<ambiente>/<ciclo>/<cd_eleicao>/config'},{tp:'u',dir:'<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>'}],pl:[{cd:'17801',c:'ele2026',e:[{cd:'21270',t:'1',tp:'8',abr:[{cd:'br',cp:[{cd:'1'}]}]},{cd:'21272',t:'1',tp:'1',abr:[{cd:'br',cp:[{cd:'3'},{cd:'5'}]}]}]}]};
function setup(){
 const urls:string[]=[];
 const fetchJson=vi.fn(async ({url}:TransportRequest)=>{
  urls.push(url);
  const data=url.endsWith('ele-c.json')?config:url.endsWith('-cm.json')?{abr:[{cd:'ac',mu:[{cd:'01120',cdi:'1200013',nm:'ACRELÂNDIA'}]}]}:{carg:[],s:{},e:{},v:{}};
  return {data,rawText:JSON.stringify(data),status:200,url,headers:{},bytes:0,latencyMs:0,notModified:false,fetchedAt:'2026-09-15T14:00:00Z'};
 });
 return {urls,fetchJson,provider:new TSE2026Provider({fetchJson} as TSETransport,{baseUrl:'https://resultados-sim.tse.jus.br/simulado',environment:'simulado2026'})};
}
describe('perfil real do simulado 2026',()=>{
 it('descobre UFs pelo EA12 e consulta os três cargos sem duplicar o ambiente',async()=>{
  const {provider,urls}=setup();
  expect(provider.id).toBe('2026_SIMULATION_R1');
  await Promise.all([provider.discoverElection(ElectionOffice.PRESIDENT),provider.discoverElection(ElectionOffice.GOVERNOR)]);
  expect(await provider.getStates()).toEqual(['AC']);
  await provider.getNationalResult(ElectionOffice.PRESIDENT);
  await provider.getStateResult('AC',ElectionOffice.GOVERNOR);
  await provider.getMunicipalityResult('AC','01120',ElectionOffice.SENATOR);
  expect(urls[0]).toBe('https://resultados-sim.tse.jus.br/simulado/simulado2026/comum/config/ele-c.json');
  expect(urls.filter(u=>u.endsWith('ele-c.json'))).toHaveLength(1);
  expect(urls.filter(u=>u.endsWith('-cm.json'))).toHaveLength(2);
  expect(urls.at(-1)).toContain('/21272/dados/ac/ac01120-c0005-e021272-u.json');
  expect(urls.some(u=>u.endsWith('br-c0001-e021270-u.json'))).toBe(true);
  expect(urls.some(u=>u.endsWith('ac-c0003-e021272-u.json'))).toBe(true);
  expect((await provider.getMunicipalities('AC',ElectionOffice.SENATOR))[0].ibgeCode).toBe('1200013');
 });
 it('recusa UF e município inexistentes sem consultar EA20',async()=>{
  const {provider,urls}=setup();
  await expect(provider.getStateResult('XX',ElectionOffice.GOVERNOR)).rejects.toThrow('não pertence');
  await expect(provider.getMunicipalityResult('AC','99999',ElectionOffice.SENATOR)).rejects.toThrow('não existe');
  expect(urls.some(u=>u.endsWith('-u.json'))).toBe(false);
 });
 it('permite nova tentativa após erro de bootstrap',async()=>{
  const {provider,fetchJson}=setup();
  fetchJson.mockRejectedValueOnce(new Error('rede'));
  await expect(provider.bootstrap()).rejects.toThrow('rede');
  expect((await provider.bootstrap()).stateStates).toEqual(['AC']);
 });
});
