import { ModalManager as JoyModalManager, ariaHidden } from '@mui/base/unstable_useModal';


type _ManagedModal = Parameters<JoyModalManager['add']>[0];

type Layer = {
  element: HTMLElement | null;
  originalZIndex: string;
} & (
  | { kind: 'modal'; modal: _ManagedModal }
  | { kind: 'window'; opener: Element | null; lastFocus?: HTMLElement }
);

const ownsFocus = (layer: Layer, target: Element | null) => !!target && (
  layer.element?.contains(target) || (layer.kind === 'window' && layer.lastFocus === target)
);

/** Only real dialogs enter MUI's manager. Modeless windows share their visual/focus ordering. */
class JoyWindowManager extends JoyModalManager {
  private layers: Layer[] = [];
  private restoreModalAria?: () => void;

  override add(modal: _ManagedModal, container: HTMLElement) {
    const index = super.add(modal, container);
    if (!this.layers.some(layer => layer.kind === 'modal' && layer.modal === modal)) {
      const element = modal.modalRef instanceof HTMLElement ? modal.modalRef : null;
      this.layers.push({ kind: 'modal', modal, element, originalZIndex: element?.style.zIndex ?? '' });
    }
    this.syncLayers();
    return index;
  }

  override mount(modal: _ManagedModal, options: Parameters<JoyModalManager['mount']>[1]) {
    super.mount(modal, options);
    const layer = this.layers.find(layer => layer.kind === 'modal' && layer.modal === modal);
    if (layer && !layer.element && modal.modalRef instanceof HTMLElement) {
      layer.element = modal.modalRef;
      layer.originalZIndex = modal.modalRef.style.zIndex;
    }
    // Joy forwards its internal manager prop to the DOM; keep that adapter detail off the root.
    layer?.element?.removeAttribute('manager');
    this.syncLayers();
  }

  override remove(modal: _ManagedModal, hidden?: boolean) {
    const layer = this.layers.find(layer => layer.kind === 'modal' && layer.modal === modal);
    if (!layer) return super.remove(modal, hidden);
    this.layers = this.layers.filter(other => other !== layer);
    if (layer.element) layer.element.style.zIndex = layer.originalZIndex;
    const active = layer.element?.ownerDocument.activeElement;
    const restoreFocus = !!layer.element && (active === layer.element.ownerDocument.body || !!active && layer.element.contains(active));
    const index = super.remove(modal, hidden);
    this.syncLayers();
    // Joy may try restoring focus before removing the covered window's inert state.
    const top = this.layers[this.layers.length - 1];
    if (restoreFocus && top?.kind === 'window') this.focusLayer(top);
    return index;
  }

  override isTopModal(modal: _ManagedModal) {
    if (!super.isTopModal(modal)) return false;
    const index = this.layers.findIndex(layer => layer.kind === 'modal' && layer.modal === modal);
    const active = this.layers[index]?.element?.ownerDocument.activeElement ?? null;
    // Preserve Joy's dialog trap and Escape handling, except while a newer window owns focus.
    return !this.layers.slice(index + 1).some(layer => layer.kind === 'window' && ownsFocus(layer, active));
  }

  registerWindow(element: HTMLElement, focusInput: boolean) {
    const layer: Layer = { kind: 'window', element, originalZIndex: element.style.zIndex, opener: element.ownerDocument.activeElement };
    this.layers.push(layer);
    this.syncLayers();
    if (focusInput)
      element.querySelector<HTMLTextAreaElement>('textarea:not(:disabled):not([aria-hidden="true"])')?.focus({ preventScroll: true });

    return () => {
      const active = element.ownerDocument.activeElement;
      const restoreFocus = ownsFocus(layer, active) || active === element.ownerDocument.body;
      this.layers = this.layers.filter(other => other !== layer);
      element.style.zIndex = layer.originalZIndex;
      element.inert = false;
      ariaHidden(element, false);
      this.syncLayers();
      if (!restoreFocus) return;

      const opener = layer.opener;
      const modalIndex = this.lastModalIndex();
      if (opener instanceof HTMLElement && opener !== element.ownerDocument.body && opener.isConnected && !opener.closest('[inert], [aria-hidden="true"]') &&
        (modalIndex < 0 || this.layers.slice(modalIndex).some(other => ownsFocus(other, opener)))) {
        opener.focus({ preventScroll: true });
        if (opener.ownerDocument.activeElement === opener) return;
      }
      this.focusLayer(this.layers[this.layers.length - 1]);
    };
  }

  focusWindowElement(id: string, target: HTMLElement) {
    const index = this.layers.findIndex(layer => layer.kind === 'window' && layer.element?.id === id);
    const layer = this.layers[index];
    // React focus events also bubble through child-dialog portals. Those belong to the newer modal.
    if (layer?.kind !== 'window' || index < this.lastModalIndex()) return;
    layer.lastFocus = target;
    if (layer.element?.contains(target)) this.bringToFront(id, false);
  }

  bringToFront(id: string, focus = true) {
    const index = this.layers.findIndex(layer => layer.kind === 'window' && layer.element?.id === id);
    if (index < 0) return;
    const layer = this.layers[index];
    if (index !== this.layers.length - 1) {
      this.layers.splice(index, 1);
      this.layers.push(layer);
      this.syncLayers();
    }
    if (focus) this.focusLayer(layer);
  }

  private lastModalIndex() {
    for (let i = this.layers.length - 1; i >= 0; i--)
      if (this.layers[i].kind === 'modal') return i;
    return -1;
  }

  private focusLayer(layer?: Layer) {
    const element = layer?.element;
    if (!element) return;
    const target = layer.kind === 'window'
      ? layer.lastFocus?.isConnected && element.contains(layer.lastFocus) ? layer.lastFocus : element
      : element.querySelector<HTMLElement>('[tabindex="-1"]');
    target?.focus({ preventScroll: true });
    if (layer.kind === 'window' && element.ownerDocument.activeElement !== target)
      element.focus({ preventScroll: true });
  }

  private syncLayers() {
    this.restoreModalAria?.();
    this.restoreModalAria = undefined;
    const hasWindows = this.layers.some(layer => layer.kind === 'window');
    const modalIndex = this.lastModalIndex();
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      const element = layer.element;
      if (!element) continue;
      // Leave the modal ceiling (1300) available to existing popups. Never move live DOM to raise it.
      element.style.zIndex = hasWindows ? `calc(var(--joy-zIndex-modal) - ${this.layers.length - i})` : layer.originalZIndex;
      if (!hasWindows) continue;
      ariaHidden(element, i < modalIndex);
      if (layer.kind === 'window') element.inert = i < modalIndex;
      else if (i === modalIndex && i < this.layers.length - 1) {
        const dialog = element.querySelector('[aria-modal="true"]');
        if (dialog) {
          dialog.setAttribute('aria-modal', 'false');
          this.restoreModalAria = () => dialog.setAttribute('aria-modal', 'true');
        }
      }
    }
  }
}

export const joyFloatingWindowManager = new JoyWindowManager();

// Joy forwards Base's manager prop without declaring it. Modal and Drawer must share this instance.
export const joyWindowManagerDefaults = { manager: joyFloatingWindowManager, disableAutoFocus: false };
