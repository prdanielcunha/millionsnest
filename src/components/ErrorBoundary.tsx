import React, { ErrorInfo, ReactNode } from "react";
import { Loader2, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  props!: Props;
  state!: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    // Here we could also log to our internal telemetry if needed
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-[#2B85EB]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#2B85EB]/20">
            <RefreshCcw className="w-8 h-8 text-[#2B85EB]" />
          </div>
          <h1 className="text-2xl font-semibold text-[#F5F7FA] tracking-tight mb-2">
            Algo deu errado
          </h1>
          <p className="text-[#A0A7B5] text-sm max-w-sm mb-8">
            Encontramos um problema inesperado de conexão ou memória. Para estabilizar o ecossistema, por favor recarregue a página.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => {
                // Clear potentially problematic caches like dynamic imports or stale storage
                try {
                  localStorage.removeItem('mn_org_context');
                  sessionStorage.clear();
                } catch (e) {}
                window.location.reload();
              }}
              className="px-6 py-3 bg-[#F5F7FA] text-[#050505] rounded-xl font-semibold text-sm hover:bg-white transition-all active:scale-95"
            >
              Recarregar aplicação
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('mn_user_profile');
                  localStorage.removeItem('mn_org_context');
                } catch (e) {}
                window.location.href = '/login';
              }}
              className="px-6 py-3 bg-white/5 text-[#F5F7FA] border border-white/10 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all active:scale-95"
            >
              Forçar logout
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
