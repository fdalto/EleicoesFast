const PREFIX='[Eleições Fast][modo automático]';

export function automaticLog(stage:string,details?:Record<string,unknown>){
  console.log(`${PREFIX} ${new Date().toISOString()} ${stage}`,details??{});
}

export function automaticError(stage:string,error:unknown,details?:Record<string,unknown>){
  console.error(`${PREFIX} ${new Date().toISOString()} ${stage}`,{
    ...details,
    error:error instanceof Error?error.message:String(error),
    stack:error instanceof Error?error.stack:undefined,
  });
}
