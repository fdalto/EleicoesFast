import {useEffect,useState}from'react';
import type{CandidateIdentity}from'./CandidateIdentity';
import{candidateIdentityKey,candidateResultId}from'./CandidateIdentity';
import type{IndexedDBStorage}from'../storage/IndexedDBStorage';
import{ElectionOffice}from'../election/normalized/ElectionOffice';

type CandidateSection='PRESIDENT'|`GOVERNOR:${string}`;
interface CandidateOption {id:string;section:CandidateSection;electionId:string;round:number;office:ElectionOffice;candidateId:string;name:string;party:string|null}

export function CandidateIdentityPanel({storage}:{storage:IndexedDBStorage}){
  const [candidates,setCandidates]=useState<CandidateOption[]>([]),[section,setSection]=useState<CandidateSection>('PRESIDENT'),[identities,setIdentities]=useState<Map<string,CandidateIdentity>>(new Map()),[busy,setBusy]=useState(true),[error,setError]=useState('');
  async function refresh(){
    setBusy(true);setError('');
    try{
      const [results,saved]=await Promise.all([storage.results.toArray(),storage.listCandidateIdentities()]);
      const catalog=new Map<string,CandidateOption>();
      for(const result of results){
        const section=sectionFor(result.office,result.uf);
        if(!section)continue;
        for(const candidate of result.candidates){
        const candidateId=candidateResultId(candidate),id=candidateIdentityKey(result.electionId,result.round,result.office,candidateId);
        const catalogKey=`${section}:${id}`;
        if(!catalog.has(catalogKey))catalog.set(catalogKey,{id,section,electionId:result.electionId,round:result.round,office:result.office,candidateId,name:candidate.name??candidate.ballotName??candidate.number??'Candidato sem nome',party:candidate.party});
        }
      }
      const list=[...catalog.values()].sort((a,b)=>a.section.localeCompare(b.section)||a.name.localeCompare(b.name,'pt-BR'));
      setCandidates(list);
      const available=list.map(candidate=>candidate.section);
      setSection(current=>available.includes(current)?current:available[0]??'PRESIDENT');
      setIdentities(new Map(saved.map(identity=>[identity.id,identity])));
    }catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
    finally{setBusy(false);}
  }
  useEffect(()=>{void refresh()},[]);
  async function save(candidate:CandidateOption,patch:Partial<Pick<CandidateIdentity,'color'|'photoDataUrl'>>){
    const previous=identities.get(candidate.id);
    const identity:CandidateIdentity={id:candidate.id,electionId:candidate.electionId,round:candidate.round,office:candidate.office,candidateId:candidate.candidateId,name:candidate.name,party:candidate.party,color:patch.color??previous?.color??'#52606d',photoDataUrl:patch.photoDataUrl===undefined?previous?.photoDataUrl??null:patch.photoDataUrl,updatedAt:new Date().toISOString()};
    await storage.saveCandidateIdentity(identity);
    setIdentities(current=>new Map(current).set(identity.id,identity));
    window.dispatchEvent(new Event('candidate-identities-updated'));
  }
  async function choosePhoto(candidate:CandidateOption,file:File|null){
    if(!file)return;
    if(file.size>2*1024*1024){setError('A foto deve ter no máximo 2 MB.');return;}
    try{await save(candidate,{photoDataUrl:await asDataUrl(file)});}catch(cause){setError(cause instanceof Error?cause.message:String(cause));}
  }
  const sections=[...new Set(candidates.map(candidate=>candidate.section))],visible=candidates.filter(candidate=>candidate.section===section);
  return <section className="panel candidate-identities"><header><div><span className="eyebrow">IDENTIDADE VISUAL DO MAPA</span><h2>Associar candidatos</h2><p>Defina uma cor e, se quiser, uma foto. A cor do líder passa a preencher o território no mapa e as barras da projeção.</p></div><button className="ghost" onClick={()=>void refresh()} disabled={busy}>Atualizar lista</button></header>{error&&<p className="error">{error}</p>}{busy?<p className="note">Lendo candidatos baixados…</p>:candidates.length===0?<p className="note">Nenhum candidato foi baixado ainda. Carregue ao menos um resultado ou inicie o modo automático e atualize esta lista.</p>:<><label className="candidate-section">Disputa<select value={section} onChange={event=>setSection(event.target.value as CandidateSection)}>{sections.map(value=><option key={value} value={value}>{sectionLabel(value)}</option>)}</select></label><p className="note">{visible.length} candidato{visible.length===1?'':'s'} nesta lista.</p><div className="candidate-identity-list">{visible.map(candidate=>{const identity=identities.get(candidate.id);return <article key={`${candidate.section}:${candidate.id}`}><div className="candidate-photo">{identity?.photoDataUrl?<img src={identity.photoDataUrl} alt=""/>:<span>{candidate.name.slice(0,1)}</span>}</div><div className="candidate-identity-name"><strong>{candidate.name}</strong><small>{candidate.party??'SEM PARTIDO'} · {candidate.office} · {candidate.round}º turno</small></div><label className="candidate-color">Cor<input aria-label={`Cor de ${candidate.name}`} type="color" value={identity?.color??'#52606d'} onChange={event=>void save(candidate,{color:event.target.value})}/></label><label className="candidate-photo-input">Foto<input aria-label={`Foto de ${candidate.name}`} type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>void choosePhoto(candidate,event.target.files?.[0]??null)}/></label>{identity?.photoDataUrl&&<button className="ghost" onClick={()=>void save(candidate,{photoDataUrl:null})}>Remover foto</button>}</article>})}</div></>}</section>;
}

function asDataUrl(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('Não foi possível ler a foto selecionada.'));reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(file);});}
function sectionFor(office:ElectionOffice,uf:string|null):CandidateSection|null{if(office===ElectionOffice.PRESIDENT)return'PRESIDENT';return office===ElectionOffice.GOVERNOR&&uf?`GOVERNOR:${uf.toUpperCase()}`:null;}
function sectionLabel(section:CandidateSection){return section==='PRESIDENT'?'Presidencial':`Governador · ${section.slice('GOVERNOR:'.length)}`;}
