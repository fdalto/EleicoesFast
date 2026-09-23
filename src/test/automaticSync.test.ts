import {describe,expect,it,vi} from 'vitest';
import {AutomaticSyncService} from '../services/AutomaticSyncService';
import {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {TSE2026Provider} from '../tse/providers/TSE2026Provider';
import type {ProviderResult} from '../tse/providers/TSEElectionProvider';

const result=(label:string)=>({label} as unknown as ProviderResult);

describe('modo automático',()=>{
  it('faz a carga inicial na ordem e entra no polling inteligente',async()=>{
    const calls:string[]=[];
    const provider={
      bootstrap:vi.fn(async()=>({})),
      getStates:vi.fn(async()=>['AC']),
      getNationalResult:vi.fn(async()=>{calls.push('PRESIDENT:BR');return result('PRESIDENT:BR');}),
      getStateResult:vi.fn(async(uf:string,office:ElectionOffice)=>{calls.push(`${office}:${uf}`);return result(`${office}:${uf}`);}),
      getMunicipalities:vi.fn(async(uf:string,office:ElectionOffice)=>[{code:'01120',ibgeCode:'1200013',name:'ACRELÂNDIA',uf,office}]),
      getMunicipalityResult:vi.fn(async(uf:string,code:string,office:ElectionOffice)=>{calls.push(`${office}:${uf}:${code}`);return result(`${office}:${uf}:${code}`);}),
      getEA14:vi.fn(async()=>({states:[],transport:{}})),
      getEA15:vi.fn(),
    } as unknown as TSE2026Provider;
    const states:Array<{phase:string;enabled:boolean}>=[];
    const persistResult=vi.fn(async()=>{});
    const persistMunicipalities=vi.fn(async()=>{});
    const persistState=vi.fn(async()=>{}),completeSyncBlock=vi.fn(async()=>{calls.push('SNAPSHOT:COMPLETE')});
    const service=new AutomaticSyncService(provider,'2026_SIMULATION',{persistResult,persistMunicipalities,persistState,completeSyncBlock,onState:state=>states.push(state)},60_000,1);

    await service.start();
    service.stop();

    expect(calls).toEqual([
      'PRESIDENT:BR','PRESIDENT:AC','GOVERNOR:AC',
      'PRESIDENT:AC:01120','GOVERNOR:AC:01120','PRESIDENT:BR','SNAPSHOT:COMPLETE',
    ]);
    expect(persistResult).toHaveBeenCalledTimes(6);
    expect(completeSyncBlock).toHaveBeenCalledOnce();
    expect(persistMunicipalities).toHaveBeenCalledTimes(2);
    expect(states.some(state=>state.phase==='POLLING'&&state.enabled)).toBe(true);
    expect(service.current.enabled).toBe(false);
  });

  it('continua a fila depois de uma falha isolada',async()=>{
    const provider={
      bootstrap:async()=>({}),getStates:async()=>['AC','SP'],
      getNationalResult:async()=>result('BR'),
      getStateResult:vi.fn(async(uf:string,office:ElectionOffice)=>{if(uf==='AC'&&office===ElectionOffice.PRESIDENT)throw new Error('rede');return result(uf);}),
      getMunicipalities:async()=>[],getMunicipalityResult:vi.fn(),
      getEA14:async()=>({states:[],transport:{}}),getEA15:vi.fn(),
    } as unknown as TSE2026Provider;
    const service=new AutomaticSyncService(provider,'2026_SIMULATION',{persistResult:async()=>{},persistMunicipalities:async()=>{},persistState:async()=>{},completeSyncBlock:async()=>{},onState:()=>{}},60_000,1);
    await service.start();
    expect(provider.getStateResult).toHaveBeenCalledTimes(4);
    service.stop();
  });
});
