import * as React from 'react';

import { BaseProduct } from '~/common/app.release';
import { logger } from '~/common/logger';
import { posthogCaptureException } from '~/common/components/3rdparty/PostHogAnalytics';
import { isBenignDomMutationError, isChunkLoadError } from '~/common/util/errorUtils';


export interface ErrorBoundaryProps {
  /** Just marks the fact that this boundary is the outer */
  outer?: boolean;
  /** Optional: A simple React node to display when an error is caught. */
  fallback?: React.ReactNode;
  /** Optional: A name for this boundary, useful for logging context */
  componentName?: string;
  /** Optional: Callback function when an error is caught (e.g., for external reporting like Sentry) */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Optional: Called when the reset button in the default fallback is clicked */
  onReset?: () => void; // Added for flexibility with default fallback
  /** Content to render when no error occurs */
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}


/**
 * A reusable React Error Boundary component using Sherpa styles for fallback.
 * Catches JavaScript errors anywhere in its child component tree,
 * logs those errors using the provided logger, and displays a fallback UI.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static defaultProps: Partial<ErrorBoundaryProps> = {
    componentName: 'UnnamedBoundary',
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const { componentName, onError } = this.props;

    // Check for benign DOM errors and handle silently
    if (isBenignDomMutationError(error)) {
      console.warn(`Benign DOM error in ${componentName}: ${error.message}`);
      this.setState({ hasError: false, error: null });
      return;
    }

    // Stale-deploy chunk load failures: auto-reload once per session to fetch current files.
    // The transient first-time case is expected after a deploy (don't report it); only a
    // failure that survives a reload (broken deploy / CDN / offline) is worth reporting.
    if (isChunkLoadError(error)) {
      if (this.tryReloadOnceForChunkError())
        return; // reloading now - fallback UI not needed
      console.warn(`Persistent chunk load error in ${componentName}: ${error.message}`);
      posthogCaptureException(error, {
        agi_domain: 'client-error-boundary',
        agi_runtime: 'browser',
        component: componentName,
        chunk_reload_failed: true,
      });
      return; // keep hasError=true so the "Update Required" fallback renders
    }

    // Log the error using the custom logger (skip reporting to PostHog since we handle it directly below)
    logger.error(
      `ErrorBoundary caught an error in ${componentName}`,
      {
        error: { name: error.name, message: error.message, stack: error.stack },
        componentStack: errorInfo.componentStack,
      },
      'client',
      { skipReporting: true },
    );

    // Capture exception in PostHog
    posthogCaptureException(error, {
      agi_domain: 'client-error-boundary',
      agi_runtime: 'browser',
      component: componentName,
      component_stack: errorInfo.componentStack,
    });

    // Call the optional onError callback for external reporting
    onError?.(error, errorInfo);
  }

  /**
   * Reload the page once per session to recover from a stale-deploy chunk load failure.
   * Guarded by sessionStorage (with a short time window) to avoid reload loops when the
   * chunk is genuinely unreachable (offline / broken deploy / sessionStorage unavailable).
   * @returns true if a reload was triggered, false if we should fall back to the manual UI.
   */
  private tryReloadOnceForChunkError(): boolean {
    if (typeof window === 'undefined') return false;
    const RELOAD_GUARD_KEY = 'agi-chunk-reload-at';
    try {
      const prev = window.sessionStorage.getItem(RELOAD_GUARD_KEY);
      if (prev && (Date.now() - Number(prev)) < 30_000)
        return false; // already auto-reloaded recently - don't loop
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
    } catch {
      return false; // sessionStorage unavailable (private mode etc.) - don't risk a loop
    }
    window.location.reload();
    return true;
  }

  resetErrorBoundary = (): void => {
    const { onReset } = this.props;
    onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { outer, children, fallback } = this.props;
    const isChunkLoad = isChunkLoadError(error);
    const heading = isChunkLoad ? 'Update Required' : 'Oops, we hit a snag';
    const message = isChunkLoad
      ? 'A part of Big-AGI could not be loaded. This usually happens when the app has been updated while this tab is still running, '
        + 'so the loaded app and deployed files are out of sync. Reloading should fetch the current version.'
      : `An unexpected error occurred.${outer ? ' Please try reloading Big-AGI.' : ''}`;

    if (hasError && error)
      return fallback ? fallback : (
        <div className='sherpa stopped' style={outer ? {
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        } : {
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}>
          <div className='vcontent' style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '-2%',
            marginInline: '1.5rem',
            maxWidth: '90%',
          }}>
            <div className='vivided'>
              <h2 className='heading'>{heading}</h2>
              <div className='message'>
                <p style={{ fontWeight: 500 }}>{message}</p>
                {outer && (
                  <p style={{ fontWeight: 500 }}>
                    {' '}If the issue persists, please{' '}
                    <a href={BaseProduct.SupportForm()} target='_blank' rel='noopener noreferrer' style={{ color: 'inherit', textDecoration: 'underline' }}>
                      Contact Support
                    </a>.
                  </p>
                )}
                {/* Dev-only stack trace */}
                {/*{!Release.IsNodeDevBuild ? (*/}
                {/*  <div style={{ opacity: 0.5 }}>*/}
                {/*    {error?.message}*/}
                {/*  </div>*/}
                {/*) : (*/}
                <details>
                  <summary style={{ cursor: 'pointer' }}>Error Details (Dev)</summary>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{`---\n${error?.toString()}\n---\nStack:\n${error?.stack}`}</div>
                </details>
                {/*)}*/}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              {outer || isChunkLoad ? (
                <button className='button' onClick={() => window.location.reload()}>
                  Reload Big-AGI
                </button>
              ) : (
                <button className='button' onClick={() => this.resetErrorBoundary()}>
                  Clear Error
                </button>
              )}
            </div>
          </div>
        </div>
      );

    return children;
  }
}
