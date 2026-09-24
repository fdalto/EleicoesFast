import {readFileSync,writeFileSync} from 'node:fs';

const input=readFileSync('docs/guia-projecoes-eleicoes-fast.html','utf8');
const pages=[...input.matchAll(/<section class="page">([\s\S]*?)<\/section>/g)].map(match=>text(match[1]));
if(pages.length<4)throw new Error('O guia precisa ter ao menos quatro páginas.');

const objects=[];
const add=value=>{objects.push(value);return objects.length};
const catalog=add(''),pagesObject=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const pageReferences=[];
for(const [index,page] of pages.entries()){
  const content=stream(page,index+1,pages.length),contentObject=add(`<< /Length ${Buffer.byteLength(content,'latin1')} >>\nstream\n${content}\nendstream`),pageObject=add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentObject} 0 R >>`);
  pageReferences.push(`${pageObject} 0 R`);
}
objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
objects[pagesObject-1]=`<< /Type /Pages /Kids [${pageReferences.join(' ')}] /Count ${pages.length} >>`;
let output='%PDF-1.4\n%âãÏÓ\n',offsets=[0];
objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(output,'latin1'));output+=`${index+1} 0 obj\n${object}\nendobj\n`;});
const xref=Buffer.byteLength(output,'latin1');
output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
for(let index=1;index<=objects.length;index++)output+=`${String(offsets[index]).padStart(10,'0')} 00000 n \n`;
output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync('docs/guia-projecoes-eleicoes-fast.pdf',Buffer.from(output,'latin1'));

function text(section){return section.replace(/<\/(p|h1|h2|h3|li|tr|div|ul|table|thead|tbody)>/g,'\n').replace(/<br\s*\/?\s*>/g,'\n').replace(/<[^>]+>/g,' ').replace(/&times;/g,'×').replace(/&mdash;/g,'—').replace(/&nbsp;/g,' ').replace(/\s*\n\s*/g,'\n').replace(/[ \t]+/g,' ').trim();}
function stream(page,number,total){const lines=page.split('\n').flatMap(line=>wrap(line,94));const shown=lines.slice(0,61);const commands=['BT','/F1 9.2 Tf','48 800 Td','11.7 TL'];for(const line of shown){commands.push(`<${hex(line)}> Tj`,'T*');}commands.push('T*',`<${hex(`Página ${number} / ${total}`)}> Tj`,'ET');return commands.join('\n');}
function wrap(value,width){const words=value.split(' ');const lines=[];let line='';for(const word of words){const candidate=line?`${line} ${word}`:word;if(candidate.length>width&&line){lines.push(line);line=word;}else line=candidate;}if(line)lines.push(line);return lines;}
function hex(value){return Buffer.from(value.replace(/[•]/g,'-').replace(/[×]/g,'x').replace(/[—]/g,'-'),'latin1').toString('hex').toUpperCase();}
