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

/* // Uncomment to have a great debugging tool for focus issues, tracking every movement within the document. Use LLMs to explain.

export function useDocumentFocusDebugger() {
  const previousFocusRef = React.useRef<Element | null>(null);

  React.useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;

    const handleFocusChange = (event: FocusEvent) => {
      const currentFocus = event.target as Element;

      if (currentFocus !== previousFocusRef.current) {
        const prevInfo = _getElementInfo(previousFocusRef.current);
        const currentInfo = _getElementInfo(currentFocus);

        console.group('Focus Change');
        console.log(`Time: ${new Date().toISOString()}`);
        console.log(`Event: ${event.type}`);
        console.log('Previous focus:', prevInfo);
        console.log('Current focus:', currentInfo);
        console.log('Stack trace:', new Error().stack);
        console.groupEnd();

        previousFocusRef.current = currentFocus;
      }
    };

    document.addEventListener('focus', handleFocusChange, true);
    document.addEventListener('blur', handleFocusChange, true);

    return () => {
      document.removeEventListener('focus', handleFocusChange, true);
      document.removeEventListener('blur', handleFocusChange, true);
    };
  }, []);
}

function _getElementInfo(element: Element | null) {
  if (!element) return 'None';

  return {
    tagName: element.tagName,
    id: element.id,
    className: element.className,
    textContent: element.textContent?.slice(0, 50) ?? '',
    componentName: _getReactComponentName(element),
  };
}

function _getReactComponentName(element: Element): string {
  const reactKey = Object.keys(element).find(key => key.startsWith('__reactFiber$'));
  if (reactKey) {
    const fiber = (element as any)[reactKey];
    if (fiber && fiber.return && fiber.return.type) {
      return fiber.return.type.name || 'Unknown';
    }
  }
  return 'Unknown';
}
*/
