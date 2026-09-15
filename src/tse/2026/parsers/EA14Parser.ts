type Raw=Record<string,unknown>;
export interface EA14StateStatus {uf:string;version:string|null;generatedAt:string|null;raw:Raw}
const first=(r:Raw,keys:string[])=>{for(const k of keys)if(r[k]!==undefined&&r[k]!==null)return String(r[k]);return null};
export function parseEA14(raw:Raw):EA14StateStatus[]{const rows=(Array.isArray(raw.abr)?raw.abr:Array.isArray(raw.uf)?raw.uf:[]) as Raw[];return rows.map(r=>({uf:String(r.cdabr??r.cd??r.uf).toUpperCase(),version:first(r,['idg','v','ver']),generatedAt:r.dt&&r.ht?`${r.dt} ${r.ht}`:first(r,['dh','dt','dg']),raw:r})).filter(r=>r.uf.length===2)}
