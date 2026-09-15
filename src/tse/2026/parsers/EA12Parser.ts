import type {Municipality} from '../../providers/TSEElectionProvider';
type Raw=Record<string,unknown>;
export function parseEA12(raw:Raw,uf?:string):Municipality[]{const coverages=Array.isArray(raw.abr)?raw.abr as Raw[]:[];return coverages.filter(a=>!uf||String(a.cd).toUpperCase()===uf.toUpperCase()).flatMap(a=>(Array.isArray(a.mu)?a.mu as Raw[]:[]).map(m=>({code:String(m.cd).padStart(5,'0'),ibgeCode:m.cdmi||m.cdi?String(m.cdmi??m.cdi):null,name:String(m.nm??m.ds??m.cd),uf:String(a.cd).toUpperCase()})))}
