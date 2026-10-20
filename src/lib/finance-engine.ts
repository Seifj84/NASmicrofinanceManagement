export type OverdueRule =
  | 'SIMPLE_ROLLOVER'
  | 'COMPOUND_ROLLOVER'
  | 'DAILY_PENALTY'
  | 'MANUAL_PENALTY';

export type PaymentMethod =
  | 'M_PESA'
  | 'TIGO_PESA'
  | 'AIRTEL_MONEY'
  | 'HALOPESA'
  | 'BANK_TRANSFER'
  | 'CASH';

export type LoanStatus = 'ACTIVE' | 'DUE_SOON' | 'OVERDUE' | 'PAID' | 'DEFAULTED';

export type KeyStatus = 'UNUSED' | 'USED' | 'EXPIRED' | 'REVOKED';

export interface UserProfile {
  id: string;
  businessName: string;
  emailOrPhone: string;
  passwordHash: string;
  role: 'SUPER_ADMIN' | 'LENDER';
  defaultCurrency: 'TZS';
  defaultInterestRate: number;
  defaultDurationDays: number;
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';
  activatedWithKey?: string;
  createdAt: string;
}

export interface ActivationKey {
  id: string;
  keyCode: string;
  status: KeyStatus;
  planName: string;
  validityDays: number | null; // null = Lifetime
  notes: string;
  createdBy: string;
  usedBy?: string;
  usedByName?: string;
  usedAt?: string;
  createdAt: string;
}

export interface Borrower {
  id: string;
  userId: string;
  fullName: string;
  phoneNumber: string;
  nationalId: string;
  collateralNotes: string;
  // Mandatory Referral / Guarantor fields
  referralName: string;
  referralPhone: string;
  referralRelationship: string;
  referralLocationOrId: string;
  referredByBorrowerId?: string;
  trustScore: number;
  createdAt: string;
}

export interface RepaymentRecord {
  id: string;
  userId: string;
  loanId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNote: string;
  paidAt: string;
}

export interface LoanAuditEvent {
  id: string;
  timestamp: string;
  type: 'ISSUED' | 'REPAYMENT' | 'OVERDUE_ROLLOVER' | 'FEE_WAIVED' | 'DATE_EXTENDED';
  description: string;
  amountTzs?: number;
}

export interface LoanRecord {
  id: string;
  loanNumber: string;
  userId: string;
  borrowerId: string;
  currency: 'TZS';
  principalAmount: number;
  interestRatePercent: number;
  durationDays: number;
  issueDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  overdueRule: OverdueRule;
  dailyPenaltyPercent: number;
  gracePeriodDays: number;
  manualPenaltyAmount: number;
  waivedPenaltyAmount: number;
  amountPaid: number;
  notes: string;
  auditLog: LoanAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ComputedLoanMetrics {
  expectedBaseInterest: number;
  initialExpectedReturn: number;
  daysUntilDue: number;
  daysOverdue: number;
  rolloverCyclesCount: number;
  rawOverduePenalty: number;
  effectiveOverduePenalty: number;
  totalExpectedReturn: number;
  remainingBalance: number;
  realizedProfit: number;
  principalRecovered: number;
  status: LoanStatus;
  ifLateDay31Projection: number;
}

/**
 * Formats a numeric value in Tanzanian Shillings (TZS)
 * Example: formatTZS(500000) => "TZS 500,000"
 */
export function formatTZS(amount: number, includePrefix = true): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const formatted = rounded.toLocaleString('en-US');
  return includePrefix ? `TZS ${formatted}` : formatted;
}

/**
 * Adds a specified number of days to an ISO YYYY-MM-DD date string
 */
export function addDaysToDate(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(parts[0], (parts[1] || 1) - 1, parts[2] || 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns difference in whole days: (targetDate - referenceDate)
 */
export function diffInDays(targetIsoDate: string, referenceIsoDate: string): number {
  const tParts = targetIsoDate.split('-').map(Number);
  const rParts = referenceIsoDate.split('-').map(Number);
  const tUtc = Date.UTC(tParts[0], (tParts[1] || 1) - 1, tParts[2] || 1);
  const rUtc = Date.UTC(rParts[0], (rParts[1] || 1) - 1, rParts[2] || 1);
  return Math.round((tUtc - rUtc) / (1000 * 60 * 60 * 24));
}

/**
 * Core deterministic financial & "Or Else" overdue calculation engine
 */
export function computeLoanMetrics(
  loan: Pick<
    LoanRecord,
    | 'principalAmount'
    | 'interestRatePercent'
    | 'durationDays'
    | 'issueDate'
    | 'dueDate'
    | 'overdueRule'
    | 'dailyPenaltyPercent'
    | 'gracePeriodDays'
    | 'manualPenaltyAmount'
    | 'waivedPenaltyAmount'
    | 'amountPaid'
  >,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): ComputedLoanMetrics {
  const P = Math.max(0, Number(loan.principalAmount) || 0);
  const r = Math.max(0, Number(loan.interestRatePercent) || 0) / 100;
  const D = Math.max(1, Number(loan.durationDays) || 30);
  const grace = Math.max(0, Number(loan.gracePeriodDays) || 0);
  const paid = Math.max(0, Number(loan.amountPaid) || 0);
  const manualPen = Math.max(0, Number(loan.manualPenaltyAmount) || 0);
  const waivedPen = Math.max(0, Number(loan.waivedPenaltyAmount) || 0);

  const expectedBaseInterest = Math.round(P * r);
  const initialExpectedReturn = P + expectedBaseInterest;

  // Projection of what happens on Day (D + 1) if unpaid
  let ifLateDay31Projection = initialExpectedReturn;
  if (loan.overdueRule === 'SIMPLE_ROLLOVER') {
    ifLateDay31Projection = initialExpectedReturn + expectedBaseInterest;
  } else if (loan.overdueRule === 'COMPOUND_ROLLOVER') {
    ifLateDay31Projection = Math.round(initialExpectedReturn * (1 + r));
  } else if (loan.overdueRule === 'DAILY_PENALTY') {
    const dailyRate = Math.max(0, Number(loan.dailyPenaltyPercent) || 1) / 100;
    ifLateDay31Projection = initialExpectedReturn + Math.round(P * dailyRate);
  }

  const daysUntilDue = diffInDays(loan.dueDate, referenceDateIso);
  const rawDaysLate = -daysUntilDue;
  const isSettledBeforePenalty = paid >= initialExpectedReturn;

  let daysOverdue = 0;
  let rolloverCyclesCount = 0;
  let rawOverduePenalty = 0;

  if (!isSettledBeforePenalty && rawDaysLate > grace) {
    daysOverdue = rawDaysLate;
    rolloverCyclesCount = Math.ceil(daysOverdue / D);

    switch (loan.overdueRule) {
      case 'SIMPLE_ROLLOVER':
        rawOverduePenalty = rolloverCyclesCount * expectedBaseInterest;
        break;
      case 'COMPOUND_ROLLOVER': {
        const unpaidInitial = Math.max(0, initialExpectedReturn - paid);
        const compounded = Math.round(unpaidInitial * Math.pow(1 + r, rolloverCyclesCount));
        rawOverduePenalty = Math.max(0, compounded - unpaidInitial);
        break;
      }
      case 'DAILY_PENALTY': {
        const dailyRate = Math.max(0, Number(loan.dailyPenaltyPercent) || 1) / 100;
        rawOverduePenalty = Math.round(P * dailyRate * daysOverdue);
        break;
      }
      case 'MANUAL_PENALTY':
        rawOverduePenalty = 0;
        break;
    }
  }

  const effectiveOverduePenalty = Math.max(0, rawOverduePenalty + manualPen - waivedPen);
  const totalExpectedReturn = initialExpectedReturn + effectiveOverduePenalty;
  const remainingBalance = Math.max(0, totalExpectedReturn - paid);

  // Allocation order: 1. Penalty/Rollover -> 2. Base Interest -> 3. Principal
  const profitTarget = expectedBaseInterest + effectiveOverduePenalty;
  const realizedProfit = Math.min(paid, profitTarget);
  const principalRecovered = Math.max(0, Math.min(P, paid - profitTarget));

  let status: LoanStatus = 'ACTIVE';
  if (remainingBalance <= 0) {
    status = 'PAID';
  } else if (rawDaysLate > grace) {
    status = 'OVERDUE';
  } else if (daysUntilDue >= 0 && daysUntilDue <= 3) {
    status = 'DUE_SOON';
  }

  return {
    expectedBaseInterest,
    initialExpectedReturn,
    daysUntilDue,
    daysOverdue,
    rolloverCyclesCount,
    rawOverduePenalty,
    effectiveOverduePenalty,
    totalExpectedReturn,
    remainingBalance,
    realizedProfit,
    principalRecovered,
    status,
    ifLateDay31Projection,
  };
}

/**
 * Generates a formatted 16-char one-time Activation Key: NAS-2026-XXXX-XXXX
 */
export function generateActivationKeyCode(year = 2026): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const block = (len: number) =>
    Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  return `NAS-${year}-${block(4)}-${block(4)}`;
}

/**
 * Normalizes user-typed key input into NAS-YYYY-XXXX-XXXX format
 */
export function normalizeActivationKeyInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  if (cleaned.length <= 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}-${cleaned.slice(11, 15)}`;
}

/**
 * Evaluates a Referral / Guarantor's reliability across existing borrowers & loans
 */
export function evaluateReferralRisk(
  referralNameOrPhone: string,
  borrowers: Borrower[],
  loans: LoanRecord[],
  referenceDateIso?: string
): {
  referredCount: number;
  overdueReferredCount: number;
  overdueClientNames: string[];
} {
  const query = referralNameOrPhone.trim().toLowerCase();
  if (!query || query.length < 3) {
    return { referredCount: 0, overdueReferredCount: 0, overdueClientNames: [] };
  }

  const matchingBorrowers = borrowers.filter(
    (b) =>
      b.referralName.toLowerCase().includes(query) ||
      b.referralPhone.replace(/\s+/g, '').includes(query.replace(/\s+/g, ''))
  );

  const overdueClientNames: string[] = [];
  for (const b of matchingBorrowers) {
    const bLoans = loans.filter((l) => l.borrowerId === b.id);
    const hasOverdue = bLoans.some(
      (l) => computeLoanMetrics(l, referenceDateIso).status === 'OVERDUE'
    );
    if (hasOverdue) {
      overdueClientNames.push(b.fullName);
    }
  }

  return {
    referredCount: matchingBorrowers.length,
    overdueReferredCount: overdueClientNames.length,
    overdueClientNames,
  };
}
