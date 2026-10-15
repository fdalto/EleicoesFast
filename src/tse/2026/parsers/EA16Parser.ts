import {sectionIdentityKey,type ElectionSection,type SectionTallyState} from '../../../geographic/GeographicModels';

interface EA16Context {electionId:string;pollId:string|null;round:number;officeCode:string;fetchedAt:string}
export interface ParsedEA16 {sections:ElectionSection[];states:SectionTallyState[];generatedAt:string|null}

const text=(value:unknown)=>value===undefined||value===null||value===''?null:String(value);
const number=(value:unknown)=>{const parsed=Number(value);return value===undefined||value===null||value===''||!Number.isFinite(parsed)?null:parsed};
const array=(value:unknown)=>Array.isArray(value)?value:[];

export function parseEA16(raw:Record<string,unknown>,context:EA16Context):ParsedEA16 {
  const sections:ElectionSection[]=[];
  const states:SectionTallyState[]=[];
  const generatedDate=text(raw.dg),generatedTime=text(raw.hg);
  const generatedAt=generatedDate&&generatedTime?`${generatedDate} ${generatedTime}`:generatedDate;
  for(const coverage of array(raw.abr)){
    const a=coverage as Record<string,unknown>,uf=String(a.cd??a.cdabr??'').toUpperCase();
    for(const municipalityValue of array(a.mu)){
      const municipality=municipalityValue as Record<string,unknown>,municipalityRaw=text(municipality.cd);
      if(!uf||!municipalityRaw)continue;
      const municipalityCode=municipalityRaw.padStart(5,'0');
      for(const zoneValue of array(municipality.zon)){
        const zoneRecord=zoneValue as Record<string,unknown>,zoneRaw=text(zoneRecord.cd);
        if(!zoneRaw)continue;
        const zone=zoneRaw.padStart(4,'0');
        for(const sectionValue of array(zoneRecord.sec)){
          const source=sectionValue as Record<string,unknown>,sectionRaw=text(source.ns);
          if(!sectionRaw)continue;
          const section=sectionRaw.padStart(4,'0');
          const identity={electionId:context.electionId,pollId:context.pollId,round:context.round,officeCode:context.officeCode,uf,municipalityCode,zone,section};
          const key=sectionIdentityKey(identity),date=text(source.da),time=text(source.ha),available=Boolean(date||time);
          sections.push({...identity,key,mainSection:text(source.nsp)?.padStart(4,'0')??null,aggregatedSections:text(source.nsa)?.split(',').map(item=>item.trim().padStart(4,'0')).filter(Boolean)??[],votingPlaceId:null,electorate:number(source.e),metadata:{ea16:source},sourceManifestId:null});
          states.push({...identity,key,sectionKey:key,status:available?'AUXILIARY_AVAILABLE':'PENDING',evidence:'EA16',confidence:available?0.7:0.5,sourceGeneratedAt:generatedAt,firstObservedAt:context.fetchedAt,lastObservedAt:context.fetchedAt,auxiliaryDate:date,auxiliaryTime:time});
        }
      }
    }
  }
  return{sections,states,generatedAt};
}
