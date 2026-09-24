import {ElectionOffice} from '../election/normalized/ElectionOffice';
import {IndexedDBStorage,type MunicipalSnapshotCaptureRecord,type SnapshotDelivery} from '../storage/IndexedDBStorage';
import type {SnapshotDirectoryHandle} from './AutomaticSnapshotService';

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

  constructor(private storage:IndexedDBStorage,private provider:string,private onCaptured:(capture:MunicipalSnapshotCaptureRecord)=>void){this.ready=this.storage.listMunicipalSnapshotCaptures(provider).then(captures=>this.tracker.restore(captures))}

  completeAfterMunicipalSync(directory:SnapshotDirectoryHandle|null,municipalFailures:string[]=[]){this.queue=this.queue.then(async()=>{await this.ready;const progress=await this.storage.municipalSnapshotProgress(this.provider);if(!progress.totalSections)return null;const observed=progress.countedSectionsPercentage;const milestone=this.tracker.next(observed);if(!milestone)return null;const capturedAt=new Date().toISOString(),id=makeId(),payload=await this.storage.buildMunicipalSnapshotPayload(this.provider,{id,capturedAt,observedMunicipalCoveragePercent:observed,municipalFailures,...milestone}),name=fileName(milestone.thresholdPercent,observed,capturedAt),delivery=await deliver(name,payload,directory),capture:MunicipalSnapshotCaptureRecord={id,provider:this.provider,fileName:name,thresholdPercent:milestone.thresholdPercent,observedMunicipalCoveragePercent:observed,capturedAt,resultCount:payload.records.length,expectedMunicipalities:payload.coverage.municipalitiesExpected,downloadedMunicipalities:payload.coverage.downloadedMunicipalities,countedSections:payload.aggregation.countedSections,totalSections:payload.aggregation.totalSections,validVotes:payload.aggregation.validVotes,municipalFailures,skippedThresholds:milestone.skippedThresholds,delivery};await this.storage.saveMunicipalSnapshotCapture(capture);this.tracker.commit(milestone);this.onCaptured(capture);return capture});return this.queue}

}

async function deliver(fileName:string,payload:unknown,directory:SnapshotDirectoryHandle|null):Promise<SnapshotDelivery>{const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});if(directory)try{const file=await directory.getFileHandle(fileName,{create:true}),writer=await file.createWritable();await writer.write(blob);await writer.close();return'folder'}catch{/* Falls back to the browser download when folder access expires. */}const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1_000);return'download'}
function fileName(threshold:number,observed:number,capturedAt:string){const real=observed.toFixed(2).replace('.', '_'),timestamp=capturedAt.replace(/[-:]/g,'').replace('.','_').replace('Z','Z');return`municipios_p${threshold}_real_p${real}_${timestamp}.json`}
function makeId(){return globalThis.crypto?.randomUUID?.()??`municipal-snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`}
