import type {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {ProviderResult,TSEElectionProvider} from '../tse/providers/TSEElectionProvider';

export interface StateBatchProgress {
  total:number;
  completed:number;
  saved:number;
  current:string|null;
  errors:Array<{uf:string;message:string}>;
}

/** Each provider request still passes through the shared HTTP scheduler. */
export async function downloadStatesInQueue(
  provider:TSEElectionProvider,
  office:ElectionOffice,
  allowedStates:readonly string[],
  persist:(result:ProviderResult)=>Promise<void>,
  onProgress:(progress:StateBatchProgress)=>void,
):Promise<StateBatchProgress>{
  const available=await provider.getStates();
  const states=[...new Set(available.map(uf=>uf.toUpperCase()))].filter(uf=>allowedStates.includes(uf)).sort();
  if(!states.length)throw new Error('Nenhuma UF disponível para baixar neste ambiente.');
  const progress:StateBatchProgress={total:states.length,completed:0,saved:0,current:null,errors:[]};
  const publish=()=>onProgress({...progress,errors:[...progress.errors]});
  for(const uf of states){
    progress.current=uf;publish();
    try{await persist(await provider.getStateResult(uf,office));progress.saved++;}
    catch(error){progress.errors.push({uf,message:error instanceof Error?error.message:String(error)});}
    progress.completed++;publish();
  }
  progress.current=null;publish();
  return progress;
}
