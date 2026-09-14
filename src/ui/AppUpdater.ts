export type AppUpdateState = 'idle' | 'checking' | 'downloading' | 'current' | 'updated'
  | 'offline' | 'error' | 'updating' | 'unavailable';

// Uses the current deployment's worker URL, including the GitHub Pages base path.
// The worker's content hash detects releases even when appVersion stays the same.
export class AppUpdater {
  state: AppUpdateState;
  private registration?: ServiceWorkerRegistration;
  private registering?: Promise<ServiceWorkerRegistration>;
  private checking?: Promise<void>;
  private watched = new WeakSet<ServiceWorker>();
  private subscribers = new Set<(state: AppUpdateState) => void>();
  private controller: ServiceWorker | null;
  private changedController = false;
  private checkRequested = false;
  private reloadRequested = false;
  private reloaded = false;
  private activationTimer?: ReturnType<typeof setTimeout>;
  private resultTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private serviceWorker: ServiceWorkerContainer | undefined,
    private scriptUrl: string,
    private reload: () => void,
    private online: () => boolean = () => navigator.onLine,
    justUpdated = false
  ) {
    this.state = serviceWorker ? 'idle' : 'unavailable';
    if (serviceWorker && justUpdated) this.setState('updated');
    this.controller = serviceWorker?.controller ?? null;
    serviceWorker?.addEventListener('controllerchange', () => {
      const previous = this.controller;
      this.controller = serviceWorker.controller;
      if (this.reloadRequested && this.controller) { this.reloadOnce(); return; }
      // First installation claims the page too; that must not cause a reload loop.
      if (!previous || !this.controller || previous === this.controller) return;
      this.changedController = true;
      // Another window may activate an update while this window is checking.
      if (this.checkRequested) this.reloadOnce();
    });
  }

  subscribe(callback: (state: AppUpdateState) => void): () => void {
    this.subscribers.add(callback);
    callback(this.state);
    return () => { this.subscribers.delete(callback); };
  }

  start() {
    if (!this.serviceWorker) return;
    void this.getRegistration().catch(() => {
      if (this.state !== 'updated') this.setState(this.online() ? 'error' : 'offline');
    });
  }

  private setState(state: AppUpdateState) {
    if (this.reloaded) return;
    clearTimeout(this.resultTimer);
    if (['current', 'updated', 'error', 'offline'].includes(state)) this.checkRequested = false;
    this.state = state;
    this.subscribers.forEach(callback => callback(state));
    if (state === 'current' || state === 'updated') {
      this.resultTimer = setTimeout(() => this.setState('idle'), 3_000);
    }
  }

  private getRegistration(): Promise<ServiceWorkerRegistration> {
    if (this.registration) return Promise.resolve(this.registration);
    if (this.registering) return this.registering;
    this.registering = this.serviceWorker!.register(this.scriptUrl, { updateViaCache: 'none' })
      .then(registration => {
        this.registration = registration;
        registration.addEventListener('updatefound', () => this.watchInstalling());
        this.watchInstalling();
        return registration;
      }).finally(() => { this.registering = undefined; });
    return this.registering;
  }

  private watchInstalling() {
    const worker = this.registration?.installing;
    if (!worker) return;
    if (this.checkRequested && !this.reloadRequested) this.setState('downloading');
    if (this.watched.has(worker)) return;
    this.watched.add(worker);
    const changed = () => {
      if (worker.state === 'installed') {
        if (this.checkRequested && this.registration?.waiting) this.apply();
      } else if (worker.state === 'activated') {
        if (this.checkRequested && !this.reloadRequested && !this.controller) this.setState('current');
        worker.removeEventListener('statechange', changed);
      } else if (worker.state === 'redundant') {
        if (this.checkRequested && !this.reloadRequested) {
          this.setState(this.online() ? 'error' : 'offline');
        }
        worker.removeEventListener('statechange', changed);
      }
    };
    worker.addEventListener('statechange', changed);
    changed();
  }

  check(): Promise<void> {
    if (!this.serviceWorker || this.reloaded) return Promise.resolve();
    if (this.checkRequested) return this.checking ?? Promise.resolve();
    this.checkRequested = true;
    if (this.changedController) { this.reloadOnce(); return Promise.resolve(); }
    if (!this.online()) {
      if (this.registration?.waiting) this.apply();
      else this.setState('offline');
      return Promise.resolve();
    }
    this.setState('checking');
    this.checking = (async () => {
      try {
        const registration = await this.getRegistration();
        await registration.update();
        if (!this.checkRequested || this.reloadRequested) return;
        if (this.changedController) this.reloadOnce();
        else if (registration.waiting) this.apply();
        else if (registration.installing) this.watchInstalling();
        else this.setState('current');
      } catch {
        // A previously downloaded update remains usable if the network check fails.
        if (!this.checkRequested || this.reloadRequested) return;
        if (this.registration?.waiting) this.apply();
        else this.setState(this.online() ? 'error' : 'offline');
      }
    })().finally(() => { this.checking = undefined; });
    return this.checking;
  }

  private apply() {
    if (this.reloaded || this.reloadRequested) return;
    if (this.changedController) { this.reloadOnce(); return; }
    const waiting = this.registration?.waiting;
    if (!waiting) return;
    this.reloadRequested = true;
    this.setState('updating');
    this.activationTimer = setTimeout(() => {
      this.reloadRequested = false;
      this.setState('error');
    }, 15_000);
    try {
      // Only a fully installed worker is asked to activate. Never clear user storage.
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      clearTimeout(this.activationTimer);
      this.reloadRequested = false;
      this.setState('error');
    }
  }

  private reloadOnce() {
    if (this.reloaded) return;
    clearTimeout(this.activationTimer);
    clearTimeout(this.resultTimer);
    this.reloaded = true;
    this.reload();
  }
}
