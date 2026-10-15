export type SectionMatchMethod='EXACT'|'AGGREGATED'|'LOCAL_MATCH'|'APPROXIMATE'|'UNMATCHED';
export type SectionTallyStatus='PENDING'|'AUXILIARY_AVAILABLE'|'COUNTED_CONFIRMED'|'UNCERTAIN'|'NOT_COUNTED'|'ANNULLED';
export type SectionEvidence='EA16'|'EA18'|'EA20'|'EA16_EA20'|'HISTORICAL_IMPORT';

export interface SectionIdentity {
  electionId:string;
  pollId:string|null;
  round:number;
  officeCode:string;
  uf:string;
  municipalityCode:string;
  zone:string;
  section:string;
}

export const sectionIdentityKey=(value:SectionIdentity)=>[
  value.electionId,value.pollId??'-',value.round,value.officeCode,value.uf.toUpperCase(),
  value.municipalityCode.padStart(5,'0'),value.zone.padStart(4,'0'),value.section.padStart(4,'0'),
].join(':');

export interface ElectionSection extends SectionIdentity {
  key:string;
  mainSection:string|null;
  aggregatedSections:string[];
  votingPlaceId:string|null;
  electorate:number|null;
  metadata:Record<string,unknown>|null;
  sourceManifestId:string|null;
}

export interface HistoricalCandidateVote {
  candidateId:string|null;
  number:string|null;
  name:string|null;
  party:string|null;
  voteDestination:string|null;
  votes:number|null;
}

export interface SectionHistoricalVotes extends SectionIdentity {
  key:string;
  sectionKey:string;
  ptVotes:number|null;
  plVotes:number|null;
  otherVotes:number|null;
  electorate:number|null;
  turnout:number|null;
  abstention:number|null;
  validVotes:number|null;
  blankVotes:number|null;
  nullVotes:number|null;
  candidates:HistoricalCandidateVote[];
  isFinalHistorical:boolean;
  sourceManifestId:string;
}

export interface SectionRoundMatch {
  key:string;
  historicalSectionKey:string|null;
  currentSectionKey:string;
  method:SectionMatchMethod;
  quality:number|null;
  notes:string|null;
  updatedAt:string;
}

export interface SectionTallyState extends SectionIdentity {
  key:string;
  sectionKey:string;
  status:SectionTallyStatus;
  evidence:SectionEvidence;
  confidence:number;
  sourceGeneratedAt:string|null;
  firstObservedAt:string;
  lastObservedAt:string;
  auxiliaryDate:string|null;
  auxiliaryTime:string|null;
}

export interface SectionTallyEvent {
  id:string;
  sectionKey:string;
  previousStatus:SectionTallyStatus|null;
  status:SectionTallyStatus;
  evidence:SectionEvidence;
  observedAt:string;
  sourceGeneratedAt:string|null;
}

export interface GeographicPartitionDescriptor {
  id:string;
  uf:string;
  municipalityCode:string;
  path:string;
  sha256:string;
  bytes:number;
  sections:number;
  historicalVotes:number;
}

export interface GeographicImportManifest {
  id:string;
  schemaVersion:'eleicoes-fast-geographic-v1';
  generatedAt:string;
  electionId:string;
  pollId:string|null;
  round:1;
  officeCode:string;
  sourceUrl:string|null;
  sourceRetrievedAt:string|null;
  sourceSha256:string|null;
  sourceVersion:string|null;
  finalHistoricalResult:true;
  resources?:Array<{uf:string;url:string;sha256:string;version:string|null;candidateDestinationUrl?:string|null}>;
  partitions:GeographicPartitionDescriptor[];
  totals:{sections:number;historicalVotes:number;municipalities:number;ufs:number};
}

export interface GeographicPartition {
  schemaVersion:'eleicoes-fast-geographic-v1';
  manifestId:string;
  electionId:string;
  pollId:string|null;
  round:1;
  officeCode:string;
  uf:string;
  municipalityCode:string;
  sections:ElectionSection[];
  historicalVotes:SectionHistoricalVotes[];
}

export interface SectionReconciliation {
  municipalityKey:string;
  ea16Available:number;
  ea20Counted:number|null;
  difference:number|null;
  reconciled:boolean;
  observedAt:string;
}
