import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { vi } from 'vitest';

import { UpdateService } from './update.service';

describe('UpdateService', () => {
  function setup(enabled: boolean) {
    const events = new Subject<{ type: string }>();
    const activateUpdate = vi.fn(() => Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: { isEnabled: enabled, versionUpdates: events, activateUpdate } },
      ],
    });

    return { events, activateUpdate, service: TestBed.inject(UpdateService) };
  }

  it('flags an update only for VERSION_READY events', () => {
    const { events, service } = setup(true);

    events.next({ type: 'VERSION_DETECTED' });
    expect(service.updateReady()).toBe(false);

    events.next({ type: 'VERSION_READY' });
    expect(service.updateReady()).toBe(true);

    service.dismiss();
    expect(service.updateReady()).toBe(false);
  });

  it('ignores events when the service worker is disabled', () => {
    const { events, service } = setup(false);

    events.next({ type: 'VERSION_READY' });

    expect(service.updateReady()).toBe(false);
  });

  it('activates the update before reloading, and still reloads if activation fails', async () => {
    const { activateUpdate, service } = setup(true);
    const reload = vi.fn();

    await service.applyUpdate(reload);
    expect(activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);

    activateUpdate.mockRejectedValueOnce(new Error('x'));
    await expect(service.applyUpdate(reload)).rejects.toThrow('x');
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('works without any service worker provider', () => {
    TestBed.configureTestingModule({});

    expect(TestBed.inject(UpdateService).updateReady()).toBe(false);
  });
});
