import {ElectionOffice} from '../election/normalized/ElectionOffice';
import {IndexedDBStorage,type MunicipalSnapshotCaptureRecord,type SnapshotDelivery} from '../storage/IndexedDBStorage';
import type {SnapshotDirectoryHandle} from './AutomaticSnapshotService';
import {automaticError,automaticLog} from './AutomaticDebugLog';

type Milestone={thresholdPercent:number;skippedThresholds:number[]};

export class MunicipalSnapshotMilestoneTracker {
  private nextThreshold=10;
  private latestObservedPercent=0;
  restore(captures:ReadonlyArray<Pick<MunicipalSnapshotCaptureRecord,'thresholdPercent'|'observedMunicipalCoveragePercent'>>){const latest=Math.max(0,...captures.map(capture=>capture.thresholdPercent));this.nextThreshold=Math.min(110,latest+10);this.latestObservedPercent=Math.max(0,...captures.map(capture=>capture.observedMunicipalCoveragePercent))}
  next(observedPercent:number):Milestone|null{if(observedPercent+1<this.latestObservedPercent){this.nextThreshold=10;this.latestObservedPercent=0}this.latestObservedPercent=Math.max(this.latestObservedPercent,observedPercent);const reached=Math.min(100,Math.floor(observedPercent/10)*10);if(reached<this.nextThreshold)return null;const skippedThresholds:number[]=[];for(let threshold=this.nextThreshold;threshold<reached;threshold+=10)skippedThresholds.push(threshold);return{thresholdPercent:reached,skippedThresholds}}
  commit(milestone:Milestone){this.nextThreshold=Math.min(110,milestone.thresholdPercent+10)}
}

export class AutomaticMunicipalSnapshotService {
  private tracker=new MunicipalSnapshotMilestoneTracker();
  private ready:Promise<void>;
  private queue=Promise.resolve<MunicipalSnapshotCaptureRecord|null>(null);
  private pending:{milestone:Milestone;observedMunicipalCoveragePercent:number}|null=null;

  constructor(private storage:IndexedDBStorage,private provider:string,private onCaptured:(capture:MunicipalSnapshotCaptureRecord)=>void){
    this.ready=this.storage.listMunicipalSnapshotCaptures(provider).then(captures=>{this.tracker.restore(captures);automaticLog('Snapshot municipal: histórico restaurado',{provider,captures:captures.length});});
  }

  completeAfterMunicipalSync(directory:SnapshotDirectoryHandle|null,municipalFailures:string[]=[]){
    return this.enqueue('ao consolidar snapshot municipal',async()=>{
      await this.ready;
      const progress=await this.storage.municipalSnapshotProgress(this.provider);
      if(!progress.totalSections){automaticLog('Snapshot municipal: ainda não há urnas totais para calcular o marco');return null;}
      const observed=progress.countedSectionsPercentage;
      automaticLog('Snapshot municipal: cobertura observada',{observed,countedSections:progress.countedSections,totalSections:progress.totalSections,municipalFailures:municipalFailures.length});
      const milestone=this.tracker.next(observed);
      if(!milestone)return null;
      if(!directory)throw new Error('Pasta de snapshots ausente durante o salvamento municipal');
      const capturedAt=new Date().toISOString(),id=makeId();
      automaticLog('Snapshot municipal: gerando arquivo',{thresholdPercent:milestone.thresholdPercent,observed,directory:directory.name});
      const payload=await this.storage.buildMunicipalSnapshotPayload(this.provider,{id,capturedAt,observedMunicipalCoveragePercent:observed,municipalFailures,...milestone});
      const name=fileName(milestone.thresholdPercent,observed,capturedAt),delivery=await deliver(name,payload,directory);
      const capture:MunicipalSnapshotCaptureRecord={id,provider:this.provider,fileName:name,thresholdPercent:milestone.thresholdPercent,observedMunicipalCoveragePercent:observed,capturedAt,resultCount:payload.records.length,expectedMunicipalities:payload.coverage.municipalitiesExpected,downloadedMunicipalities:payload.coverage.downloadedMunicipalities,countedSections:payload.aggregation.countedSections,totalSections:payload.aggregation.totalSections,validVotes:payload.aggregation.validVotes,municipalFailures,skippedThresholds:milestone.skippedThresholds,delivery};
      await this.storage.saveMunicipalSnapshotCapture(capture);
      this.tracker.commit(milestone);
      this.onCaptured(capture);
      automaticLog('Snapshot municipal: arquivo salvo e registro persistido',{fileName:name,delivery,records:payload.records.length});
      return capture;
    });
  }

  private enqueue(stage:string,action:()=>Promise<MunicipalSnapshotCaptureRecord|null>){
    this.queue=this.queue.catch(error=>{automaticError('Snapshot municipal: recuperando fila após falha anterior',error);return null;}).then(async()=>{
      try{return await action();}catch(error){automaticError(`Snapshot municipal: falha ${stage}; polling continuará`,error);return null;}
    });
    return this.queue;
  }

}

async function deliver(fileName:string,payload:unknown,directory:SnapshotDirectoryHandle):Promise<SnapshotDelivery>{const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});const file=await directory.getFileHandle(fileName,{create:true}),writer=await file.createWritable();await writer.write(blob);await writer.close();return'folder'}
function fileName(threshold:number,observed:number,capturedAt:string){const real=observed.toFixed(2).replace('.', '_'),timestamp=capturedAt.replace(/[-:]/g,'').replace('.','_').replace('Z','Z');return`municipios_p${threshold}_real_p${real}_${timestamp}.json`}
function makeId(){return globalThis.crypto?.randomUUID?.()??`municipal-snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`}
