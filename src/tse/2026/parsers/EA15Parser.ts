type Raw=Record<string,unknown>;
export interface EA15MunicipalityStatus {code:string;version:string|null;generatedAt:string|null;raw:Raw}
const first=(r:Raw,keys:string[])=>{for(const k of keys)if(r[k]!==undefined&&r[k]!==null)return String(r[k]);return null};
export function parseEA15(raw:Raw):EA15MunicipalityStatus[]{const rows=(Array.isArray(raw.abr)?raw.abr:Array.isArray(raw.mu)?raw.mu:[]) as Raw[];return rows.flatMap(r=>Array.isArray(r.mu)?r.mu as Raw[]:[r]).map(r=>({code:String(r.cdabr??r.cd??'').padStart(5,'0'),version:first(r,['idg','v','ver']),generatedAt:r.dt&&r.ht?`${r.dt} ${r.ht}`:first(r,['dh','dt','dg']),raw:r})).filter(r=>/^\d{5}$/.test(r.code))}
