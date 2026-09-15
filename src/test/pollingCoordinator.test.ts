import {describe, expect, it, vi} from 'vitest';
import {ElectionOffice} from '../election/normalized/ElectionOffice';
import {TSE2026PollingCoordinator} from '../tse/polling/TSE2026PollingCoordinator';
import type {TSE2026Provider} from '../tse/providers/TSE2026Provider';
import type {ProviderResult} from '../tse/providers/TSEElectionProvider';
import type {TransportResponse} from '../tse/transport/TSETransport';

function fixture() {
  let version = '1';
  const result = {} as ProviderResult;
  const provider = {
    getEA14: vi.fn(async (kind: 'federal' | 'state') => ({transport: {} as TransportResponse<Record<string, unknown>>,
      states: (kind === 'federal' ? ['SP', 'RJ'] : []).map(uf => ({uf, version, generatedAt:null, raw:{}})),
    })),
    getEA15: vi.fn(async () => ({transport: {} as TransportResponse<Record<string, unknown>>,
      municipalities: [{code:'12345', version, generatedAt:null, raw:{}}],
    })),
    getNationalResult: vi.fn(async () => result),
    getStateResult: vi.fn(async () => result),
    getMunicipalityResult: vi.fn(async () => result),
  } satisfies Pick<TSE2026Provider, 'getEA14' | 'getEA15' | 'getNationalResult' | 'getStateResult' | 'getMunicipalityResult'>;
  return {provider, change: () => { version = String(Number(version) + 1); }};
}

describe('polling hierárquico 2026 (simulado)', () => {
  it('cria baseline sem EA20 e atualiza Brasil uma vez para duas UFs alteradas', async () => {
    const {provider, change} = fixture();
    const coordinator = new TSE2026PollingCoordinator(provider);
    await coordinator.runCycle();
    expect(provider.getEA15).not.toHaveBeenCalled();
    expect(provider.getNationalResult).not.toHaveBeenCalled();
    change();
    const report = await coordinator.runCycle();
    expect(report.updatedResults).toBe(5);
    expect(report.changedMunicipalities).toHaveLength(2);
    expect(provider.getNationalResult).toHaveBeenCalledTimes(1);
    await coordinator.runCycle();
    expect(provider.getMunicipalityResult).toHaveBeenCalledTimes(2);
  });

  it('repete município com falha mesmo quando EA14 não muda novamente', async () => {
    const {provider, change} = fixture();
    const coordinator = new TSE2026PollingCoordinator(provider);
    await coordinator.runCycle();
    change();
    provider.getMunicipalityResult.mockRejectedValueOnce(new Error('timeout'));
    expect((await coordinator.runCycle()).errors).toEqual(['timeout']);
    const retry = await coordinator.runCycle();
    expect(retry.changedStates).toEqual(['federal:SP']);
    expect(retry.changedMunicipalities).toEqual(['federal:SP:12345']);
    expect(retry.errors).toEqual([]);
    expect((await coordinator.runCycle()).changedStates).toEqual([]);
  });

  it('aguarda persistência e não perde atualização após falha no storage', async () => {
    const {provider, change} = fixture();
    const save = vi.fn(async () => {});
    const coordinator = new TSE2026PollingCoordinator(provider, save);
    await coordinator.runCycle();
    change();
    save.mockRejectedValueOnce(new Error('storage'));
    expect((await coordinator.runCycle()).errors).toEqual(['storage']);
    expect((await coordinator.runCycle()).changedStates).toHaveLength(2);
    expect(provider.getNationalResult).toHaveBeenCalledTimes(2);
  });

  it('recupera falha de EA15 e deduplica chamadas concorrentes', async () => {
    const {provider, change} = fixture();
    const coordinator = new TSE2026PollingCoordinator(provider);
    const first = coordinator.runCycle();
    expect(coordinator.runCycle()).toBe(first);
    await first;
    change();
    provider.getEA15.mockRejectedValueOnce(new Error('EA15 indisponível'));
    expect((await coordinator.runCycle()).errors).toEqual(['EA15 indisponível']);
    expect((await coordinator.runCycle()).changedMunicipalities).toEqual(['federal:SP:12345']);
  });

  it('permite ao modo automático limitar a eleição estadual a Governador', async () => {
    const {provider, change} = fixture();
    provider.getEA14.mockImplementation(async kind => ({transport:{} as TransportResponse<Record<string, unknown>>,states:kind==='state'?[{uf:'SP',version:'1',generatedAt:null,raw:{}}]:[]}));
    const activity=vi.fn();
    const coordinator=new TSE2026PollingCoordinator(provider,undefined,{stateOffices:[ElectionOffice.GOVERNOR],onActivity:activity});
    await coordinator.runCycle();
    change();
    provider.getEA14.mockImplementation(async kind => ({transport:{} as TransportResponse<Record<string, unknown>>,states:kind==='state'?[{uf:'SP',version:'2',generatedAt:null,raw:{}}]:[]}));
    await coordinator.runCycle();
    expect(provider.getStateResult).toHaveBeenCalledWith('SP',ElectionOffice.GOVERNOR);
    expect(provider.getStateResult).not.toHaveBeenCalledWith('SP',ElectionOffice.SENATOR);
    expect(provider.getMunicipalityResult).not.toHaveBeenCalledWith('SP','12345',ElectionOffice.SENATOR);
    expect(activity).toHaveBeenCalledWith(expect.stringContaining('município SP/12345'));
  });
});

