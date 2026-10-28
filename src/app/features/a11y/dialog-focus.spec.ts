import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DialogFocus, focusableWithin } from './dialog-focus';

@Component({
  imports: [DialogFocus],
  template: `
    <button id="opener" type="button">open</button>
    @if (open()) {
      <div id="dialog" appDialogFocus role="dialog">
        <button id="first" type="button">first</button>
        <button id="disabled" type="button" disabled>disabled</button>
        <button id="last" type="button">last</button>
      </div>
    }
  `,
})
class HostComponent {
  open = signal(false);
}

describe('DialogFocus', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLElement>('#opener')!.focus();

    return { fixture, root };
  }

  function openDialog(fixture: ReturnType<typeof setup>['fixture']): void {
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  const tab = (el: Element, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    el.dispatchEvent(event);

    return event;
  };

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists only enabled, visible focusable elements', () => {
    const { fixture, root } = setup();
    openDialog(fixture);

    const ids = focusableWithin(root.querySelector('#dialog')!).map((el) => el.id);

    expect(ids).toEqual(['first', 'last']);
  });

  it('moves focus into the dialog when it opens', () => {
    const { fixture, root } = setup();
    openDialog(fixture);

    expect(document.activeElement).toBe(root.querySelector('#first'));
  });

  it('wraps Tab from the last control back to the first and Shift+Tab the other way', () => {
    const { fixture, root } = setup();
    openDialog(fixture);
    const first = root.querySelector<HTMLElement>('#first')!;
    const last = root.querySelector<HTMLElement>('#last')!;

    last.focus();
    expect(tab(last).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(tab(first, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    // Tabbing between inner controls is left to the browser.
    first.focus();
    expect(tab(first).defaultPrevented).toBe(false);
  });

  it('restores focus to the previously focused control when closed', () => {
    const { fixture, root } = setup();
    openDialog(fixture);

    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(root.querySelector('#opener'));
  });
});
