import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          width: '100%',
          padding: '20px',
          boxSizing: 'border-box',
          backgroundColor: '#1e1e1e',
          color: '#f87171'
        }}>
          <AlertTriangle size={48} style={{ marginBottom: '16px' }} />
          <h2 style={{ margin: '0 0 16px', color: '#ef4444' }}>Terminal View Crashed</h2>
          <p style={{ margin: '0 0 16px', color: '#fca5a5', textAlign: 'center' }}>
            {this.state.error?.message || 'An unexpected error occurred in the terminal UI.'}
          </p>
          
          {this.state.errorInfo && (
            <pre style={{
              background: '#2d2d2d',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#d1d5db',
              overflowX: 'auto',
              maxWidth: '800px',
              width: '100%',
              marginBottom: '24px'
            }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}

          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              background: '#374151',
              color: '#fff',
              border: '1px solid #4b5563',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
