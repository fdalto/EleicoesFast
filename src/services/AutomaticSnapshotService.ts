import {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {NormalizedElectionResult} from '../election/normalized/ElectionResult';
import {IndexedDBStorage,type SnapshotCaptureRecord, type SnapshotDelivery} from '../storage/IndexedDBStorage';

export interface SnapshotDirectoryHandle {name:string;getFileHandle(name:string,options:{create:boolean}):Promise<{createWritable():Promise<{write(data:Blob):Promise<void>;close():Promise<void>}>}>}
type Milestone={thresholdPercent:number;skippedThresholds:number[]};

export class SnapshotMilestoneTracker {
  private nextThreshold=10;
  private latestObservedPercent=0;
  restore(captures:ReadonlyArray<Pick<SnapshotCaptureRecord,'thresholdPercent'|'observedNationalPercent'>>){const latest=Math.max(0,...captures.map(capture=>capture.thresholdPercent));this.nextThreshold=Math.min(110,latest+10);this.latestObservedPercent=Math.max(0,...captures.map(capture=>capture.observedNationalPercent))}
  next(observedPercent:number):Milestone|null{if(observedPercent+1<this.latestObservedPercent){this.nextThreshold=10;this.latestObservedPercent=0}this.latestObservedPercent=Math.max(this.latestObservedPercent,observedPercent);const reached=Math.min(100,Math.floor(observedPercent/10)*10);if(reached<this.nextThreshold)return null;const skippedThresholds:number[]=[];for(let threshold=this.nextThreshold;threshold<reached;threshold+=10)skippedThresholds.push(threshold);return{thresholdPercent:reached,skippedThresholds}}
  commit(milestone:Milestone){this.nextThreshold=Math.min(110,milestone.thresholdPercent+10)}
}

export class AutomaticSnapshotService {
  private tracker=new SnapshotMilestoneTracker();
  private ready:Promise<void>;
  private queue=Promise.resolve<SnapshotCaptureRecord|null>(null);
  private pending:{milestone:Milestone;observedNationalPercent:number}|null=null;

  constructor(private storage:IndexedDBStorage,private provider:string,private onCaptured:(capture:SnapshotCaptureRecord)=>void){this.ready=this.storage.listSnapshotCaptures(provider).then(captures=>this.tracker.restore(captures))}

  observeNational(result:NormalizedElectionResult){if(result.office!==ElectionOffice.PRESIDENT||result.scope!=='BRASIL'||result.countedSectionsPercentage===null)return Promise.resolve(null);this.queue=this.queue.then(async()=>{await this.ready;const observed=result.countedSectionsPercentage!;if(this.pending&&observed+1<this.pending.observedNationalPercent)this.pending=null;const milestone=this.tracker.next(observed);if(!milestone)return null;const pending=this.pending;if(!pending||milestone.thresholdPercent>=pending.milestone.thresholdPercent)this.pending={milestone,observedNationalPercent:observed};return null});return this.queue}
  completeAfterSync(directory:SnapshotDirectoryHandle|null){this.queue=this.queue.then(async()=>{await this.ready;const pending=this.pending;if(!pending)return null;this.pending=null;const capturedAt=new Date().toISOString(),id=makeId(),payload=await this.storage.buildSnapshotPayload(this.provider,{id,capturedAt,observedNationalPercent:pending.observedNationalPercent,...pending.milestone}),name=fileName(pending.milestone.thresholdPercent,pending.observedNationalPercent,capturedAt),delivery=await deliver(name,payload,directory),capture:SnapshotCaptureRecord={id,provider:this.provider,fileName:name,thresholdPercent:pending.milestone.thresholdPercent,observedNationalPercent:pending.observedNationalPercent,capturedAt,resultCount:payload.coverage.resultRecords,expectedMunicipalities:payload.coverage.municipalitiesExpected,presidentialMunicipalityResults:payload.coverage.presidentialMunicipalityResults,skippedThresholds:pending.milestone.skippedThresholds,delivery};await this.storage.saveSnapshotCapture(capture);this.tracker.commit(pending.milestone);this.onCaptured(capture);return capture});return this.queue}
}

export async function chooseSnapshotDirectory():Promise<SnapshotDirectoryHandle|null>{const picker=(window as unknown as{showDirectoryPicker?:()=>Promise<SnapshotDirectoryHandle>}).showDirectoryPicker;return picker?picker():null}

async function deliver(fileName:string,payload:unknown,directory:SnapshotDirectoryHandle|null):Promise<SnapshotDelivery>{const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});if(directory)try{const file=await directory.getFileHandle(fileName,{create:true}),writer=await file.createWritable();await writer.write(blob);await writer.close();return'folder'}catch{/* Falls back to the browser download when folder access expires. */}const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=fileName;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1_000);return'download'}
function fileName(threshold:number,observed:number,capturedAt:string){const real=observed.toFixed(2).replace('.', '_'),timestamp=capturedAt.replace(/[-:]/g,'').replace('.','_').replace('Z','Z');return`dados_p${threshold}_real_p${real}_${timestamp}.json`}
function makeId(){return globalThis.crypto?.randomUUID?.()??`snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`}
