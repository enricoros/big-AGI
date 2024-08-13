class CodeCollapseManager extends EventTarget {
  private static instance: CodeCollapseManager | null = null;

  private constructor() {
    super();
  }

  static getInstance(): CodeCollapseManager {
    if (!CodeCollapseManager.instance) {
      CodeCollapseManager.instance = new CodeCollapseManager();
    }
    return CodeCollapseManager.instance;
  }

  // called by the menu
  triggerCollapseAll(collapse: boolean) {
    this.dispatchEvent(new CustomEvent('codeCollapseAll', { detail: collapse }));
  }

  // useEffect'd by the EhancedRenderCode component
  addCollapseAllListener(onCodeCollapse: (collapse: boolean) => void) {
    const handleCollapse = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      onCodeCollapse(customEvent.detail);
    };
    this.addEventListener('codeCollapseAll', handleCollapse);
    return () => this.removeEventListener('codeCollapseAll', handleCollapse);
  }

}

export function getCodeCollapseManager(): CodeCollapseManager {
  return CodeCollapseManager.getInstance();
}