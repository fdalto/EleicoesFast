export enum ElectionOffice { PRESIDENT='PRESIDENT', GOVERNOR='GOVERNOR', SENATOR='SENATOR' }
export const OFFICE_CODE: Record<ElectionOffice,string> = { [ElectionOffice.PRESIDENT]:'0001', [ElectionOffice.GOVERNOR]:'0003', [ElectionOffice.SENATOR]:'0005' };
