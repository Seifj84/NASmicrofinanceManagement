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
  if (!isoDate || typeof isoDate !== 'string') {
    isoDate = new Date().toISOString().slice(0, 10);
  }
  const parts = isoDate.split('-').map(Number);
  const year = parts[0] || 2026;
  const month = (parts[1] || 1) - 1;
  const day = parts[2] || 1;
  const dt = new Date(Date.UTC(year, month, day));
  dt.setUTCDate(dt.getUTCDate() + (Number(days) || 0));
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns difference in whole days: (targetDate - referenceDate)
 */
export function diffInDays(targetIsoDate: string, referenceIsoDate: string): number {
  if (!targetIsoDate || typeof targetIsoDate !== 'string') return 0;
  if (!referenceIsoDate || typeof referenceIsoDate !== 'string') {
    referenceIsoDate = new Date().toISOString().slice(0, 10);
  }
  const tParts = targetIsoDate.split('-').map(Number);
  const rParts = referenceIsoDate.split('-').map(Number);
  const tUtc = Date.UTC(tParts[0] || 2026, (tParts[1] || 1) - 1, tParts[2] || 1);
  const rUtc = Date.UTC(rParts[0] || 2026, (rParts[1] || 1) - 1, rParts[2] || 1);
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
 * Pure TypeScript SHA-256 implementation (FIPS 180-4) for synchronous,
 * cross-environment (Browser + Node.js) salted password hashing (SEC-02).
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Hex(ascii: string): string {
  const rightRotate = (value: number, amount: number) =>
    (value >>> amount) | (value << (32 - amount));

  const bytes: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const words = new Uint32Array((bytes.length + 8) / 4);
  for (let i = 0; i < bytes.length; i += 4) {
    words[i >> 2] =
      (bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3];
  }
  words[words.length - 2] = Math.floor(bitLen / 0x100000000);
  words[words.length - 1] = bitLen >>> 0;

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a,
    h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let i = 0; i < words.length; i += 16) {
    for (let t = 0; t < 16; t++) w[t] = words[i + t];
    for (let t = 16; t < 64; t++) {
      const s0 = rightRotate(w[t - 15], 7) ^ rightRotate(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rightRotate(w[t - 2], 17) ^ rightRotate(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7;

    for (let t = 0; t < 64; t++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + w[t]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((v) => v.toString(16).padStart(8, '0'))
    .join('');
}

const PASSWORD_HASH_PREFIX = 'sha256:nas_tzs_v1:';

export function isPasswordHashed(value: string): boolean {
  return value.startsWith(PASSWORD_HASH_PREFIX);
}

export function hashPassword(plainPassword: string, salt = 'nas_microfinance_tzs_salt_2026'): string {
  if (isPasswordHashed(plainPassword)) return plainPassword;
  const digest = sha256Hex(`${salt}:${plainPassword}`);
  return `${PASSWORD_HASH_PREFIX}${digest}`;
}

export function verifyPassword(plainCandidate: string, storedHashOrPlain: string): boolean {
  if (!storedHashOrPlain) return false;
  if (isPasswordHashed(storedHashOrPlain)) {
    return hashPassword(plainCandidate) === storedHashOrPlain;
  }
  return plainCandidate === storedHashOrPlain;
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

/**
 * Generates a memorable, secure temporary password (e.g. Nas#2026!7x9K)
 */
export function generateTemporaryPassword(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Nas#2026!${rand}`;
}

/**
 * Normalizes Tanzanian telephone numbers for international WhatsApp click-to-chat (wa.me/255...)
 */
export function formatTanzanianPhoneForWhatsApp(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/[^0-9]/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('255') && digits.length >= 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '255' + digits.slice(1);
  if (digits.length === 9) return '255' + digits;
  return digits;
}

