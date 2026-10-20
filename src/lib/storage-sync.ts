import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ActivationKey,
  Borrower,
  LoanRecord,
  RepaymentRecord,
  UserProfile,
  addDaysToDate,
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
      passwordHash: 'admin123',
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
      notes: 'Ready for new lender onboarding (Test Key)',
      createdBy: adminId,
      createdAt: today,
    },
    {
      id: 'key-2',
      keyCode: 'NAS-2026-4T7N-22LP',
      status: 'UNUSED',
      planName: 'STANDARD_LENDER',
      validityDays: 365,
      notes: 'Issued for Arusha Branch Partner',
      createdBy: adminId,
      createdAt: today,
    },
    {
      id: 'key-3',
      keyCode: 'NAS-2026-3M9B-71KQ',
      status: 'USED',
      planName: 'STANDARD_LENDER',
      validityDays: null,
      notes: 'Used & Expired immediately upon signup',
      createdBy: adminId,
      usedBy: 'user-demo-partner',
      usedByName: 'Kariakoo Micro-Credit (+255 765 800 900)',
      usedAt: addDaysToDate(today, -10),
      createdAt: addDaysToDate(today, -12),
    },
  ];

  const borrowers: Borrower[] = [
    {
      id: 'b-john',
      userId: adminId,
      fullName: 'John Mwangi',
      phoneNumber: '+255 712 999 888',
      nationalId: 'NIDA-19900101-12345-00001',
      collateralNotes: 'Toyota Noah Reg Card Copy & Shop Inventory Agreement',
      referralName: 'Musa Juma',
      referralPhone: '+255 754 111 222',
      referralRelationship: 'Business Partner',
      referralLocationOrId: 'Kariakoo Msimbazi Street, Shop #42, DSM',
      trustScore: 68,
      createdAt: addDaysToDate(today, -35),
    },
    {
      id: 'b-sarah',
      userId: adminId,
      fullName: 'Sarah Kimaro',
      phoneNumber: '+255 754 000 111',
      nationalId: 'NIDA-19930512-54321-00002',
      collateralNotes: 'Sinza Boutique Equipment & Guarantor Undertaking',
      referralName: 'Asha Ramadhani',
      referralPhone: '+255 784 333 444',
      referralRelationship: 'Colleague',
      referralLocationOrId: 'Posta Mpya CRDB Tower 4th Floor, DSM',
      trustScore: 98,
      createdAt: addDaysToDate(today, -28),
    },
    {
      id: 'b-kelvin',
      userId: adminId,
      fullName: 'Kelvin Mwakasege',
      phoneNumber: '+255 767 222 555',
      nationalId: 'NIDA-19881120-99887-00003',
      collateralNotes: 'Hardware Store Stock Receipt (Mwenge)',
      referralName: 'Baraka Nyerere',
      referralPhone: '+255 713 444 777',
      referralRelationship: 'Existing Trusted Client',
      referralLocationOrId: 'Mwenge Stand, Plot 18, DSM',
      trustScore: 95,
      createdAt: addDaysToDate(today, -15),
    },
    {
      id: 'b-neema',
      userId: adminId,
      fullName: 'Neema Mushi',
      phoneNumber: '+255 655 888 123',
      nationalId: 'NIDA-19950719-33221-00004',
      collateralNotes: 'Salon Equipment & Stock',
      referralName: 'Asha Ramadhani',
      referralPhone: '+255 784 333 444',
      referralRelationship: 'Family Member',
      referralLocationOrId: 'Kinondoni Studio, DSM',
      trustScore: 100,
      createdAt: addDaysToDate(today, -40),
    },
  ];

  const loans: LoanRecord[] = [
    {
      id: 'loan-1042',
      loanNumber: 'NAS-1042',
      userId: adminId,
      borrowerId: 'b-john',
      currency: 'TZS',
      principalAmount: 500000,
      interestRatePercent: 20,
      durationDays: 30,
      issueDate: addDaysToDate(today, -32),
      dueDate: addDaysToDate(today, -2),
      overdueRule: 'SIMPLE_ROLLOVER',
      dailyPenaltyPercent: 1,
      gracePeriodDays: 0,
      manualPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      amountPaid: 200000,
      notes: 'Short-term stock restock assistance. Overdue 2 days -> Cycle 2 Rollover applied.',
      auditLog: [
        {
          id: 'ev-1',
          timestamp: addDaysToDate(today, -32) + ' 11:10',
          type: 'ISSUED',
          description: 'Issued TZS 500,000 @ 20% for 30 days (Referred by Musa Juma)',
          amountTzs: 500000,
        },
        {
          id: 'ev-2',
          timestamp: addDaysToDate(today, -15) + ' 14:22',
          type: 'REPAYMENT',
          description: 'Partial payment via M-Pesa (Ref: QK892M11)',
          amountTzs: 200000,
        },
        {
          id: 'ev-3',
          timestamp: addDaysToDate(today, -1) + ' 00:01',
          type: 'OVERDUE_ROLLOVER',
          description: '30-Day deadline exceeded: +20% Simple Rollover (+TZS 100,000) applied automatically',
          amountTzs: 100000,
        },
      ],
      createdAt: addDaysToDate(today, -32),
      updatedAt: today,
    },
    {
      id: 'loan-1045',
      loanNumber: 'NAS-1045',
      userId: adminId,
      borrowerId: 'b-sarah',
      currency: 'TZS',
      principalAmount: 1500000,
      interestRatePercent: 20,
      durationDays: 30,
      issueDate: addDaysToDate(today, -28),
      dueDate: addDaysToDate(today, 2),
      overdueRule: 'SIMPLE_ROLLOVER',
      dailyPenaltyPercent: 1,
      gracePeriodDays: 0,
      manualPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      amountPaid: 600000,
      notes: 'Boutique import clearance assistance (Referred by Asha Ramadhani)',
      auditLog: [
        {
          id: 'ev-4',
          timestamp: addDaysToDate(today, -28) + ' 09:30',
          type: 'ISSUED',
          description: 'Issued TZS 1,500,000 @ 20% for 30 days (Referred by Asha Ramadhani)',
          amountTzs: 1500000,
        },
        {
          id: 'ev-5',
          timestamp: addDaysToDate(today, -10) + ' 16:05',
          type: 'REPAYMENT',
          description: 'Installment received via Tigo Pesa (Ref: TP904412)',
          amountTzs: 600000,
        },
      ],
      createdAt: addDaysToDate(today, -28),
      updatedAt: today,
    },
    {
      id: 'loan-1049',
      loanNumber: 'NAS-1049',
      userId: adminId,
      borrowerId: 'b-kelvin',
      currency: 'TZS',
      principalAmount: 2000000,
      interestRatePercent: 20,
      durationDays: 30,
      issueDate: addDaysToDate(today, -12),
      dueDate: addDaysToDate(today, 18),
      overdueRule: 'COMPOUND_ROLLOVER',
      dailyPenaltyPercent: 1,
      gracePeriodDays: 0,
      manualPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      amountPaid: 0,
      notes: 'Cement & roofing sheets wholesale order (Referred by Baraka Nyerere)',
      auditLog: [
        {
          id: 'ev-6',
          timestamp: addDaysToDate(today, -12) + ' 10:15',
          type: 'ISSUED',
          description: 'Issued TZS 2,000,000 @ 20% for 30 days (Referred by Baraka Nyerere)',
          amountTzs: 2000000,
        },
      ],
      createdAt: addDaysToDate(today, -12),
      updatedAt: today,
    },
    {
      id: 'loan-1038',
      loanNumber: 'NAS-1038',
      userId: adminId,
      borrowerId: 'b-neema',
      currency: 'TZS',
      principalAmount: 800000,
      interestRatePercent: 20,
      durationDays: 30,
      issueDate: addDaysToDate(today, -40),
      dueDate: addDaysToDate(today, -10),
      overdueRule: 'SIMPLE_ROLLOVER',
      dailyPenaltyPercent: 1,
      gracePeriodDays: 0,
      manualPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      amountPaid: 960000,
      notes: 'Cleared on time in full.',
      auditLog: [
        {
          id: 'ev-7',
          timestamp: addDaysToDate(today, -40) + ' 13:00',
          type: 'ISSUED',
          description: 'Issued TZS 800,000 @ 20% for 30 days',
          amountTzs: 800000,
        },
        {
          id: 'ev-8',
          timestamp: addDaysToDate(today, -12) + ' 17:45',
          type: 'REPAYMENT',
          description: 'Full settlement via M-Pesa (Ref: QK771L99)',
          amountTzs: 960000,
        },
      ],
      createdAt: addDaysToDate(today, -40),
      updatedAt: addDaysToDate(today, -12),
    },
  ];

  const repayments: RepaymentRecord[] = [
    {
      id: 'rep-1',
      userId: adminId,
      loanId: 'loan-1042',
      amount: 200000,
      paymentMethod: 'M_PESA',
      referenceNote: 'M-Pesa Ref QK892M11',
      paidAt: addDaysToDate(today, -15) + ' 14:22',
    },
    {
      id: 'rep-2',
      userId: adminId,
      loanId: 'loan-1045',
      amount: 600000,
      paymentMethod: 'TIGO_PESA',
      referenceNote: 'Tigo Pesa Ref TP904412',
      paidAt: addDaysToDate(today, -10) + ' 16:05',
    },
    {
      id: 'rep-3',
      userId: adminId,
      loanId: 'loan-1038',
      amount: 960000,
      paymentMethod: 'M_PESA',
      referenceNote: 'M-Pesa Ref QK771L99',
      paidAt: addDaysToDate(today, -12) + ' 17:45',
    },
  ];

  return {
    users,
    activationKeys,
    borrowers,
    loans,
    repayments,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function loadAppState(): AppStateData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createInitialSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as AppStateData;
  } catch {
    return createInitialSeedState();
  }
}

export function saveAppState(state: AppStateData): void {
  const updated: AppStateData = {
    ...state,
    lastSyncedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const bc = new BroadcastChannel('nas_microfinance_sync');
    bc.postMessage({ type: 'STATE_UPDATED', payload: updated });
    bc.close();
  }
  // Also push to Supabase Cloud asynchronously if configured
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

export function loadCloudConfig(): CloudSyncConfig {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CloudSyncConfig;
      if (parsed.supabaseUrl && parsed.supabaseAnonKey) return parsed;
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
  if (!activeCfg.enabled || !activeCfg.supabaseUrl || !activeCfg.supabaseAnonKey) return null;
  try {
    return createClient(activeCfg.supabaseUrl, activeCfg.supabaseAnonKey);
  } catch {
    return null;
  }
}

export async function pushStateToSupabaseCloud(state: AppStateData): Promise<boolean> {
  const client = createSupabaseClientIfConfigured();
  if (!client) return false;
  try {
    const { error } = await client.from('nas_cloud_state').upsert(
      {
        id: 'global_workspace',
        payload: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
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
    const remoteState = data.payload as AppStateData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteState));
    return remoteState;
  } catch {
    return null;
  }
}
