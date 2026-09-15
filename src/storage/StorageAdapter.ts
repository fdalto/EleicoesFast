import type { NormalizedElectionResult } from '../election/normalized/ElectionResult';
export interface RawFileRecord {key:string;provider:string;url:string;raw:unknown;fetchedAt:string;lastChecked:string;etag:string|null;lastModified:string|null;status:number;bytes:number}
export interface StorageAdapter {saveResult(raw:RawFileRecord,result:NormalizedElectionResult):Promise<void>;getRaw(key:string):Promise<RawFileRecord|undefined>;count():Promise<{rawFiles:number;results:number;municipalities:number}>;clear():Promise<void>}
