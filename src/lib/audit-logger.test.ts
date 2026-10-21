import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  logEvent,
  loadAuditLogs,
  saveAuditLogs,
  exportLogsToCSV,
  formatDateTime,
} from './audit-logger.ts';
import type { AuditLogEntry } from './audit-logger.ts';

// Mock localStorage for test environment if not defined
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    length: 0,
  } as Storage;
}

describe('Audit Logger Engine Tests', () => {
  it('should format dates predictably', () => {
    const d = new Date(Date.UTC(2026, 9, 21, 10, 15, 30));
    const str = formatDateTime(d);
    assert.ok(str.includes('2026-10-21'));
  });

  it('should append log events with correct category and severity', () => {
    saveAuditLogs([]);
    const entry = logEvent({
      category: 'AUTH_SECURITY',
      severity: 'SUCCESS',
      userId: 'test-user-1',
      userName: 'Test Lender',
      action: 'USER_LOGIN',
      details: 'Logged in successfully',
      metadata: { ip: '127.0.0.1' },
    });

    assert.strictEqual(entry.category, 'AUTH_SECURITY');
    assert.strictEqual(entry.severity, 'SUCCESS');
    assert.strictEqual(entry.action, 'USER_LOGIN');

    const logs = loadAuditLogs();
    assert.strictEqual(logs.length, 1);
    assert.strictEqual(logs[0].id, entry.id);
  });

  it('should capture system error events with stack traces', () => {
    const errorEntry = logEvent({
      category: 'SYSTEM_ERRORS',
      severity: 'ERROR',
      action: 'RUNTIME_EXCEPTION',
      details: 'Uncaught test error',
      metadata: { stack: 'Error: boom\n  at test.ts:42' },
    });

    assert.strictEqual(errorEntry.category, 'SYSTEM_ERRORS');
    assert.strictEqual(errorEntry.severity, 'ERROR');
    assert.strictEqual(errorEntry.metadata?.stack, 'Error: boom\n  at test.ts:42');
  });
});
