import { Directive, ElementRef, HostListener, OnDestroy, afterNextRender, inject } from '@angular/core';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Visible, enabled focusable descendants in DOM order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true',
  );
}

/**
 * Makes a modal dialog keyboard-friendly: moves focus into it when it appears, keeps Tab and
 * Shift+Tab inside, and returns focus to the previously focused control when it goes away.
 */
@Directive({
  selector: '[appDialogFocus]',
  standalone: true,
})
export class DialogFocus implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly previous = typeof document === 'undefined' ? null : document.activeElement;

  constructor() {
    afterNextRender(() => {
      if (!this.host.hasAttribute('tabindex')) {
        this.host.setAttribute('tabindex', '-1');
      }

      (focusableWithin(this.host)[0] ?? this.host).focus({ preventScroll: true });
    });
  }

  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const items = focusableWithin(this.host);

    if (!items.length) {
      event.preventDefault();
      this.host.focus();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === this.host)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  ngOnDestroy(): void {
    const target = this.previous;

    if (target instanceof HTMLElement && target.isConnected) {
      target.focus({ preventScroll: true });
    }
  }
}
