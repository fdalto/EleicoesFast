import {ElectionOffice} from '../../election/normalized/ElectionOffice';
import type {ProviderResult} from '../providers/TSEElectionProvider';
import type {TSE2026Provider} from '../providers/TSE2026Provider';
import {automaticError,automaticLog} from '../../services/AutomaticDebugLog';

type Kind = 'federal' | 'state';
type PollingProvider = Pick<TSE2026Provider, 'getEA14' | 'getEA15' | 'getNationalResult' | 'getStateResult' | 'getMunicipalityResult'> & Partial<Pick<TSE2026Provider,'getEA16'>>;
export interface PollingCycleReport {checkedAt:string;changedStates:string[];changedMunicipalities:string[];updatedResults:number;errors:string[];geographicErrors:string[];municipalSnapshotReady:boolean;municipalFailures:string[]}
export interface PollingCoordinatorOptions {
  federalOffices?: ElectionOffice[];
  stateOffices?: ElectionOffice[];
  onActivity?: (message:string) => void;
  onEA16?: (result:Awaited<ReturnType<TSE2026Provider['getEA16']>>) => Promise<void> | void;
  collectEA16?: boolean;
}

export class TSE2026PollingCoordinator {
  private stateVersions = new Map<string, string>();
  private municipalityVersions = new Map<string, string>();
  private initialized = new Set<Kind>();
  private inFlight: Promise<PollingCycleReport> | null = null;

  constructor(
    private provider: PollingProvider,
    private onResult?: (result:ProviderResult) => Promise<void> | void,
    private options: PollingCoordinatorOptions = {},
  ) {}

  runCycle(): Promise<PollingCycleReport> {
    if (this.inFlight){automaticLog('Coordenador: reutilizando ciclo de polling ainda em andamento');return this.inFlight;}
    this.inFlight = this.executeCycle().finally(() => { this.inFlight = null; });
    return this.inFlight;
  }

  private async executeCycle(): Promise<PollingCycleReport> {
    const report: PollingCycleReport = {checkedAt:new Date().toISOString(),changedStates:[],changedMunicipalities:[],updatedResults:0,errors:[],geographicErrors:[],municipalSnapshotReady:true,municipalFailures:[]};
    automaticLog('Coordenador: consultando EA14 federal e estadual',{checkedAt:report.checkedAt});
    await Promise.all((['federal', 'state'] as const).map(kind => this.monitor(kind, report)));
    automaticLog('Coordenador: ciclo concluído',{changedStates:report.changedStates.length,changedMunicipalities:report.changedMunicipalities.length,updatedResults:report.updatedResults,errors:report.errors.length});
    return report;
  }

  private async monitor(kind: Kind, report: PollingCycleReport) {
    try {
      const ea14 = await this.provider.getEA14(kind);
      const changes = ea14.states.map(state => ({
        state, key: `${kind}:${state.uf}`, version: state.version ?? state.generatedAt ?? JSON.stringify(state.raw),
      }));
      if (!this.initialized.has(kind)) {
        for (const item of changes) this.stateVersions.set(item.key, item.version);
        this.initialized.add(kind);
        automaticLog('Coordenador: baseline EA14 registrado',{kind,states:changes.length});
        return;
      }
      const pending = changes.filter(item => this.stateVersions.get(item.key) !== item.version);
      automaticLog('Coordenador: EA14 analisado',{kind,states:changes.length,pending:pending.length});
      // The national result belongs to the federal cycle, not to each changed UF.
      const nationalSaved = kind !== 'federal' || pending.length === 0 ||
        await this.save(() => this.provider.getNationalResult(ElectionOffice.PRESIDENT), report, 'Atualização nacional, baixando…');
      for (const {state, key, version} of pending) {
        report.changedStates.push(key);
        const saved = await this.updateState(kind, state.uf, report);
        if (saved && nationalSaved) this.stateVersions.set(key, version);
      }
    } catch (error) { const message=error instanceof Error?error.message:String(error);automaticError('Coordenador: falha ao consultar EA14',error,{kind});report.errors.push(message);if(kind==='federal'){report.municipalSnapshotReady=false;report.municipalFailures.push(`Consulta federal do TSE: ${message}`)} }
  }

  private async save(job: () => Promise<ProviderResult>, report: PollingCycleReport, activity?:string): Promise<boolean> {
    try {
      if(activity)this.options.onActivity?.(activity);
      const result = await job();
      await this.onResult?.(result);
      report.updatedResults++;
      return true;
    } catch (error) {
      automaticError('Coordenador: falha ao baixar ou persistir resultado alterado',error,{activity});
      report.errors.push(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private async updateState(kind: Kind, uf: string, report: PollingCycleReport): Promise<boolean> {
    const offices = kind === 'federal'
      ? (this.options.federalOffices ?? [ElectionOffice.PRESIDENT])
      : (this.options.stateOffices ?? [ElectionOffice.GOVERNOR, ElectionOffice.SENATOR]);
    const saved = await Promise.all(offices.map(office => this.save(
      () => this.provider.getStateResult(uf, office), report, `Atualização na UF ${uf}, baixando ${office}…`,
    )));
    automaticLog('Coordenador: resultados estaduais processados',{kind,uf,offices:offices.length,saved:saved.filter(Boolean).length});
    let complete = saved.every(Boolean);
    if(kind==='federal'&&this.options.collectEA16&&this.provider.getEA16){
      try{this.options.onActivity?.(`Atualização na UF ${uf}, baixando inventário EA16…`);const geographic=await this.provider.getEA16(uf);await this.options.onEA16?.(geographic)}
      catch(error){const message=error instanceof Error?error.message:String(error);automaticError('Coordenador: EA16 indisponível; fluxo oficial continuará',error,{uf});report.geographicErrors.push(`${uf}: ${message}`)}
    }
    try {
      const ea15 = await this.provider.getEA15(uf, kind);
      automaticLog('Coordenador: EA15 recebido',{kind,uf,municipalities:ea15.municipalities.length});
      for (const municipality of ea15.municipalities) {
        const key = `${kind}:${uf}:${municipality.code}`;
        const version = municipality.version ?? municipality.generatedAt ?? JSON.stringify(municipality.raw);
        // First seen after the EA14 baseline is pending data, not a completed download.
        if (this.municipalityVersions.get(key) === version) continue;
        report.changedMunicipalities.push(key);
        const results = await Promise.all(offices.map(office => this.save(
          () => this.provider.getMunicipalityResult(uf, municipality.code, office), report,
          `Atualização no município ${uf}/${municipality.code}, baixando ${office}…`,
        )));
        if (results.every(Boolean)) this.municipalityVersions.set(key, version);
        else {complete = false;if(kind==='federal'){report.municipalSnapshotReady=false;report.municipalFailures.push(`${uf}/${municipality.code}: falha ao baixar resultado municipal de Presidente`);}}
      }
    } catch (error) {
      automaticError('Coordenador: falha ao consultar ou processar EA15',error,{kind,uf});
      report.errors.push(error instanceof Error ? error.message : String(error));
      complete = false;if(kind==='federal'){report.municipalSnapshotReady=false;report.municipalFailures.push(`${uf}: falha ao consultar a lista municipal do TSE`) }
    }
    return complete;
  }
}
