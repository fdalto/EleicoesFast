import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it} from 'vitest';
import {IndexedDBStorage} from '../storage/IndexedDBStorage';
import {sectionIdentityKey,type GeographicImportManifest,type GeographicPartition} from '../geographic/GeographicModels';
import {ElectionOffice} from '../election/normalized/ElectionOffice';

let storage:IndexedDBStorage|undefined;
afterEach(async()=>{if(storage){storage.close();await storage.delete();storage=undefined}});

describe('storage geográfico v6',()=>{
  it('importa idempotentemente, pareia por chave territorial e reconcilia EA16/EA20',async()=>{
    storage=new IndexedDBStorage();await storage.open();
    const historicalIdentity={electionId:'6257',pollId:'406',round:1,officeCode:'0001',uf:'SP',municipalityCode:'00123',zone:'0007',section:'0009'},historicalKey=sectionIdentityKey(historicalIdentity);
    const manifest:GeographicImportManifest={id:'m1',schemaVersion:'eleicoes-fast-geographic-v1',generatedAt:'2026-10-12T12:00:00Z',electionId:'6257',pollId:'406',round:1,officeCode:'0001',sourceUrl:null,sourceRetrievedAt:null,sourceSha256:null,sourceVersion:null,finalHistoricalResult:true,partitions:[],totals:{sections:1,historicalVotes:1,municipalities:1,ufs:1}};
    const partition:GeographicPartition={schemaVersion:'eleicoes-fast-geographic-v1',manifestId:'m1',electionId:'6257',pollId:'406',round:1,officeCode:'0001',uf:'SP',municipalityCode:'00123',sections:[{...historicalIdentity,key:historicalKey,mainSection:'0009',aggregatedSections:[],votingPlaceId:null,electorate:300,metadata:null,sourceManifestId:'m1'}],historicalVotes:[{...historicalIdentity,key:historicalKey,sectionKey:historicalKey,ptVotes:100,plVotes:80,otherVotes:40,electorate:300,turnout:250,abstention:50,validVotes:220,blankVotes:10,nullVotes:20,candidates:[],isFinalHistorical:true,sourceManifestId:'m1'}]};
    await storage.importGeographicPartition(manifest,partition);await storage.importGeographicPartition(manifest,partition);
    expect(await storage.electionSections.count()).toBe(1);
    const currentIdentity={...historicalIdentity,electionId:'6258',round:2},currentKey=sectionIdentityKey(currentIdentity),observed='2026-10-25T20:00:00Z';
    await storage.mergeEA16([{...currentIdentity,key:currentKey,mainSection:'0009',aggregatedSections:[],votingPlaceId:null,electorate:300,metadata:null,sourceManifestId:null}],[{...currentIdentity,key:currentKey,sectionKey:currentKey,status:'AUXILIARY_AVAILABLE',evidence:'EA16',confidence:.7,sourceGeneratedAt:observed,firstObservedAt:observed,lastObservedAt:observed,auxiliaryDate:'25/10/2026',auxiliaryTime:'17:00:00'}]);
    expect(await storage.sectionRoundMatch.get(currentKey)).toMatchObject({method:'EXACT',historicalSectionKey:historicalKey});
    await storage.reconcileSectionTally({sourceVersion:'x',electionId:'6258',pollId:'406',round:2,office:ElectionOffice.PRESIDENT,officeCode:'0001',scope:'MUNICIPALITY',uf:'SP',municipalityCode:'00123',municipalityName:'Teste',totalSections:1,countedSections:1,pendingSections:0,countedSectionsPercentage:100,electorate:300,electorateCounted:300,turnout:250,abstention:50,totalVotes:250,validVotes:220,nominalVotes:220,blankVotes:10,nullVotes:20,candidates:[],sourceUrl:'u',tseGeneratedAt:observed,fetchedAt:observed,sourceId:null});
    expect(await storage.sectionTallyState.get(currentKey)).toMatchObject({status:'COUNTED_CONFIRMED',evidence:'EA16_EA20'});
    expect(await storage.sectionTallyEvents.where('sectionKey').equals(currentKey).count()).toBe(2);
  });
});
