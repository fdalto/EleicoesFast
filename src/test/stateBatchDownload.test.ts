import {describe,expect,it,vi} from 'vitest';
import {downloadStatesInQueue} from '../services/StateBatchDownload';
import {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {ProviderResult,TSEElectionProvider} from '../tse/providers/TSEElectionProvider';

describe('download estadual em fila',()=>{
 it('aguarda cada gravação, filtra BR/ZZ, remove duplicadas e continua após falha',async()=>{
  const events:string[]=[];
  const getStateResult=vi.fn(async(uf:string,office:ElectionOffice)=>{
   expect(office).toBe(ElectionOffice.PRESIDENT);events.push('fetch '+uf);
   if(uf==='RJ')throw new Error('rede');
   return {normalized:{uf}} as ProviderResult;
  });
  const provider={getStates:async()=>['SP','BR','AC','ZZ','RJ','SP'],getStateResult} as unknown as TSEElectionProvider;
  const persist=async(r:ProviderResult)=>{await Promise.resolve();events.push('save '+r.normalized.uf)};
  const progress=vi.fn();
  const result=await downloadStatesInQueue(provider,ElectionOffice.PRESIDENT,['AC','RJ','SP'],persist,progress);
  expect(events).toEqual(['fetch AC','save AC','fetch RJ','fetch SP','save SP']);
  expect(result).toEqual({total:3,completed:3,saved:2,current:null,errors:[{uf:'RJ',message:'rede'}]});
  expect(progress.mock.calls[0][0].completed).toBe(0);
 });
 it('conta falha de persistência e rejeita inventário vazio',async()=>{
  const provider={getStates:async()=>['AC'],getStateResult:async()=>({} as ProviderResult)} as unknown as TSEElectionProvider;
  const result=await downloadStatesInQueue(provider,ElectionOffice.SENATOR,['AC'],async()=>{throw new Error('storage')},()=>{});
  expect(result.saved).toBe(0);expect(result.errors[0].message).toBe('storage');
  await expect(downloadStatesInQueue(provider,ElectionOffice.SENATOR,[],async()=>{},()=>{})).rejects.toThrow('Nenhuma UF');
 });
});
