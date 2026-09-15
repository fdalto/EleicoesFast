function digits(value:string|number,label:string){const raw=String(value);if(!/^\d+$/.test(raw))throw new Error(`${label} inválido: ${raw}`);return raw}
export const formatOfficeCode=(value:string|number)=>digits(value,'Cargo').padStart(4,'0');
export const formatElectionFileCode=(value:string|number)=>digits(value,'Eleição').padStart(6,'0');
export const formatPleitoFileCode=(value:string|number)=>digits(value,'Pleito').padStart(6,'0');
export const formatMunicipalityCode=(value:string|number)=>{const raw=digits(value,'Município');if(raw.length>5)throw new Error(`Município deve ter no máximo 5 dígitos: ${raw}`);return raw.padStart(5,'0')};
