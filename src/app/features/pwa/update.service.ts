import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionEvent } from '@angular/service-worker';

/**
 * Tells the player when a newer build has been downloaded in the background, so they can
 * reload at a convenient moment instead of running stale code from the cache.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  // Optional: the service worker is not provided in tests or when unsupported.
  private readonly updates = inject(SwUpdate, { optional: true });

  /** True once a new version is ready to be activated. */
  readonly updateReady = signal(false);

  constructor() {
    if (!this.updates?.isEnabled) {
      return;
    }

    const subscription = this.updates.versionUpdates.subscribe((event: VersionEvent) => {
      if (event.type === 'VERSION_READY') {
        this.updateReady.set(true);
      }
    });

    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** Activates the downloaded version and reloads the page. */
  async applyUpdate(reload: () => void = () => document.location.reload()): Promise<void> {
    try {
      await this.updates?.activateUpdate();
    } finally {
      reload();
    }
  }

  dismiss(): void {
    this.updateReady.set(false);
  }
}
