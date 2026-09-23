import{describe,expect,it}from'vitest';
import{candidateIdentityKey,candidateResultId}from'../candidates/CandidateIdentity';
import{ElectionOffice}from'../election/normalized/ElectionOffice';
import{territoryColor,type MapTerritory}from'../map/MapModels';

describe('identidade visual do candidato',()=>{
  it('separa a identidade por eleição, turno, cargo e candidato',()=>{
    expect(candidateIdentityKey('21270',1,ElectionOffice.PRESIDENT,'123')).toBe('21270:1:PRESIDENT:123');
    expect(candidateResultId({id:null,number:'12',name:'NOME',sequence:'1'})).toBe('12');
  });
  it('prioriza a cor cadastrada do líder no mapa',()=>{
    const territory:MapTerritory={id:'35',name:'SP',uf:'SP',scope:'UF',estimatedFinalValidVotes:100,countedPercentage:60,maturity:'TESTE',candidates:[{id:'A',number:'13',name:'A',party:'PT',observedVotes:60,observedPercentage:60,projectedVotes:60,projectedPercentage:60}]};
    expect(territoryColor(territory,new Map([['A','#0000ff']]))).toMatch(/^rgb\(0, 0, /);
  });
});
