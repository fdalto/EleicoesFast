import type{CandidateResult}from'../../election/normalized/ElectionResult';

export function hasValidVoteDestination(candidate:Readonly<CandidateResult>){
  const destination=normalize(candidate.voteDestination);
  return !destination||!destination.includes('anulad');
}

function normalize(value:string|null|undefined){
  return value?.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim()??'';
}
