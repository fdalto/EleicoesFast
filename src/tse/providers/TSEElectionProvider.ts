import type { ElectionOffice } from '../../election/normalized/ElectionOffice';
import type { NormalizedElectionResult } from '../../election/normalized/ElectionResult';
import type { TransportResponse } from '../transport/TSETransport';
export interface Municipality {code:string;ibgeCode:string|null;name:string;uf:string}
export interface ProviderResult {raw:unknown;transport:TransportResponse;normalized:NormalizedElectionResult}
export interface TSEElectionProvider {readonly id:string;discoverElection(office:ElectionOffice):Promise<string>;getStates():Promise<string[]>;getMunicipalities(uf:string,office:ElectionOffice):Promise<Municipality[]>;getNationalResult(office:ElectionOffice):Promise<ProviderResult>;getStateResult(uf:string,office:ElectionOffice):Promise<ProviderResult>;getMunicipalityResult(uf:string,municipalityCode:string,office:ElectionOffice):Promise<ProviderResult>;checkUpdates():Promise<string[]>}
