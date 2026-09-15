import type {TSETransport,TransportResponse} from '../tse/transport/TSETransport';
import {parseAndDiscoverEA11} from '../tse/2026/parsers/EA11Parser';
import type {DiscoveredElection2026,EA11Config} from '../tse/2026/types/EA11';
import {RequestPriority} from '../tse/polling/RequestScheduler';
export interface DiscoveryResponse {discovery:DiscoveredElection2026;transport:TransportResponse<EA11Config>}
export class ElectionDiscoveryService {constructor(private transport:TSETransport){}bootstrapUrl(base:string,environment:string){return`${base.replace(/\/$/,'')}/${environment}/comum/config/ele-c.json`}async discover(base:string,environment:string,round=1,pollId?:string):Promise<DiscoveryResponse>{const transport=await this.transport.fetchJson<EA11Config>({url:this.bootstrapUrl(base,environment),priority:RequestPriority.CRITICAL});if(!transport.data)throw new Error('EA11 retornou resposta vazia');return{discovery:parseAndDiscoverEA11(transport.data,round,pollId),transport}}}
