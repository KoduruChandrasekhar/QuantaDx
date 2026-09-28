import { Component, type ReactNode } from 'react';
import { AlertOctagon, Copy, RefreshCw } from 'lucide-react';

interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const details = `${error.name}: ${error.message}\n\n${error.stack ?? ''}\n\nURL: ${window.location.pathname}`;
    return (
      <div role="alert" className="card mx-auto mt-10 max-w-xl p-8 text-center">
        <AlertOctagon className="mx-auto text-danger" size={36} />
        <h1 className="mt-3 font-serif text-2xl font-semibold text-heading">This view hit an error</h1>
        <p className="mt-2 text-sm text-muted">{error.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="inline-flex h-9 items-center gap-2 rounded-lg bg-classical px-4 text-sm font-medium text-white" onClick={() => this.setState({ error: null })}>
            <RefreshCw size={14} /> Try again
          </button>
          <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-fg" onClick={() => navigator.clipboard?.writeText(details)}>
            <Copy size={14} /> Copy error details
          </button>
        </div>
      </div>
    );
  }
}
