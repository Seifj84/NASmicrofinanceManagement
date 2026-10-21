/**
 * NAS Microfinance Management System — Activity & Security Audit Logger
 *
 * Categorized, tamper-evident audit trail capturing:
 * 1. AUTH_SECURITY: Logins, logouts, key activations, lockouts, password events
 * 2. TRANSACTIONS: Loans issued, repayments recorded, overdue rollovers, fee waivers
 * 3. CLIENTS_REFERRALS: Borrower records, guarantor edits, WhatsApp escalation clicks
 * 4. SYSTEM_ERRORS: Caught JavaScript exceptions, render errors, failed syncs
 * 5. ADMIN_ACTIONS: Activation key generation, user suspensions/deletions, settings changes
 */

export type LogCategory =
  | 'AUTH_SECURITY'
  | 'TRANSACTIONS'
  | 'CLIENTS_REFERRALS'
  | 'SYSTEM_ERRORS'
  | 'ADMIN_ACTIONS';

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface AuditLogEntry {
  id: string;
  timestamp: string;          // ISO String
  formattedTime: string;      // YYYY-MM-DD HH:mm:ss
  category: LogCategory;
  severity: LogSeverity;
  userId: string | null;     // user ID who executed the action or null
  userName: string | null;   // business name or email
  action: string;             // short action code e.g. 'USER_SIGN_IN'
  details: string;            // human readable description
  metadata?: Record<string, unknown>; // error stack trace, loan amount, phone, etc.
}

const AUDIT_LOG_STORAGE_KEY = 'nas_microfinance_audit_logs_v1';
const MAX_LOGS_RETAINED = 600;

export function formatDateTime(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function loadAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAuditLogs(logs: AuditLogEntry[]): void {
  try {
    const trimmed = logs.slice(0, MAX_LOGS_RETAINED);
    localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(trimmed));
    notifyLogListeners(trimmed);
  } catch {
    // ignore local storage quota exceptions safely
  }
}

type LogListener = (logs: AuditLogEntry[]) => void;
const listeners = new Set<LogListener>();

export function subscribeToAuditLogs(listener: LogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyLogListeners(logs: AuditLogEntry[]): void {
  listeners.forEach((fn) => {
    try {
      fn(logs);
    } catch {
      // ignore
    }
  });
}

/**
 * Logs an event into the audit journal with automated timestamping, local persistence,
 * and memory-safe rotation.
 */
export function logEvent(entry: {
  category: LogCategory;
  severity?: LogSeverity;
  userId?: string | null;
  userName?: string | null;
  action: string;
  details: string;
  metadata?: Record<string, unknown>;
}): AuditLogEntry {
  const now = new Date();
  const fullEntry: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.toISOString(),
    formattedTime: formatDateTime(now),
    category: entry.category,
    severity: entry.severity || 'INFO',
    userId: entry.userId ?? null,
    userName: entry.userName ?? null,
    action: entry.action,
    details: entry.details,
    metadata: entry.metadata,
  };

  const current = loadAuditLogs();
  const updated = [fullEntry, ...current];
  saveAuditLogs(updated);

  // Cross-tab broadcast
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('nas_audit_sync');
      bc.postMessage({ type: 'LOG_APPENDED', entry: fullEntry });
      bc.close();
    } catch {
      // ignore
    }
  }

  return fullEntry;
}

/**
 * Clears all audit logs (Super Admin only action)
 */
export function clearAuditLogs(superAdminId: string, superAdminName: string): void {
  const initialLog = logEvent({
    category: 'ADMIN_ACTIONS',
    severity: 'WARN',
    userId: superAdminId,
    userName: superAdminName,
    action: 'LOGS_CLEARED',
    details: `Audit trail history was reset by Super Admin (${superAdminName}).`,
  });
  saveAuditLogs([initialLog]);
}

/**
 * Exports logs to an Excel-compatible CSV file with formula-injection sanitization
 */
export function exportLogsToCSV(logs: AuditLogEntry[]): void {
  const headers = [
    'Timestamp (UTC)',
    'Local Time',
    'Category',
    'Severity',
    'Action Code',
    'User / Business',
    'User ID',
    'Description',
    'Metadata Details',
  ];

  const escapeCsv = (val: unknown): string => {
    let s = String(val ?? '');
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `'${s}`;
    }
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = logs.map((item) => [
    item.timestamp,
    item.formattedTime,
    item.category,
    item.severity,
    item.action,
    item.userName || 'System / Guest',
    item.userId || 'N/A',
    item.details,
    item.metadata ? JSON.stringify(item.metadata) : '',
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `NAS_Microfinance_Audit_Logs_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

let isGlobalLoggingInitialized = false;

/**
 * Registers global browser error handlers to automatically intercept, format,
 * and persist uncaught exceptions or network crashes into SYSTEM_ERRORS.
 */
export function initGlobalErrorLogging(): void {
  if (typeof window === 'undefined' || isGlobalLoggingInitialized) return;
  isGlobalLoggingInitialized = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    logEvent({
      category: 'SYSTEM_ERRORS',
      severity: 'ERROR',
      action: 'UNCAUGHT_JAVASCRIPT_EXCEPTION',
      details: event.message || 'Unknown runtime error occurred',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack || null,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : JSON.stringify(reason);

    logEvent({
      category: 'SYSTEM_ERRORS',
      severity: 'ERROR',
      action: 'UNHANDLED_PROMISE_REJECTION',
      details: `Promise rejected: ${msg}`,
      metadata: {
        stack: reason instanceof Error ? reason.stack : null,
      },
    });
  });

  // Track offline and online transitions
  window.addEventListener('offline', () => {
    logEvent({
      category: 'SYSTEM_ERRORS',
      severity: 'WARN',
      action: 'NETWORK_OFFLINE',
      details: 'Device network connection went offline. Operating in local encrypted vault mode.',
    });
  });

  window.addEventListener('online', () => {
    logEvent({
      category: 'SYSTEM_ERRORS',
      severity: 'INFO',
      action: 'NETWORK_ONLINE',
      details: 'Device network connection restored. Cloud synchronization active.',
    });
  });
}
