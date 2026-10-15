import {describe,expect,it} from 'vitest';
import {parseEA16} from '../tse/2026/parsers/EA16Parser';
import {TSE2026UrlBuilder} from '../tse/2026/TSE2026UrlBuilder';
import {parseAndDiscoverEA11} from '../tse/2026/parsers/EA11Parser';
import {ea11Fixture} from './ea11.test';

describe('EA16 geográfico',()=>{
  it('usa somente o diretório cs descoberto no EA11',()=>{
    const discovery=parseAndDiscoverEA11({...ea11Fixture,arq:[...(ea11Fixture.arq??[]),{tp:'cs',dir:'<base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>'}]});
    const builder=new TSE2026UrlBuilder({baseUrl:'https://resultados.test',environment:'oficial'},discovery);
    expect(builder.ea16('SP')).toBe('https://resultados.test/oficial/ele2026/1001/dados/sp/sp-p000900-cs.json');
  });

  it('distingue presença do auxiliar de confirmação da totalização',()=>{
    const parsed=parseEA16({dg:'12/10/2026',hg:'10:00:00',abr:[{cd:'sp',mu:[{cd:'123',zon:[{cd:'7',sec:[{ns:'9',nsp:'9',da:'12/10/2026',ha:'09:59:00'},{ns:'10',nsp:'9'}]}]}]}]},{electionId:'6258',pollId:'406',round:2,officeCode:'0001',fetchedAt:'2026-10-12T13:00:00Z'});
    expect(parsed.sections[0]).toMatchObject({uf:'SP',municipalityCode:'00123',zone:'0007',section:'0009'});
    expect(parsed.states.map(item=>item.status)).toEqual(['AUXILIARY_AVAILABLE','PENDING']);
    expect(parsed.states[0].status).not.toBe('COUNTED_CONFIRMED');
  });
});
