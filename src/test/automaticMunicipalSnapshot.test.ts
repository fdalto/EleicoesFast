import {describe,expect,it,vi} from 'vitest';
import {AutomaticMunicipalSnapshotService} from '../services/AutomaticMunicipalSnapshotService';

const payload={coverage:{municipalitiesExpected:2,downloadedMunicipalities:2},aggregation:{countedSections:25,totalSections:100,validVotes:900},records:[{key:'SP:1'},{key:'SP:2'}]};

describe('snapshot municipal automático',()=>{
  it('só calcula e salva ao fim de um lote municipal completo',async()=>{
    const storage={
      listMunicipalSnapshotCaptures:vi.fn(async()=>[]),
      municipalSnapshotProgress:vi.fn(async()=>({expectedMunicipalities:2,downloadedMunicipalities:2,coveragePercentage:100,totalSections:100,countedSections:25,countedSectionsPercentage:25,complete:true})),
      buildMunicipalSnapshotPayload:vi.fn(async()=>payload),
      saveMunicipalSnapshotCapture:vi.fn(async()=>{}),
    };
    const captured=vi.fn(),service=new AutomaticMunicipalSnapshotService(storage as never,'TSE',captured),directory={name:'snapshots',getFileHandle:async()=>({createWritable:async()=>({write:async()=>{},close:async()=>{}})})};
    await service.completeAfterMunicipalSync(directory);
    expect(storage.municipalSnapshotProgress).toHaveBeenCalledOnce();
    expect(storage.buildMunicipalSnapshotPayload).toHaveBeenCalledWith('TSE',expect.objectContaining({thresholdPercent:20,observedMunicipalCoveragePercent:25}));
    expect(captured).toHaveBeenCalledWith(expect.objectContaining({thresholdPercent:20,downloadedMunicipalities:2,countedSections:25,totalSections:100}));
  });

  it('salva um lote incompleto e registra a falha',async()=>{
    const storage={listMunicipalSnapshotCaptures:async()=>[],municipalSnapshotProgress:vi.fn(async()=>({expectedMunicipalities:2,downloadedMunicipalities:1,coveragePercentage:50,totalSections:50,countedSections:25,countedSectionsPercentage:50,complete:false})),buildMunicipalSnapshotPayload:vi.fn(async()=>payload),saveMunicipalSnapshotCapture:vi.fn(async()=>{})};
    const service=new AutomaticMunicipalSnapshotService(storage as never,'TSE',()=>{});
    const directory={name:'snapshots',getFileHandle:async()=>({createWritable:async()=>({write:async()=>{},close:async()=>{}})})};
    await service.completeAfterMunicipalSync(directory,['SP/12345 · EXEMPLO: erro de rede']);
    expect(storage.buildMunicipalSnapshotPayload).toHaveBeenCalledWith('TSE',expect.objectContaining({municipalFailures:['SP/12345 · EXEMPLO: erro de rede']}));
    expect(storage.saveMunicipalSnapshotCapture).toHaveBeenCalledWith(expect.objectContaining({municipalFailures:['SP/12345 · EXEMPLO: erro de rede']}));
  });
});
