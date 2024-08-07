import { isBrowser } from './pwaUtils';

export class WindowFocusObserver {
  private static instance: WindowFocusObserver | null = null;
  private listeners: Set<(isWindowFocused: boolean) => void> = new Set();
  private isWindowFocused: boolean = true;
  private refCount: number = 0;

  // singleton

  public static getInstance(): WindowFocusObserver {
    if (!WindowFocusObserver.instance)
      WindowFocusObserver.instance = new WindowFocusObserver();
    return WindowFocusObserver.instance;
  }

  private constructor() {
    if (!isBrowser) return;
    this.isWindowFocused = document.hasFocus();
    window.addEventListener('focus', this._handleWindowFocus);
    window.addEventListener('blur', this._handleWindowBlur);
  }

  // clients

  get windowFocusState(): boolean {
    return this.isWindowFocused;
  }

  public subscribe(listener: (isWindowFocused: boolean) => void): () => void {
    this.listeners.add(listener);
    this.refCount++;
    return () => {
      this.listeners.delete(listener);
      this.refCount--;
      if (this.refCount === 0) {
        this._cleanup();
      }
    };
  }

  // private methods

  private _cleanup(): void {
    if (!isBrowser) return;
    window.removeEventListener('focus', this._handleWindowFocus);
    window.removeEventListener('blur', this._handleWindowBlur);
    this.listeners.clear();
    WindowFocusObserver.instance = null;
  }

  private _handleWindowFocus = (): void => {
    this._updateWindowFocusState(true);
  };

  private _handleWindowBlur = (): void => {
    this._updateWindowFocusState(false);
  };

  private _updateWindowFocusState(newState: boolean): void {
    if (this.isWindowFocused !== newState) {
      this.isWindowFocused = newState;
      this.listeners.forEach(listener => listener(this.isWindowFocused));
    }
  }
}


// // React to window visibility changes.
// export function useWindowFocus(): boolean {
//   const [isWindowFocused, setIsWindowFocused] = React.useState<boolean>(() =>
//     WindowFocusObserver.getInstance().windowFocusState,
//   );
//   React.useEffect(() => WindowFocusObserver.getInstance().subscribe(setIsWindowFocused), []);
//   return isWindowFocused;
// }
