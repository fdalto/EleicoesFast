import type {GeographicImportManifest,GeographicPartition} from './GeographicModels';
import type {IndexedDBStorage} from '../storage/IndexedDBStorage';

const relativeUrl=(path:string,base:string)=>new URL(path.replace(/^\//,''),new URL(base,document.baseURI)).toString();
const sha256=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(value=>value.toString(16).padStart(2,'0')).join('');

export class GeographicPartitionImporter {
  constructor(private storage:IndexedDBStorage,private manifestPath='data/geographic/manifest.json'){}

  async loadManifest(){const response=await fetch(relativeUrl(this.manifestPath,'./'));if(!response.ok)throw new Error(`Manifesto geográfico indisponível: HTTP ${response.status}`);const manifest=await response.json() as GeographicImportManifest;if(manifest.schemaVersion!=='eleicoes-fast-geographic-v1'||manifest.finalHistoricalResult!==true)throw new Error('Manifesto geográfico incompatível');return manifest}

  async importMunicipality(uf:string,municipalityCode:string){const manifest=await this.loadManifest(),descriptor=manifest.partitions.find(item=>item.uf===uf.toUpperCase()&&item.municipalityCode===municipalityCode.padStart(5,'0'));if(!descriptor)throw new Error(`Partição não encontrada para ${uf}/${municipalityCode}`);const response=await fetch(relativeUrl(descriptor.path,this.manifestPath));if(!response.ok)throw new Error(`Partição geográfica indisponível: HTTP ${response.status}`);const bytes=await response.arrayBuffer(),digest=await sha256(bytes);if(digest!==descriptor.sha256)throw new Error(`Checksum inválido para ${descriptor.path}`);const partition=JSON.parse(new TextDecoder().decode(bytes)) as GeographicPartition;await this.storage.importGeographicPartition(manifest,partition);return{manifest,descriptor}}
}
