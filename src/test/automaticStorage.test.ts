import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it} from 'vitest';
import {IndexedDBStorage} from '../storage/IndexedDBStorage';

let storage:IndexedDBStorage|undefined;
afterEach(async()=>{if(storage){storage.close();await storage.delete();storage=undefined;}});

describe('memória do modo automático',()=>{
  it('persiste o estado operacional na store de polling',async()=>{
    storage=new IndexedDBStorage();
    await storage.open();
    await storage.saveAutomaticSyncState({id:'automatic-sync',provider:'2026_SIMULATION',enabled:true,phase:'POLLING',message:'Aguardando novas atualizações',total:0,completed:0,saved:0,errors:0,lastCheckedAt:'2026-09-15T15:00:00Z',updatedAt:'2026-09-15T15:00:01Z'});
    expect(await storage.getAutomaticSyncState('automatic-sync')).toMatchObject({enabled:true,phase:'POLLING',lastCheckedAt:'2026-09-15T15:00:00Z'});
  });
});
