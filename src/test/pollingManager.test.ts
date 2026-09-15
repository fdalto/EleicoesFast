import {afterEach, describe, expect, it, vi} from 'vitest';
import {PollingManager} from '../tse/polling/PollingManager';

afterEach(() => vi.useRealTimers());
describe('PollingManager', () => {
  it('compartilha o ciclo em voo e pausa sem agendar novas ações', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const action = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const manager = new PollingManager(action, 100);
    manager.start();
    const pending = manager.runNow();
    await vi.advanceTimersByTimeAsync(350);
    expect(action).toHaveBeenCalledTimes(1);
    expect(manager.runNow()).toBe(pending);
    manager.pause();
    finish();
    await pending;
    await vi.advanceTimersByTimeAsync(500);
    expect(action).toHaveBeenCalledTimes(1);
    expect(manager.running).toBe(false);
  });

  it('registra erros automáticos e se recupera no próximo intervalo', async () => {
    vi.useFakeTimers();
    const action = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue(undefined);
    const manager = new PollingManager(action, 100);
    manager.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(manager.lastError).toEqual(new Error('rede'));
    await vi.advanceTimersByTimeAsync(100);
    expect(action).toHaveBeenCalledTimes(2);
    expect(manager.lastError).toBeNull();
    manager.pause();
  });

  it('propaga erro manual e rejeita intervalo inválido', async () => {
    const manager = new PollingManager(async () => { throw new Error('falha'); });
    await expect(manager.runNow()).rejects.toThrow('falha');
    expect(() => new PollingManager(async () => {}, 0)).toThrow('Intervalo');
  });
});
