import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check } from 'lucide-react';
import { logEvent } from '../lib/audit-logger';
import { getActiveSessionUserId } from '../lib/storage-sync';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const activeUserId = getActiveSessionUserId();

    // Automatically record to audit logs under SYSTEM_ERRORS
    logEvent({
      category: 'SYSTEM_ERRORS',
      severity: 'ERROR',
      userId: activeUserId || null,
      userName: activeUserId ? `Active User (${activeUserId})` : 'Pre-Login / Anonymous',
      action: 'REACT_RENDER_CRASH',
      details: error.message || 'React component render crash',
      metadata: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      },
    });
  }

  handleCopyDetails = () => {
    const { error, errorInfo } = this.state;
    const text = `NAS Microfinance Error Report:\nError: ${error?.message}\n\nStack:\n${error?.stack}\n\nComponent Stack:\n${errorInfo?.componentStack}`;

    const fallbackCopy = () => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (success) {
          this.setState({ copied: true });
          setTimeout(() => this.setState({ copied: false }), 2500);
        }
      } catch {
        // Fallback gracefully without throwing
      }
    };

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          this.setState({ copied: true });
          setTimeout(() => this.setState({ copied: false }), 2500);
        })
        .catch(() => {
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      return (
        <div className="min-h-screen bg-[#0B111E] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-[#131C2E] border-2 border-red-500/40 rounded-2xl p-6 md:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
                <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">System Caught a Runtime Issue</h1>
                <p className="text-xs text-red-300">
                  The error was captured and logged into the technical audit journal.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0B111E] border border-slate-800 space-y-2 text-xs font-mono text-slate-300 overflow-x-auto max-h-56">
              <div className="font-bold text-red-400">
                {error?.name || 'Error'}: {error?.message || 'An unexpected glitch occurred.'}
              </div>
              {error?.stack && (
                <details className="pt-2 text-[11px] text-slate-400 cursor-pointer">
                  <summary className="font-sans font-semibold text-slate-400 hover:text-slate-200">
                    View Technical Diagnostics (Admin / Developer)
                  </summary>
                  <pre className="mt-2 text-slate-500 whitespace-pre-wrap">
                    {error.stack.slice(0, 500)}...
                  </pre>
                </details>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleCopyDetails}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied Error Report' : 'Copy Error Details'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload &amp; Recover Workspace</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
