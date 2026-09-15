import { ElectionOffice } from '../normalized/ElectionOffice';
export const ElectionOfficeRules={
 getVoteSemantics:(office:ElectionOffice)=>office===ElectionOffice.SENATOR?'Cada eleitor pode ter mais de um voto conforme as vagas do pleito.':'Um voto por eleitor.',
 getSeatsAvailable:(office:ElectionOffice,documented?:number|null)=>documented??(office===ElectionOffice.SENATOR?null:1),
 supportsMultipleVotesPerElector:(office:ElectionOffice)=>office===ElectionOffice.SENATOR
};
