import assert from 'node:assert/strict';
import {
  formatTZS,
  addDaysToDate,
  computeLoanMetrics,
  normalizeActivationKeyInput,
  evaluateReferralRisk,
} from './finance-engine.ts';

console.log('Running NAS Microfinance (TZS) Financial Engine Tests...');

// 1. TZS Currency Formatting
assert.equal(formatTZS(500000), 'TZS 500,000');
assert.equal(formatTZS(12500000), 'TZS 12,500,000');

// 2. Date Calculation (30 Days Term)
assert.equal(addDaysToDate('2026-10-20', 30), '2026-11-19');

// 3. Base Loan Calculation (TZS 500,000 @ 20% for 30 days, Active)
const activeMetrics = computeLoanMetrics(
  {
    principalAmount: 500000,
    interestRatePercent: 20,
    durationDays: 30,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    overdueRule: 'SIMPLE_ROLLOVER',
    dailyPenaltyPercent: 1,
    gracePeriodDays: 0,
    manualPenaltyAmount: 0,
    waivedPenaltyAmount: 0,
    amountPaid: 0,
  },
  '2026-10-20'
);
assert.equal(activeMetrics.expectedBaseInterest, 100000);
assert.equal(activeMetrics.initialExpectedReturn, 600000);
assert.equal(activeMetrics.totalExpectedReturn, 600000);
assert.equal(activeMetrics.remainingBalance, 600000);
assert.equal(activeMetrics.status, 'ACTIVE');
assert.equal(activeMetrics.ifLateDay31Projection, 700000);

// 4. Overdue Simple Rollover ("Or Else" on Day 32 -> 2 days overdue)
const overdueSimple = computeLoanMetrics(
  {
    principalAmount: 500000,
    interestRatePercent: 20,
    durationDays: 30,
    issueDate: '2026-09-18',
    dueDate: '2026-10-18',
    overdueRule: 'SIMPLE_ROLLOVER',
    dailyPenaltyPercent: 1,
    gracePeriodDays: 0,
    manualPenaltyAmount: 0,
    waivedPenaltyAmount: 0,
    amountPaid: 200000,
  },
  '2026-10-20'
);
assert.equal(overdueSimple.status, 'OVERDUE');
assert.equal(overdueSimple.daysOverdue, 2);
assert.equal(overdueSimple.rolloverCyclesCount, 1);
assert.equal(overdueSimple.effectiveOverduePenalty, 100000); // +20% of 500k
assert.equal(overdueSimple.totalExpectedReturn, 700000);      // 500k + 100k + 100k
assert.equal(overdueSimple.remainingBalance, 500000);         // 700k - 200k paid

// 5. Overdue Compound Rollover
const overdueCompound = computeLoanMetrics(
  {
    principalAmount: 500000,
    interestRatePercent: 20,
    durationDays: 30,
    issueDate: '2026-09-18',
    dueDate: '2026-10-18',
    overdueRule: 'COMPOUND_ROLLOVER',
    dailyPenaltyPercent: 1,
    gracePeriodDays: 0,
    manualPenaltyAmount: 0,
    waivedPenaltyAmount: 0,
    amountPaid: 0,
  },
  '2026-10-20'
);
assert.equal(overdueCompound.effectiveOverduePenalty, 120000); // 20% of 600,000
assert.equal(overdueCompound.totalExpectedReturn, 720000);

// 6. Activation Key Input Normalization
assert.equal(normalizeActivationKeyInput('nas20268f4k99xm'), 'NAS-2026-8F4K-99XM');

// 7. Referral Risk Check
const risk = evaluateReferralRisk(
  'Musa Juma',
  [
    {
      id: 'b1',
      userId: 'u1',
      fullName: 'John Mwangi',
      phoneNumber: '+255 712 999 888',
      nationalId: '19900101',
      collateralNotes: '',
      referralName: 'Musa Juma',
      referralPhone: '+255 754 111 222',
      referralRelationship: 'Business Partner',
      referralLocationOrId: 'Kariakoo',
      trustScore: 70,
      createdAt: '2026-09-18',
    },
  ],
  [
    {
      id: 'l1',
      loanNumber: 'NAS-1001',
      userId: 'u1',
      borrowerId: 'b1',
      currency: 'TZS',
      principalAmount: 500000,
      interestRatePercent: 20,
      durationDays: 30,
      issueDate: '2026-09-18',
      dueDate: '2026-10-18',
      overdueRule: 'SIMPLE_ROLLOVER',
      dailyPenaltyPercent: 1,
      gracePeriodDays: 0,
      manualPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      amountPaid: 0,
      notes: '',
      auditLog: [],
      createdAt: '2026-09-18',
      updatedAt: '2026-09-18',
    },
  ],
  '2026-10-20'
);
assert.equal(risk.referredCount, 1);
assert.equal(risk.overdueReferredCount, 1);
assert.deepEqual(risk.overdueClientNames, ['John Mwangi']);

console.log('✓ All 7 TZS Financial & Referral Engine test suites passed!');
