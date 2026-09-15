export interface EA11Office { cd: string; ds?: string; tp?: string }
export interface EA11MunicipalityRef { cd: string; cdi?: string }
export interface EA11Coverage { cd: string; cp?: EA11Office[]; mu?: EA11MunicipalityRef[] }
export interface EA11Election { cd: string; cdt2?: string; nm?: string; t: string; tp: string; abr?: EA11Coverage[] }
export interface EA11Poll { cd: string; c?: string; e?: EA11Election[] }
export interface EA11Directory { tp: string; dir: string }
export interface EA11Config { c?: string; pl?: EA11Poll[]; arq?: EA11Directory[]; dg?: string; hg?: string }

export interface DiscoveredElection2026 {
  cycle: string;
  pollId: string;
  round: number;
  federalElectionId: string;
  stateElectionId: string;
  federalStates: string[];
  stateStates: string[];
  directories: EA11Directory[];
  raw: EA11Config;
}
