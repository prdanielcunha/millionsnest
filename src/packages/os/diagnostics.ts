/*
 * Diagnostics Engine: Centralized Sentry-ready Telemetry & Structured Logging
 */
import { ProtocolDiagnostic } from "../../sdk/ecosystem.js";
import { eventBus } from "../events/index.js";

export type SeverityLevel = 'info' | 'warn' | 'error' | 'fatal';

export interface TraceLog {
  id: string;
  timestamp: number;
  message: string;
  severity: SeverityLevel;
  module: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

class DiagnosticsEngine {
  private static instance: DiagnosticsEngine;
  private traces: TraceLog[] = [];
  private maxTraces = 500;
  
  // Sentry-ready mock configuration
  private isSentryReady = false;

  private constructor() {
    this.setupErrorListeners();
  }

  public static getInstance() {
    if (!DiagnosticsEngine.instance) {
      DiagnosticsEngine.instance = new DiagnosticsEngine();
    }
    return DiagnosticsEngine.instance;
  }

  private setupErrorListeners() {
    window.addEventListener('unhandledrejection', (event) => {
      this.log('Unhandled Promise Rejection', 'error', 'OS_RUNTIME', {
        reason: event.reason?.message || 'Unknown',
        stack: event.reason?.stack
      });
    });

    window.addEventListener('error', (event) => {
      this.log('Runtime Error', 'error', 'OS_RUNTIME', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        col: event.colno,
        stack: event.error?.stack
      });
    });
  }

  public log(message: string, severity: SeverityLevel = 'info', module: string = 'OS', metadata?: Record<string, any>) {
    const trace: TraceLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      message,
      severity,
      module,
      metadata,
      stackTrace: new Error().stack
    };

    this.traces.unshift(trace);
    if (this.traces.length > this.maxTraces) {
      this.traces.pop();
    }

    if (severity === 'error' || severity === 'fatal') {
      console.error(`[Diagnostics][${module}] ${message}`, metadata);
      eventBus.publish('system.telemetry.performance_alert' as any, {
        organizationId: '',
        userId: '',
        appSource: module,
        metadata: { error: message, severity }
      });
      this.reportToSentry(trace);
    } else {
      // console.log(`[Diagnostics][${module}] ${message}`);
    }
  }

  private reportToSentry(trace: TraceLog) {
    // Sentry-ready reporting structure
    if (this.isSentryReady) {
      // Sentry.captureException(...)
    }
  }

  public getTraces() {
    return this.traces;
  }

  public clearTraces() {
    this.traces = [];
  }
}

export const diagnosticsEngine = DiagnosticsEngine.getInstance();
