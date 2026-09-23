import {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {AutomaticSyncRecord} from '../storage/IndexedDBStorage';
import {PollingManager} from '../tse/polling/PollingManager';
import {TSE2026PollingCoordinator} from '../tse/polling/TSE2026PollingCoordinator';
import type {TSE2026Provider} from '../tse/providers/TSE2026Provider';
import type {Municipality,ProviderResult} from '../tse/providers/TSEElectionProvider';

export type AutomaticSyncPhase = 'IDLE'|'PRESIDENT_STATES'|'GOVERNOR_STATES'|'LISTING_MUNICIPALITIES'|'MUNICIPAL_RESULTS'|'POLLING'|'STOPPED'|'ERROR';
export interface AutomaticSyncState {
  enabled:boolean;
  pollingEnabled:boolean;
  phase:AutomaticSyncPhase;
  message:string;
  total:number;
  completed:number;
  saved:number;
  errors:number;
  lastCheckedAt:string|null;
}
export interface AutomaticSyncDependencies {
  persistResult:(result:ProviderResult)=>Promise<void>;
  persistMunicipalities:(municipalities:Municipality[])=>Promise<unknown>;
  persistState:(state:AutomaticSyncRecord)=>Promise<unknown>;
  completeSyncBlock:()=>Promise<void>;
  onState:(state:AutomaticSyncState)=>void;
}

const INITIAL:AutomaticSyncState={enabled:false,pollingEnabled:false,phase:'IDLE',message:'Modo automático desligado',total:0,completed:0,saved:0,errors:0,lastCheckedAt:null};
const VALID_UF=/^[A-Z]{2}$/;

export class AutomaticSyncService {
  private state:AutomaticSyncState={...INITIAL};
  private polling?:PollingManager;
  private lastPublished=0;
  private run?:Promise<void>;
  private persistChain:Promise<unknown>=Promise.resolve();

  constructor(
    private provider:TSE2026Provider,
    private providerId:string,
    private dependencies:AutomaticSyncDependencies,
    private intervalMs=10_000,
    private workerCount=8,
  ){}

  get current(){return {...this.state}}

  start(){
    if(this.run)return this.run;
    this.state={...INITIAL,enabled:true,pollingEnabled:true,phase:'PRESIDENT_STATES',message:'Preparando configuração do TSE…'};
    this.publish(true);
    this.run=this.initialize().catch(error=>{
      if(!this.state.enabled)return;
      this.state={...this.state,enabled:false,pollingEnabled:false,phase:'ERROR',message:error instanceof Error?error.message:String(error),errors:this.state.errors+1};
      this.publish(true);
    }).finally(()=>{this.run=undefined});
    return this.run;
  }

  stop(){
    this.polling?.pause();
    this.polling=undefined;
    this.state={...this.state,enabled:false,pollingEnabled:false,phase:'STOPPED',message:'Modo automático desligado'};
    this.publish(true);
  }

  private async initialize(){
    await this.provider.bootstrap();
    if(!this.state.enabled)return;
    const states=(await this.provider.getStates()).filter(uf=>VALID_UF.test(uf));
    await this.syncStateResults(states,ElectionOffice.PRESIDENT,'PRESIDENT_STATES','Presidente');
    await this.syncStateResults(states,ElectionOffice.GOVERNOR,'GOVERNOR_STATES','Governador');
    if(!this.state.enabled)return;

    this.update({phase:'LISTING_MUNICIPALITIES',message:'Listando municípios das eleições federal e estadual…',total:states.length,completed:0,saved:0,errors:0},true);
    const tasks:Array<{uf:string;municipality:Municipality;office:ElectionOffice}> = [];
    for(const uf of states){
      if(!this.state.enabled)return;
      for(const office of [ElectionOffice.PRESIDENT,ElectionOffice.GOVERNOR]){
        try{
          const municipalities=await this.provider.getMunicipalities(uf,office);
          await this.dependencies.persistMunicipalities(municipalities);
          for(const municipality of municipalities)tasks.push({uf,municipality,office});
        }catch{this.state.errors++;}
      }
      this.state.completed++;
      this.state.message=`Municípios listados: ${uf}`;
      this.publish();
    }
    if(!this.state.enabled)return;
    await this.runQueue(tasks);
    if(!this.state.enabled)return;
    await this.refreshNationalAndCompleteBlock();
    if(!this.state.enabled)return;
    this.startPolling();
  }

  private async syncStateResults(states:string[],office:ElectionOffice,phase:AutomaticSyncPhase,label:string){
    const includesNational=office===ElectionOffice.PRESIDENT;
    this.update({phase,message:`Baixando ${label}: resultados por estado…`,total:states.length+(includesNational?1:0),completed:0,saved:0,errors:0},true);
    if(includesNational)await this.executeOne('Brasil',()=>this.provider.getNationalResult(office));
    for(const uf of states){
      if(!this.state.enabled)return;
      await this.executeOne(uf,()=>this.provider.getStateResult(uf,office));
    }
  }

  private async executeOne(territory:string,job:()=>Promise<ProviderResult>){
    this.state.message=`Baixando ${territory}…`;
    this.publish();
    try{await this.dependencies.persistResult(await job());this.state.saved++;}
    catch{this.state.errors++;}
    this.state.completed++;
    this.publish();
  }

  private async runQueue(tasks:Array<{uf:string;municipality:Municipality;office:ElectionOffice}>){
    this.update({phase:'MUNICIPAL_RESULTS',message:'Montando fila municipal…',total:tasks.length,completed:0,saved:0,errors:0},true);
    let index=0;
    const worker=async()=>{
      while(this.state.enabled){
        const task=tasks[index++];
        if(!task)return;
        this.state.message=`Baixando ${task.office} em ${task.municipality.name} (${task.uf})…`;
        this.publish();
        try{
          const result=await this.provider.getMunicipalityResult(task.uf,task.municipality.code,task.office);
          await this.dependencies.persistResult(result);
          this.state.saved++;
        }catch{this.state.errors++;}
        this.state.completed++;
        this.publish();
      }
    };
    await Promise.all(Array.from({length:Math.min(this.workerCount,tasks.length)},()=>worker()));
    this.publish(true);
  }

  private async refreshNationalAndCompleteBlock(){
    this.update({message:'Fila municipal concluída. Atualizando Brasil e consolidando snapshot…'},true);
    try{await this.dependencies.persistResult(await this.provider.getNationalResult(ElectionOffice.PRESIDENT));this.state.saved++;}
    catch{this.state.errors++;}
    await this.dependencies.completeSyncBlock();
  }

  private startPolling(){
    const coordinator=new TSE2026PollingCoordinator(
      this.provider,
      result=>this.dependencies.persistResult(result),
      {
        federalOffices:[ElectionOffice.PRESIDENT],
        stateOffices:[ElectionOffice.GOVERNOR],
        onActivity:message=>this.update({message}),
      },
    );
    this.update({phase:'POLLING',message:'Aguardando novas atualizações',total:0,completed:0,saved:0,errors:0},true);
    if(!this.state.enabled)return;
    this.polling=new PollingManager(async()=>{
      if(!this.state.enabled)return;
      this.update({message:'Verificando EA14 e EA15…'},true);
      const report=await coordinator.runCycle();
      await this.dependencies.completeSyncBlock();
      const updates=report.changedStates.length+report.changedMunicipalities.length;
      this.update({
        lastCheckedAt:report.checkedAt,
        saved:this.state.saved+report.updatedResults,
        errors:this.state.errors+report.errors.length,
        message:updates
          ? `Atualização concluída: ${report.changedStates.length} UFs e ${report.changedMunicipalities.length} municípios`
          : 'Aguardando novas atualizações',
      },true);
    },this.intervalMs);
    this.polling.start();
  }

  private update(change:Partial<AutomaticSyncState>,force=false){
    this.state={...this.state,...change};
    this.publish(force);
  }

  private publish(force=false){
    const now=Date.now();
    if(!force&&now-this.lastPublished<150)return;
    this.lastPublished=now;
    const snapshot={...this.state};
    this.dependencies.onState(snapshot);
    if(force||snapshot.completed%25===0){
      const record={id:'automatic-sync',provider:this.providerId,...snapshot,updatedAt:new Date().toISOString()};
      this.persistChain=this.persistChain.then(()=>this.dependencies.persistState(record)).catch(()=>undefined);
    }
  }
}

export const initialAutomaticSyncState=():AutomaticSyncState=>({...INITIAL});
