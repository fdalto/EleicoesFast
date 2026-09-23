import type {ElectionOffice} from '../election/normalized/ElectionOffice';

export interface CandidateIdentity {
  id:string;
  electionId:string;
  round:number;
  office:ElectionOffice;
  candidateId:string;
  name:string;
  party:string|null;
  color:string;
  photoDataUrl:string|null;
  updatedAt:string;
}

export function candidateIdentityKey(electionId:string,round:number,office:ElectionOffice,candidateId:string){
  return `${electionId}:${round}:${office}:${candidateId}`;
}

export function candidateResultId(candidate:{id:string|null;number:string|null;name:string|null;sequence:string|null}){
  return candidate.id??candidate.number??candidate.name??`candidate-${candidate.sequence??'unknown'}`;
}
