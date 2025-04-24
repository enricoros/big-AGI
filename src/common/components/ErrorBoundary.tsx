import * as React from 'react';

import { logger } from '~/common/logger';


export interface ErrorBoundaryProps {
  /** UNUSED: just marks the fact that this boundary is the outer */
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

    // Log the error using the custom logger
    logger.error(
      `ErrorBoundary caught an error in ${componentName}`,
      {
        error: { name: error.name, message: error.message, stack: error.stack },
        componentStack: errorInfo.componentStack,
      },
    );

    // Call the optional onError callback for external reporting
    onError?.(error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    const { onReset } = this.props;
    onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { outer, children, fallback } = this.props;

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
              <h2 className='heading'>Oops, we hit a snag</h2>
              <div className='message'>
                <p style={{ fontWeight: 500 }}>Something broke; this shouldn&apos;t happen.{outer ? ' Please try reloading Big-AGI.' : ''}</p>
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
              {outer ? (
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
