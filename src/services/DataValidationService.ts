import {ElectionOffice} from '../election/normalized/ElectionOffice';
import {HistoricalValidVotes2022,type HistoricalMunicipalityIdentity} from '../projection/history/HistoricalValidVotes2022';
import type {Municipality,TSEElectionProvider} from '../tse/providers/TSEElectionProvider';

export type DataValidationIssueKind='TSE_CODE_CHANGED'|'MISSING_HISTORY'|'MISSING_TSE'|'NAME_MATCH_ONLY';
export interface DataValidationIssue {kind:DataValidationIssueKind;uf:string;current:Municipality|null;historical:HistoricalMunicipalityIdentity|null}
export interface DataValidationReport {checkedAt:string;currentCount:number;historicalCount:number;exactMatches:number;ibgeMatches:number;issues:DataValidationIssue[];municipalities:Municipality[]}

export class DataValidationService {
  constructor(private history=new HistoricalValidVotes2022()){}

  async run(provider:Pick<TSEElectionProvider,'getStates'|'getMunicipalities'>):Promise<DataValidationReport>{
    const states=await provider.getStates();
    const lists=await Promise.all(states.map(uf=>provider.getMunicipalities(uf,ElectionOffice.PRESIDENT)));
    const municipalities=lists.flat();
    const historical=this.history.municipalities();
    const historicalByCode=new Map(historical.map(item=>[codeKey(item.uf,item.tseCode),item]));
    const historicalByIbge=groupBy(historical,item=>ibgeKey(item.uf,item.ibgeCode));
    const historicalByName=groupBy(historical,item=>nameKey(item.uf,item.name));
    const currentByCode=new Map(municipalities.map(item=>[codeKey(item.uf,item.code),item]));
    const currentByIbge=groupBy(municipalities.filter(item=>item.ibgeCode!==null),item=>ibgeKey(item.uf,item.ibgeCode!));
    const issues:DataValidationIssue[]=[];
    let exactMatches=0,ibgeMatches=0;

    for(const current of municipalities){
      if(historicalByCode.has(codeKey(current.uf,current.code))){exactMatches++;continue;}
      const ibge=single(historicalByIbge.get(ibgeKey(current.uf,current.ibgeCode)));
      if(ibge){ibgeMatches++;issues.push({kind:'TSE_CODE_CHANGED',uf:current.uf,current,historical:ibge});continue;}
      const byName=single(historicalByName.get(nameKey(current.uf,current.name)));
      issues.push({kind:byName?'NAME_MATCH_ONLY':'MISSING_HISTORY',uf:current.uf,current,historical:byName??null});
    }
    for(const item of historical){
      if(currentByCode.has(codeKey(item.uf,item.tseCode)))continue;
      if(single(currentByIbge.get(ibgeKey(item.uf,item.ibgeCode))))continue;
      issues.push({kind:'MISSING_TSE',uf:item.uf,current:null,historical:item});
    }
    return{checkedAt:new Date().toISOString(),currentCount:municipalities.length,historicalCount:historical.length,exactMatches,ibgeMatches,issues,municipalities};
  }
}

function groupBy<T>(items:T[],key:(item:T)=>string){const map=new Map<string,T[]>();for(const item of items){const value=key(item),list=map.get(value)??[];list.push(item);map.set(value,list)}return map}
function single<T>(items:T[]|undefined){return items?.length===1?items[0]:null}
function codeKey(uf:string,code:string){return`${uf.toUpperCase()}:${String(code).padStart(5,'0')}`}
function ibgeKey(uf:string,code:string|null){return code?`${uf.toUpperCase()}:${code}`:''}
function nameKey(uf:string,name:string){return`${uf.toUpperCase()}:${name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase()}`}
