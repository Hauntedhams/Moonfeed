import React from 'react';
import { reportClientError } from '../utils/crashReporter';

/**
 * Props:
 *  - title     heading for the fallback panel
 *  - resetKey  when it changes, a caught error is cleared (e.g. tab switch)
 *  - onError   called with the error (overlays use it to dismiss themselves)
 *  - fallback  optional (error, reset) => node to replace the default panel
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console
    console.error('🔴 ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
    reportClientError(error, { kind: 'render', boundary: this.props.title || 'ErrorBoundary', componentStack: errorInfo?.componentStack });
    try { this.props.onError?.(error, errorInfo); } catch (_) { /* never rethrow from here */ }
  }

  // Leaving the screen that crashed (resetKey changes) clears the error so the
  // user is never stuck on a dead tab.
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) this.reset();
  }

  reset = () => this.setState({ hasError: false, error: null, errorInfo: null });

  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }
      const isChunkError = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i
        .test(this.state.error?.message || '');
      // Fallback UI
      return (
        <div style={{
          padding: '20px',
          background: 'rgba(255, 0, 0, 0.1)',
          border: '2px solid #ff4444',
          borderRadius: '12px',
          margin: '20px',
          color: '#ff4444',
          fontFamily: 'monospace',
          fontSize: '14px'
        }}>
          <h2 style={{ margin: '0 0 10px 0' }}>⚠️ {this.props.title || 'Something went wrong'}</h2>
          <p style={{ margin: '0 0 10px 0' }}>
            {isChunkError
              ? 'A newer version of Moonfeed is available — reload to update.'
              : <><strong>Error:</strong> {this.state.error?.message || 'Unknown error'}</>}
          </p>
          {this.state.errorInfo && !isChunkError && (
            <details style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              <summary>Component Stack</summary>
              {this.state.errorInfo.componentStack}
            </details>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
            {!isChunkError && (
              <button
                onClick={this.reset}
                style={{ padding: '10px 20px', background: 'transparent', color: '#ff4444', border: '1px solid #ff4444', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                Try again
              </button>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
