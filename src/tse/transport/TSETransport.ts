export interface TransportRequest { url:string; etag?:string|null; lastModified?:string|null; timeoutMs?:number; signal?:AbortSignal; priority?:number }
export interface TransportResponse<T=unknown> { data:T|null; rawText:string|null; status:number; url:string; headers:Record<string,string>; bytes:number; latencyMs:number; notModified:boolean; fetchedAt:string }
export interface TSETransport { fetchJson<T=unknown>(request:TransportRequest):Promise<TransportResponse<T>> }
