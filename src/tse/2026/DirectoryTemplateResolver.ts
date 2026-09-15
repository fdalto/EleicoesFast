export interface DirectoryTokens {base:string;environment:string;cycle:string;electionId:string;uf?:string;pollId?:string}
const TOKENS:Record<string,keyof DirectoryTokens>={base:'base',ambiente:'environment',ciclo:'cycle',cd_eleicao:'electionId',uf:'uf',cd_pleito:'pollId'};
export class DirectoryTemplateResolver {
  resolve(template:string,tokens:DirectoryTokens):string {
    const unresolved:string[]=[];
    const result=template.replace(/<([^>]+)>/g,(_,token:string)=>{const key=TOKENS[token];const value=key?tokens[key]:undefined;if(!key||value===undefined||value===''){unresolved.push(token);return`<${token}>`}return String(value)});
    if(unresolved.length)throw new Error(`Tokens de diretório não resolvidos: ${unresolved.join(', ')}`);
    return result.replace(/([^:]\/)\/+/g,'$1').replace(/\/$/,'');
  }
}
