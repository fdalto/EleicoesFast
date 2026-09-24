import {useEffect,useMemo,useRef,useState} from 'react';
import {CandidateIdentityPanel} from '../candidates/CandidateIdentityPanel';
import {ElectionOffice} from '../election/normalized/ElectionOffice';
import type {NormalizedElectionResult,ResultScope} from '../election/normalized/ElectionResult';
import {MapPage} from '../map/MapPage';
import {ProjectionPage} from '../projection/ui/ProjectionPage';
import {AutomaticSyncService,initialAutomaticSyncState,type AutomaticSyncState} from '../services/AutomaticSyncService';
import {AutomaticSnapshotService,chooseSnapshotDirectory,type SnapshotDirectoryHandle} from '../services/AutomaticSnapshotService';
import {AutomaticMunicipalSnapshotService} from '../services/AutomaticMunicipalSnapshotService';
import {CorsDiagnosticService,type CorsDiagnostic} from '../services/CorsDiagnosticService';
import {DataValidationService,type DataValidationReport} from '../services/DataValidationService';
import {IndexedDBStorage,type MunicipalSnapshotCaptureRecord,type SnapshotCaptureRecord} from '../storage/IndexedDBStorage';
import {RequestScheduler} from '../tse/polling/RequestScheduler';
import {TSE2022Provider} from '../tse/providers/TSE2022Provider';
import {TSE2026Provider} from '../tse/providers/TSE2026Provider';
import type {Municipality,ProviderResult} from '../tse/providers/TSEElectionProvider';
import {DirectTSETransport} from '../tse/transport/DirectTSETransport';
import {ScheduledTSETransport} from '../tse/transport/ScheduledTSETransport';
import type {TSETransport} from '../tse/transport/TSETransport';

type Area='OFFICIAL'|'PROJECTIONS'|'MAP'|'DEBUG';
type Profile='2022_OFFICIAL'|'2026_SIMULATION'|'2026_OFFICIAL';

export function App(){
  // 80 req/s is 20% below the 100 req/s limit published by the TSE.
  const scheduler=useMemo(()=>new RequestScheduler({maxRequestsPerSecond:80,maxConcurrentRequests:10}),[]);
  const transport=useMemo(()=>new ScheduledTSETransport(scheduler,new DirectTSETransport()),[scheduler]);
  const storage=useMemo(()=>new IndexedDBStorage(),[]);
  const [area,setArea]=useState<Area>('OFFICIAL');
  return <main>
    <AreaNavigation area={area} setArea={setArea}/>
    <div hidden={area!=='OFFICIAL'}><OfficialDashboard storage={storage} transport={transport}/></div>
    {area==='PROJECTIONS'&&<ProjectionPage storage={storage}/>}
    {area==='MAP'&&<MapPage storage={storage}/>}
    {area==='DEBUG'&&<DebugPage storage={storage}/>}
  </main>;
}

function AreaNavigation({area,setArea}:{area:Area;setArea:(area:Area)=>void}){
  return <nav className="area-nav">{([
    ['OFFICIAL','RESULTADO OFICIAL'],['PROJECTIONS','PROJEÇÕES'],['MAP','MAPA'],['DEBUG','DEBUG'],
  ] as const).map(([id,label])=><button key={id} className={area===id?'active':''} onClick={()=>setArea(id)}>{label}</button>)}</nav>;
}

function OfficialDashboard({storage,transport}:{storage:IndexedDBStorage;transport:TSETransport}){
  const [profile,setProfile]=useState<Profile>('2022_OFFICIAL');
  const [simulationBase,setSimulationBase]=useState('https://resultados-sim.tse.jus.br/simulado');
  const provider=useMemo(()=>profile==='2022_OFFICIAL'
    ? new TSE2022Provider(transport)
    : new TSE2026Provider(transport,{
      baseUrl:profile==='2026_OFFICIAL'?'https://resultados.tse.jus.br':simulationBase,
      environment:profile==='2026_OFFICIAL'?'oficial':'simulado2026',
    }),[profile,simulationBase,transport]);
  const [office,setOffice]=useState(ElectionOffice.PRESIDENT);
  const [uf,setUf]=useState('SP');
  const [scope,setScope]=useState<ResultScope>('UF');
  const [municipalities,setMunicipalities]=useState<Municipality[]>([]);
  const [municipalityCode,setMunicipalityCode]=useState('');
  const [result,setResult]=useState<NormalizedElectionResult|null>(null);
  const [raw,setRaw]=useState<unknown>(null);
  const [tab,setTab]=useState<'RESUMO'|'RAW JSON'|'NORMALIZADO'>('RESUMO');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [cors,setCors]=useState<CorsDiagnostic|null>(null);
  const [validation,setValidation]=useState<DataValidationReport|null>(null);
  const [showCandidateAssociation,setShowCandidateAssociation]=useState(false);
  const [logs,setLogs]=useState<Array<Record<string,unknown>>>([]);
  const [counts,setCounts]=useState({rawFiles:0,results:0,municipalities:0});
  const [discovery,setDiscovery]=useState('');
  const [liveOfficial,setLiveOfficial]=useState<NormalizedElectionResult|null>(null);
  const [automatic,setAutomatic]=useState<AutomaticSyncState>(initialAutomaticSyncState);
  const automaticRef=useRef<AutomaticSyncService|null>(null);
  const snapshotRef=useRef<AutomaticSnapshotService|null>(null);
  const municipalSnapshotRef=useRef<AutomaticMunicipalSnapshotService|null>(null);
  const [snapshotDirectory,setSnapshotDirectory]=useState<SnapshotDirectoryHandle|null>(null);
  const [snapshots,setSnapshots]=useState<SnapshotCaptureRecord[]>([]);
  const [municipalSnapshots,setMunicipalSnapshots]=useState<MunicipalSnapshotCaptureRecord[]>([]);

  useEffect(()=>{
    setAutomatic(initialAutomaticSyncState());
    setDiscovery('');setValidation(null);setShowCandidateAssociation(false);
    setSnapshotDirectory(null);
    snapshotRef.current=new AutomaticSnapshotService(storage,provider.id,capture=>setSnapshots(current=>[...current.filter(item=>item.id!==capture.id),capture].sort((a,b)=>a.thresholdPercent-b.thresholdPercent)));
    municipalSnapshotRef.current=new AutomaticMunicipalSnapshotService(storage,provider.id,capture=>setMunicipalSnapshots(current=>[...current.filter(item=>item.id!==capture.id),capture].sort((a,b)=>a.thresholdPercent-b.thresholdPercent)));
    void storage.listSnapshotCaptures(provider.id).then(setSnapshots);
    void storage.listMunicipalSnapshotCaptures(provider.id).then(setMunicipalSnapshots);
    void loadLiveOfficial();
    return ()=>{automaticRef.current?.stop();automaticRef.current=null;};
  },[provider,storage]);

  async function loadLiveOfficial(){
    const [rawFiles,results]=await Promise.all([storage.rawFiles.where('provider').equals(provider.id).toArray(),storage.results.toArray()]);
    const keys=new Set(rawFiles.map(file=>file.key));
    const national=results
      .filter(item=>keys.has(item.key)&&item.office===ElectionOffice.PRESIDENT&&item.scope==='BRASIL')
      .sort((a,b)=>b.fetchedAt.localeCompare(a.fetchedAt))[0]??null;
    setLiveOfficial(national);
  }

  async function run(action:()=>Promise<void>){
    setBusy(true);setError('');
    try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }

  async function bootstrap(){
    await run(async()=>{
      if(profile==='2026_SIMULATION'&&!simulationBase)throw new Error('Informe a URL base publicada pelo TSE para o simulado');
      const federal=await provider.discoverElection(ElectionOffice.PRESIDENT);
      const state=await provider.discoverElection(ElectionOffice.GOVERNOR);
      setDiscovery(`Federal ${federal} · Estadual ${state}`);
    });
  }

  async function loadMunicipalities(){
    await run(async()=>{
      const list=await provider.getMunicipalities(uf,office);
      await storage.saveMunicipalities(list);
      setMunicipalities(list);
      setMunicipalityCode(list[0]?.code??'');
    });
  }

  function rawRecord(r:ProviderResult){
    const key=`${provider.id}:${r.transport.url}`;
    return {key,provider:provider.id,url:r.transport.url,raw:r.raw,fetchedAt:r.transport.fetchedAt,lastChecked:r.transport.fetchedAt,etag:r.transport.headers.etag??null,lastModified:r.transport.headers['last-modified']??null,status:r.transport.status,bytes:r.transport.bytes};
  }

  async function persist(r:ProviderResult,display=true){
    if(display){setResult(r.normalized);setRaw(r.raw);}
    await storage.saveResult(rawRecord(r),r.normalized);
    if(r.normalized.office===ElectionOffice.PRESIDENT&&r.normalized.scope==='BRASIL')setLiveOfficial(r.normalized);
    setLogs(current=>[{timestamp:r.transport.fetchedAt,url:r.transport.url,status:r.transport.status,bytes:r.transport.bytes},...current].slice(0,200));
    setCounts(await storage.count());
  }

  async function persistAutomatic(r:ProviderResult){
    // URL/provider is the stable key: updates replace the current value consumed by projections and maps.
    await storage.saveResult(rawRecord(r),r.normalized);
    if(r.normalized.office===ElectionOffice.PRESIDENT&&r.normalized.scope==='BRASIL')setLiveOfficial(r.normalized);
    await snapshotRef.current?.observeNational(r.normalized);
  }

  async function selectSnapshotDirectory(){
    try{const directory=await chooseSnapshotDirectory();if(directory)setSnapshotDirectory(directory);else setError('Este navegador não permite escolher uma pasta. Os snapshots serão baixados pelo navegador.');}
    catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;setError(error instanceof Error?error.message:String(error));}
  }

  async function load(){
    await run(async()=>persist(scope==='BRASIL'
      ? await provider.getNationalResult(office)
      : scope==='UF'
        ? await provider.getStateResult(uf,office)
        : await provider.getMunicipalityResult(uf,municipalityCode,office)));
  }

  async function validateData(){
    await run(async()=>{
      const report=await new DataValidationService().run(provider);
      await storage.saveMunicipalities(report.municipalities);
      setValidation(report);
      setCounts(await storage.count());
    });
  }

  function toggleAutomatic(){
    if(automatic.enabled){automaticRef.current?.stop();return;}
    if(!(provider instanceof TSE2026Provider)){
      setError('O modo automático está disponível para os perfis 2026.');
      return;
    }
    setError('');
    const service=new AutomaticSyncService(provider,provider.id,{
      persistResult:persistAutomatic,
      persistMunicipalities:list=>storage.saveMunicipalities(list),
      persistState:state=>storage.saveAutomaticSyncState(state),
      completeSyncBlock:async municipalFailures=>{await snapshotRef.current?.completeAfterSync(snapshotDirectory);await municipalSnapshotRef.current?.completeAfterMunicipalSync(snapshotDirectory,municipalFailures);},
      onState:state=>{
        setAutomatic(state);
        if(state.phase==='POLLING'||(state.total>0&&state.completed===state.total))void storage.count().then(setCounts);
      },
    });
    automaticRef.current=service;
    void service.start();
  }

  const controlsDisabled=busy||automatic.enabled;
  return <>
    <header><div><span className="eyebrow">TSE · RESULTADOS OFICIAIS</span><h1>Eleições Fast</h1><p>Coleta técnica, normalização e armazenamento local.</p></div><span className="badge">{profile.replace('_',' ')}</span></header>
    <section className="status"><Stat label="CORS" value={cors?.success?'Liberado':cors?'Falhou':'Não testado'}/><Stat label="Configuração" value={discovery||'Não carregada'}/><Stat label="Arquivos" value={String(counts.rawFiles)}/><Stat label="Respostas 200" value={String(logs.filter(x=>x.status===200).length)}/></section>
    <section className="panel controls">
      <h2>Consulta oficial</h2>
      <div className="official-query-layout">
      <fieldset disabled={controlsDisabled} style={{border:0,padding:0,margin:0}}>
        <div className="grid">
          <label>Provider<select value={profile} onChange={e=>setProfile(e.target.value as Profile)}><option value="2022_OFFICIAL">2022 Official</option><option value="2026_SIMULATION">2026 Simulation</option><option value="2026_OFFICIAL">2026 Official</option></select></label>
          <label>Cargo<select value={office} onChange={e=>setOffice(e.target.value as ElectionOffice)}>{Object.values(ElectionOffice).map(value=><option key={value}>{value}</option>)}</select></label>
          <label>Abrangência<select value={scope} onChange={e=>setScope(e.target.value as ResultScope)}><option value="BRASIL">Brasil</option><option value="UF">UF</option><option value="MUNICIPALITY">Município</option></select></label>
          <label>UF<select value={uf} disabled={scope==='BRASIL'} onChange={e=>setUf(e.target.value)}>{UFS.map(value=><option key={value}>{value}</option>)}</select></label>
          {profile==='2026_SIMULATION'&&<label>URL do simulado<input value={simulationBase} onChange={e=>setSimulationBase(e.target.value)}/></label>}
          {scope==='MUNICIPALITY'&&<label>Município<select value={municipalityCode} onChange={e=>setMunicipalityCode(e.target.value)}><option value="">Carregue o EA12…</option>{municipalities.map(m=><option value={m.code} key={m.code}>{m.name}</option>)}</select></label>}
        </div>
        <div className="actions">
          <button onClick={bootstrap}>Carregar configuração</button>
          {scope==='MUNICIPALITY'&&<button className="secondary" onClick={loadMunicipalities}>Carregar municípios</button>}
          <button onClick={load} disabled={busy||scope==='MUNICIPALITY'&&!municipalityCode}>{busy?'Aguarde…':'Carregar resultado'}</button>
        </div>
        <div className="actions official-actions-secondary">
          <button className="secondary" onClick={()=>run(async()=>setCors(await new CorsDiagnosticService(transport).run(profile==='2026_SIMULATION'?simulationBase.replace(/\/$/,'')+'/simulado2026/comum/config/ele-c.json':undefined)))}>Diagnóstico CORS</button>
          {profile!=='2022_OFFICIAL'&&<button className="secondary" onClick={validateData} disabled={controlsDisabled||!discovery}>Validação dos dados</button>}
          {validation&&discovery&&<button className="secondary" onClick={()=>setShowCandidateAssociation(value=>!value)}>{showCandidateAssociation?'Fechar associação':'Associar Candidatos'}</button>}
        </div>
      </fieldset>
      <OfficialProgressBox result={liveOfficial}/>
      </div>
      {profile!=='2022_OFFICIAL'&&<AutomaticMode state={automatic} onToggle={toggleAutomatic} onChooseDirectory={selectSnapshotDirectory} directoryName={snapshotDirectory?.name??null} snapshots={snapshots} municipalSnapshots={municipalSnapshots}/>}
      {error&&<p className="error">{error}</p>}
    </section>
    {validation&&<DataValidationPanel report={validation}/>}
    {showCandidateAssociation&&<CandidateIdentityPanel storage={storage}/>}
    <section className="panel"><nav>{(['RESUMO','RAW JSON','NORMALIZADO'] as const).map(value=><button className={tab===value?'active':''} onClick={()=>setTab(value)} key={value}>{value}</button>)}</nav>{tab==='RESUMO'&&<Summary result={result}/>} {tab==='RAW JSON'&&<pre>{raw?JSON.stringify(raw,null,2):'Nenhum arquivo.'}</pre>}{tab==='NORMALIZADO'&&<pre>{result?JSON.stringify(result,null,2):'Nenhum resultado.'}</pre>}</section>
  </>;
}

function DataValidationPanel({report}:{report:DataValidationReport}){return <section className="panel validation-panel"><header><div><span className="eyebrow">EA12 DO TSE × BASE HISTÓRICA 2022</span><h2>Validação dos dados</h2><p>Executada às {new Date(report.checkedAt).toLocaleTimeString('pt-BR')} · códigos TSE e IBGE são comparados antes de qualquer estimativa.</p></div><span className={`badge ${report.issues.length?'validation-badge-warning':''}`}>{report.issues.length?`${report.issues.length} PENDÊNCIAS`:'CADASTRO CONSISTENTE'}</span></header><div className="validation-stats"><Stat label="Municípios no TSE" value={String(report.currentCount)}/><Stat label="Base histórica" value={String(report.historicalCount)}/><Stat label="Código TSE igual" value={String(report.exactMatches)}/><Stat label="IBGE conciliado" value={String(report.ibgeMatches)}/></div>{report.issues.length===0?<p className="note">Nenhuma divergência cadastral foi encontrada.</p>:<div className="table-wrap"><table><thead><tr><th>Situação</th><th>UF</th><th>Município no TSE</th><th>Código TSE atual</th><th>IBGE</th><th>Registro histórico</th><th>Código TSE 2022</th></tr></thead><tbody>{report.issues.map(issue=><tr key={`${issue.kind}:${issue.uf}:${issue.current?.code??issue.historical?.tseCode}`}><td><span className="validation-kind">{validationLabel(issue.kind)}</span></td><td>{issue.uf}</td><td>{issue.current?.name??'—'}</td><td>{issue.current?.code??'—'}</td><td>{issue.current?.ibgeCode??issue.historical?.ibgeCode??'—'}</td><td>{issue.historical?.name??'—'}</td><td>{issue.historical?.tseCode??'—'}</td></tr>)}</tbody></table></div>}</section>}

function validationLabel(kind:DataValidationReport['issues'][number]['kind']){return({TSE_CODE_CHANGED:'Código TSE alterado; IBGE confere',MISSING_HISTORY:'Sem base histórica',MISSING_TSE:'Ausente no EA12 atual',NAME_MATCH_ONLY:'Possível correspondência por nome'})[kind]}

function AutomaticMode({state,onToggle,onChooseDirectory,directoryName,snapshots,municipalSnapshots}:{state:AutomaticSyncState;onToggle:()=>void;onChooseDirectory:()=>void;directoryName:string|null;snapshots:SnapshotCaptureRecord[];municipalSnapshots:MunicipalSnapshotCaptureRecord[]}){
  const showProgress=state.enabled&&state.phase!=='POLLING'&&state.total>0;
  return <><div className={`automatic-mode ${state.enabled?'automatic-mode-on':''}`}>
    <button className="automatic-button" onClick={onToggle}>{state.enabled?'Desligar modo automático':'Modo automático'}</button>
    <label className="polling-switch"><input type="checkbox" role="switch" checked={state.pollingEnabled} onChange={onToggle}/><span>polling ligado</span></label>
    <div className="automatic-feedback" role="status">
      <strong>{state.message}</strong>
      {showProgress&&<><small>{state.completed.toLocaleString('pt-BR')} / {state.total.toLocaleString('pt-BR')} · {state.saved.toLocaleString('pt-BR')} salvos · {state.errors} falhas</small><progress value={state.completed} max={state.total}/></>}
      {state.phase==='POLLING'&&<small>Verificação inteligente a cada 10 segundos via EA14 → EA15 → EA20{state.lastCheckedAt?` · última: ${new Date(state.lastCheckedAt).toLocaleTimeString('pt-BR')}`:''}</small>}
    </div>
  </div><div className="snapshot-controls"><button className="secondary" onClick={onChooseDirectory}>Escolher pasta dos snapshots</button><span>{directoryName?`Pasta: ${directoryName}`:'Sem pasta escolhida: o navegador fará o download dos arquivos.'}</span>{snapshots.length>0&&<ul>{snapshots.slice(-5).reverse().map(snapshot=><li key={snapshot.id}><strong>Presidencial p{snapshot.thresholdPercent} · real p{snapshot.observedNationalPercent.toFixed(2)}</strong> · {snapshot.fileName} · {snapshot.presidentialMunicipalityResults}/{snapshot.expectedMunicipalities} municípios · {snapshot.delivery==='folder'?'salvo na pasta':'download iniciado'}{snapshot.skippedThresholds.length?` · marcos pulados: p${snapshot.skippedThresholds.join(', p')}`:''}</li>)}</ul>}{municipalSnapshots.length>0&&<ul>{municipalSnapshots.slice(-5).reverse().map(snapshot=><li key={snapshot.id}><strong>Municipal p{snapshot.thresholdPercent} · real p{snapshot.observedMunicipalCoveragePercent.toFixed(2)}</strong> · {snapshot.fileName} · {snapshot.downloadedMunicipalities}/{snapshot.expectedMunicipalities} municípios · {snapshot.countedSections.toLocaleString('pt-BR')}/{snapshot.totalSections.toLocaleString('pt-BR')} urnas · {snapshot.municipalFailures.length?`${snapshot.municipalFailures.length} falha(s) registrada(s)`:'sem falhas'} · {snapshot.delivery==='folder'?'salvo na pasta':'download iniciado'}{snapshot.skippedThresholds.length?` · marcos pulados: p${snapshot.skippedThresholds.join(', p')}`:''}</li>)}</ul>}</div></>;
}

function DebugPage({storage}:{storage:IndexedDBStorage}){
  const [counts,setCounts]=useState<unknown>(null);
  return <><header><div><span className="eyebrow">DIAGNÓSTICO</span><h1>Debug</h1></div></header><section className="panel"><button onClick={async()=>setCounts({official:await storage.count(),automatic:await storage.getAutomaticSyncState('automatic-sync'),projections:await storage.projectionRuns.count(),projectionUnits:await storage.projectionResults.count()})}>Atualizar storage</button><pre>{JSON.stringify(counts,null,2)}</pre></section></>;
}

const UFS=['SP','RJ','MG','BA','RS','PR','PE','CE','PA','SC','GO','MA','PB','AM','ES','RN','AL','PI','MT','DF','MS','SE','RO','TO','AC','AP','RR'];
function Stat({label,value}:{label:string;value:string}){return <div><small>{label}</small><strong>{value}</strong></div>;}
function fmt(value:number|null){return value==null?'—':value.toLocaleString('pt-BR');}
function OfficialProgressBox({result}:{result:NormalizedElectionResult|null}){const candidates=[...(result?.candidates??[])].filter(candidate=>candidate.votes!==null).sort((a,b)=>(b.votes??0)-(a.votes??0)).slice(0,3);return <aside className="official-progress" aria-live="polite"><span className="eyebrow">APURAÇÃO ATUAL · PRESIDENTE</span><div><small>Total de votos apurados</small><strong>{fmt(result?.totalVotes??null)}</strong></div><div><small>Urnas apuradas</small><strong>{pct(result?.countedSectionsPercentage??null)}</strong></div>{[0,1,2].map(index=>{const candidate=candidates[index];return <div key={index}><small>{index+1}º colocado</small><strong>{candidate?`${candidate.name??candidate.number??'—'} · ${pct(candidate.percentage)}`:'—'}</strong></div>})}</aside>}
function pct(value:number|null){return value==null?'—':`${value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;}
function Summary({result:r}:{result:NormalizedElectionResult|null}){if(!r)return <div className="empty">Escolha cargo e abrangência.</div>;return <div><div className="metrics"><Stat label="Seções totalizadas" value={`${fmt(r.countedSections)} / ${fmt(r.totalSections)}`}/><Stat label="Votos válidos" value={fmt(r.validVotes)}/><Stat label="Brancos" value={fmt(r.blankVotes)}/><Stat label="Nulos" value={fmt(r.nullVotes)}/></div><h2>Candidatos</h2><div className="candidates">{r.candidates.map(c=><article key={c.id??c.number}><span className="number">{c.number}</span><div><strong>{c.name}</strong><small>{c.party} · {c.status}</small></div><div className="votes"><strong>{fmt(c.votes)}</strong><small>{c.percentage?.toLocaleString('pt-BR')}%</small></div></article>)}</div></div>;}
