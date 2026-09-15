import {ElectionOffice,OFFICE_CODE} from '../../../election/normalized/ElectionOffice';
import type {DiscoveredElection2026,EA11Config,EA11Election,EA11Poll} from '../types/EA11';
export const ELECTION_2026_UNAVAILABLE='Eleição Geral 2026 ainda não disponível neste ambiente';
const hasOffice=(e:EA11Election,office:ElectionOffice)=>e.abr?.some(a=>a.cp?.some(c=>String(c.cd).padStart(4,'0')===OFFICE_CODE[office]))??false;
const findElection=(poll:EA11Poll,round:number,type:string,offices:ElectionOffice[])=>poll.e?.find(e=>Number(e.t)===round&&e.tp===type&&offices.every(o=>hasOffice(e,o)));
export function parseAndDiscoverEA11(raw:EA11Config,round=1,pollId?:string):DiscoveredElection2026 {
  const polls=(raw.pl??[]).filter(p=>!pollId||p.cd===pollId);
  for(const poll of polls){const federal=findElection(poll,round,'8',[ElectionOffice.PRESIDENT]);const state=findElection(poll,round,'1',[ElectionOffice.GOVERNOR,ElectionOffice.SENATOR]);if(!federal||!state)continue;const cycle=poll.c??raw.c;if(!cycle)throw new Error('EA11 não informou ciclo em pl[].c nem na raiz');const states=(e:EA11Election)=>[...new Set((e.abr??[]).map(a=>a.cd.toUpperCase()).filter(x=>x!=='BR'))];return{cycle,pollId:poll.cd,round,federalElectionId:federal.cd,stateElectionId:state.cd,federalStates:states(federal),stateStates:states(state),directories:raw.arq??[],raw}}
  throw new Error(ELECTION_2026_UNAVAILABLE);
}
