import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ActivationKey,
  Borrower,
  LoanRecord,
  RepaymentRecord,
  UserProfile,
  addDaysToDate,
  hashPassword,
  isPasswordHashed,
} from './finance-engine';

export interface AppStateData {
  users: UserProfile[];
  activationKeys: ActivationKey[];
  borrowers: Borrower[];
  loans: LoanRecord[];
  repayments: RepaymentRecord[];
  lastSyncedAt: string;
}

export interface CloudSyncConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enabled: boolean;
}

const STORAGE_KEY = 'nas_microfinance_tzs_state_v1';
const SESSION_USER_KEY = 'nas_microfinance_active_user_id';
const CLOUD_CONFIG_KEY = 'nas_microfinance_cloud_config';

export function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createInitialSeedState(): AppStateData {
  const today = getTodayIso();
  const adminId = 'user-super-admin';

  const users: UserProfile[] = [
    {
      id: adminId,
      businessName: 'NAS Financial Assistance TZ (HQ)',
      emailOrPhone: 'admin@nas.co.tz',
      passwordHash:
        'sha256:nas_tzs_v1:2c04724193f89a0b9727654fd610721683fdd5efa349db56a77e6a010ff3a10c',
      role: 'SUPER_ADMIN',
      defaultCurrency: 'TZS',
      defaultInterestRate: 20,
      defaultDurationDays: 30,
      accountStatus: 'ACTIVE',
      createdAt: addDaysToDate(today, -60),
    },
  ];

  const activationKeys: ActivationKey[] = [
    {
      id: 'key-1',
      keyCode: 'NAS-2026-8F4K-99XM',
      status: 'UNUSED',
      planName: 'STANDARD_LENDER',
      validityDays: null,
      notes: 'Standard Lender License Key',
      createdBy: adminId,
      createdAt: today,
    },
    {
      id: 'key-2',
      keyCode: 'NAS-2026-4T7N-22LP',
      status: 'UNUSED',
      planName: 'STANDARD_LENDER',
      validityDays: 365,
      notes: 'Annual Partner License Key',
      createdBy: adminId,
      createdAt: today,
    },
  ];

  const borrowers: Borrower[] = [];
  const loans: LoanRecord[] = [];
  const repayments: RepaymentRecord[] = [];

  return {
    users,
    activationKeys,
    borrowers,
    loans,
    repayments,
    lastSyncedAt: new Date().toISOString(),
  };
}

const ENC_PREFIX = 'ENC_NAS_V1:';
const ENC_KEY = 'NAS_TZS_LOCAL_VAULT_KEY_2026';

function encryptLocalPayload(jsonStr: string): string {
  try {
    const bytes = new TextEncoder().encode(jsonStr);
    const keyBytes = new TextEncoder().encode(ENC_KEY);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    }
    let bin = '';
    for (let i = 0; i < out.length; i++) {
      bin += String.fromCharCode(out[i]);
    }
    return ENC_PREFIX + btoa(bin);
  } catch {
    return jsonStr;
  }
}

function decryptLocalPayload(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  try {
    const b64 = stored.slice(ENC_PREFIX.length);
    const bin = atob(b64);
    const keyBytes = new TextEncoder().encode(ENC_KEY);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(out);
  } catch {
    return stored;
  }
}

const LEGACY_DUMMY_BORROWER_IDS = new Set(['b-john', 'b-sarah', 'b-kelvin', 'b-neema']);
const LEGACY_DUMMY_LOAN_IDS = new Set(['loan-1042', 'loan-1045', 'loan-1049', 'loan-1038']);
const LEGACY_DUMMY_REP_IDS = new Set(['rep-1', 'rep-2', 'rep-3']);
const LEGACY_DUMMY_KEY_IDS = new Set(['key-3']);

export function sanitizeStatePasswords(state: AppStateData): AppStateData {
  return {
    ...state,
    users: (state.users || []).map((u) => ({
      ...u,
      passwordHash: isPasswordHashed(u.passwordHash)
        ? u.passwordHash
        : hashPassword(u.passwordHash),
    })),
    activationKeys: (state.activationKeys || []).filter((k) => !LEGACY_DUMMY_KEY_IDS.has(k.id)),
    borrowers: (state.borrowers || []).filter((b) => !LEGACY_DUMMY_BORROWER_IDS.has(b.id)),
    loans: (state.loans || []).filter((l) => !LEGACY_DUMMY_LOAN_IDS.has(l.id)),
    repayments: (state.repayments || []).filter((r) => !LEGACY_DUMMY_REP_IDS.has(r.id)),
  };
}

export function loadAppState(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = sanitizeStatePasswords(createInitialSeedState());
      localStorage.setItem(STORAGE_KEY, encryptLocalPayload(JSON.stringify(seed)));
      return seed;
    }
    const decoded = decryptLocalPayload(raw);
    const parsed = sanitizeStatePasswords(JSON.parse(decoded) as AppStateData);
    return parsed;
  } catch {
    return sanitizeStatePasswords(createInitialSeedState());
  }
}

export function saveAppState(state: AppStateData): void {
  const updated: AppStateData = sanitizeStatePasswords({
    ...state,
    lastSyncedAt: new Date().toISOString(),
  });
  localStorage.setItem(STORAGE_KEY, encryptLocalPayload(JSON.stringify(updated)));
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const bc = new BroadcastChannel('nas_microfinance_sync');
    bc.postMessage({ type: 'STATE_UPDATED', payload: updated });
    bc.close();
  }
  void pushStateToSupabaseCloud(updated);
}

export function getActiveSessionUserId(): string | null {
  return localStorage.getItem(SESSION_USER_KEY);
}

export function setActiveSessionUserId(userId: string | null): void {
  if (userId) {
    localStorage.setItem(SESSION_USER_KEY, userId);
  } else {
    localStorage.removeItem(SESSION_USER_KEY);
  }
}

const DEFAULT_SUPABASE_URL = 'https://bmvltojicwzqzysdpbwn.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_8wphIwCU7odOPR0KOL644Q_ryhmgYtk';

export function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function loadCloudConfig(): CloudSyncConfig {
  const envUrl = normalizeSupabaseUrl(
    import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
  );
  const envKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  ).trim();
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CloudSyncConfig;
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) {
        return {
          supabaseUrl: normalizeSupabaseUrl(parsed.supabaseUrl),
          supabaseAnonKey: parsed.supabaseAnonKey.trim(),
          enabled: true,
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    supabaseUrl: envUrl,
    supabaseAnonKey: envKey,
    enabled: Boolean(envUrl && envKey),
  };
}

export function saveCloudConfig(cfg: CloudSyncConfig): void {
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cfg));
}

export function createSupabaseClientIfConfigured(cfg?: CloudSyncConfig): SupabaseClient | null {
  const activeCfg = cfg || loadCloudConfig();
  const cleanUrl = normalizeSupabaseUrl(activeCfg.supabaseUrl || '');
  if (!activeCfg.enabled || !cleanUrl || !activeCfg.supabaseAnonKey) return null;
  try {
    return createClient(cleanUrl, activeCfg.supabaseAnonKey.trim());
  } catch {
    return null;
  }
}

export async function pushStateToSupabaseCloud(state: AppStateData): Promise<boolean> {
  const client = createSupabaseClientIfConfigured();
  if (!client) return false;
  try {
    const cleanState = sanitizeStatePasswords(state);
    const nowIso = new Date().toISOString();

    const rowsToUpsert: Array<{ id: string; payload: unknown; updated_at: string }> = [
      {
        id: 'global_workspace',
        payload: cleanState,
        updated_at: nowIso,
      },
      {
        id: 'auth_registry',
        payload: {
          users: cleanState.users,
          activationKeys: cleanState.activationKeys,
          lastSyncedAt: nowIso,
        },
        updated_at: nowIso,
      },
    ];

    for (const user of cleanState.users) {
      rowsToUpsert.push({
        id: `tenant_${user.id}`,
        payload: {
          userId: user.id,
          borrowers: cleanState.borrowers.filter((b) => b.userId === user.id),
          loans: cleanState.loans.filter((l) => l.userId === user.id),
          repayments: cleanState.repayments.filter((r) => r.userId === user.id),
          lastSyncedAt: nowIso,
        },
        updated_at: nowIso,
      });
    }

    const { error } = await client
      .from('nas_cloud_state')
      .upsert(rowsToUpsert, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

export async function pullStateFromSupabaseCloud(): Promise<AppStateData | null> {
  const client = createSupabaseClientIfConfigured();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('nas_cloud_state')
      .select('payload')
      .eq('id', 'global_workspace')
      .maybeSingle();

    if (error || !data?.payload) return null;
    const remoteState = sanitizeStatePasswords(data.payload as AppStateData);
    localStorage.setItem(STORAGE_KEY, encryptLocalPayload(JSON.stringify(remoteState)));
    return remoteState;
  } catch {
    return null;
  }
}

export async function pushAuditLogsToSupabaseCloud(logs: unknown[]): Promise<boolean> {
  const client = createSupabaseClientIfConfigured();
  if (!client) return false;
  try {
    const trimmed = (Array.isArray(logs) ? logs : []).slice(0, 150);
    const { error } = await client.from('nas_cloud_state').upsert(
      [
        {
          id: 'cloud_audit_logs',
          payload: trimmed,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'id' }
    );
    return !error;
  } catch {
    return false;
  }
}

export async function pullAuditLogsFromSupabaseCloud(): Promise<unknown[] | null> {
  const client = createSupabaseClientIfConfigured();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('nas_cloud_state')
      .select('payload')
      .eq('id', 'cloud_audit_logs')
      .maybeSingle();

    if (error || !Array.isArray(data?.payload)) return null;
    return data.payload;
  } catch {
    return null;
  }
}

