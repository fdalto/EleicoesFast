export class PollingManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;
  lastError: unknown = null;

  constructor(private action: () => Promise<void>, private intervalMs = 5000) {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new Error('Intervalo de polling inválido');
  }

  get running() { return this.timer !== null; }

  start() {
    if (this.running) return;
    automaticLog('PollingManager: temporizador iniciado',{intervalMs:this.intervalMs});
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    this.tick();
  }

  pause() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    automaticLog('PollingManager: temporizador pausado');
  }

  private tick() { void this.runNow().catch(error => { automaticError('PollingManager: falha no ciclo agendado; a próxima tentativa continuará sendo programada',error); }); }

  runNow(): Promise<void> {
    if (this.inFlight){automaticLog('PollingManager: ciclo anterior ainda em execução; aguardando sua conclusão');return this.inFlight;}
    this.inFlight = Promise.resolve().then(this.action).then(
      () => { this.lastError = null; },
      error => { this.lastError = error; throw error; },
    ).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
}
import {automaticError,automaticLog} from '../../services/AutomaticDebugLog';
