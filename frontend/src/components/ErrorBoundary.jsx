import React from 'react';

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
    
    // You can also log to an error reporting service here
  }

  render() {
    if (this.state.hasError) {
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
          <h2 style={{ margin: '0 0 10px 0' }}>⚠️ Something went wrong</h2>
          <p style={{ margin: '0 0 10px 0' }}>
            <strong>Error:</strong> {this.state.error?.message || 'Unknown error'}
          </p>
          {this.state.errorInfo && (
            <details style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
              <summary>Component Stack</summary>
              {this.state.errorInfo.componentStack}
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '15px',
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
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
