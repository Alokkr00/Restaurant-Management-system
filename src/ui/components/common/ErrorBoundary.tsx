import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="workspace-container flex flex-col items-center justify-center p-8 text-center" style={{ minHeight: '60vh' }}>
          <div className="card p-6 max-w-md w-full border border-danger/40 bg-card rounded-xl shadow-lg">
            <div className="flex items-center justify-center mb-4 text-rose">
              <AlertTriangle size={48} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Module Display Error</h3>
            <p className="text-muted text-sm mb-4">
              A temporary render exception occurred while displaying this workspace:
            </p>
            <div className="p-3 bg-app/80 border border-subtle rounded font-mono text-xs text-rose mb-6 text-left overflow-x-auto">
              {this.state.error?.message || 'Unknown render exception'}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                className="btn-primary"
                onClick={this.handleReset}
              >
                <RefreshCw size={14} />
                <span>Retry View</span>
              </button>
              <button
                className="btn-secondary"
                onClick={() => window.location.reload()}
              >
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
