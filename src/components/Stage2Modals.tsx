import React, { useState } from 'react';
import {
  X,
  Trash2,
  Save,
  ShieldCheck,
  Smartphone,
  Monitor,
  AlertTriangle,
} from 'lucide-react';
import {
  Borrower,
  ComputedLoanMetrics,
  LoanRecord,
  OverdueRule,
  UserProfile,
  addDaysToDate,
  formatTZS,
} from '../lib/finance-engine';

export function exportPortfolioToCSV(
  items: Array<{
    loan: LoanRecord;
    borrower?: Borrower;
    metrics: ComputedLoanMetrics;
  }>
): void {
  const headers = [
    'Loan Number',
    'Status',
    'Client Full Name',
    'Client Phone',
    'Client NIDA/ID',
    'Collateral Note',
    'Mandatory Referral Name',
    'Referral Phone',
    'Referral Relationship',
    'Referral Location/ID',
    'Principal Offered (TZS)',
    'Interest Rate (%)',
    'Duration (Days)',
    'Expected Base Interest (TZS)',
    'Overdue Rollover / Penalty (TZS)',
    'Total Expected Return (TZS)',
    'Amount Paid (TZS)',
    'Remaining Balance (TZS)',
    'Realized Profit (TZS)',
    'Issue Date',
    'Due Date',
    'Overdue Rule',
  ];

  const escapeCsv = (val: unknown): string => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = items.map(({ loan, borrower, metrics }) => [
    loan.loanNumber,
    metrics.status,
    borrower?.fullName || '',
    borrower?.phoneNumber || '',
    borrower?.nationalId || '',
    borrower?.collateralNotes || '',
    borrower?.referralName || '',
    borrower?.referralPhone || '',
    borrower?.referralRelationship || '',
    borrower?.referralLocationOrId || '',
    loan.principalAmount,
    loan.interestRatePercent,
    loan.durationDays,
    metrics.expectedBaseInterest,
    metrics.effectiveOverduePenalty,
    metrics.totalExpectedReturn,
    loan.amountPaid,
    metrics.remainingBalance,
    metrics.realizedProfit,
    loan.issueDate,
    loan.dueDate,
    loan.overdueRule,
  ]);

  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.setAttribute('download', `NAS_Microfinance_TZS_Portfolio_${today}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// EDIT OR DELETE CLIENT & MANDATORY REFERRAL MODAL (UPGRADE 3)
// ---------------------------------------------------------------------------
export function EditBorrowerModal({
  borrower,
  onClose,
  onSave,
  onDelete,
}: {
  borrower: Borrower;
  onClose: () => void;
  onSave: (updated: Borrower) => void;
  onDelete: (borrowerId: string) => void;
}) {
  const [fullName, setFullName] = useState(borrower.fullName);
  const [phoneNumber, setPhoneNumber] = useState(borrower.phoneNumber);
  const [nationalId, setNationalId] = useState(borrower.nationalId);
  const [collateralNotes, setCollateralNotes] = useState(borrower.collateralNotes);
  const [referralName, setReferralName] = useState(borrower.referralName);
  const [referralPhone, setReferralPhone] = useState(borrower.referralPhone);
  const [referralRelationship, setReferralRelationship] = useState(borrower.referralRelationship);
  const [referralLocationOrId, setReferralLocationOrId] = useState(borrower.referralLocationOrId);
  const [trustScore, setTrustScore] = useState(String(borrower.trustScore));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phoneNumber.trim() || !referralName.trim() || !referralPhone.trim()) {
      alert('Client Name, Phone, Referral Name, and Referral Phone are required.');
      return;
    }
    onSave({
      ...borrower,
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      nationalId: nationalId.trim(),
      collateralNotes: collateralNotes.trim(),
      referralName: referralName.trim(),
      referralPhone: referralPhone.trim(),
      referralRelationship: referralRelationship.trim(),
      referralLocationOrId: referralLocationOrId.trim(),
      trustScore: Math.min(100, Math.max(0, Number(trustScore) || 100)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#131C2E] border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base text-white">
            Edit Client &amp; Mandatory Referral Information
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#0B111E] border border-sky-500/30 space-y-3">
            <div className="text-xs font-bold uppercase text-sky-400">Client Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Client Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Client Phone *</label>
                <input
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">NIDA / ID</label>
                <input
                  type="text"
                  value={nationalId}
                  onChange={(e) => setNationalId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Trust Score (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={trustScore}
                  onChange={(e) => setTrustScore(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-emerald-400 font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Collateral / Notes</label>
              <input
                type="text"
                value={collateralNotes}
                onChange={(e) => setCollateralNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0B111E] border border-amber-500/40 space-y-3">
            <div className="text-xs font-bold uppercase text-amber-400">
              Mandatory Referral / Guarantor Details *
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Referral Full Name *</label>
                <input
                  type="text"
                  required
                  value={referralName}
                  onChange={(e) => setReferralName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Referral Phone *</label>
                <input
                  type="text"
                  required
                  value={referralPhone}
                  onChange={(e) => setReferralPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Relationship *</label>
                <select
                  value={referralRelationship}
                  onChange={(e) => setReferralRelationship(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                >
                  <option value="Business Partner">Business Partner</option>
                  <option value="Colleague">Colleague</option>
                  <option value="Existing Trusted Client">Existing Trusted Client</option>
                  <option value="Family Member">Family Member</option>
                  <option value="Employer">Employer</option>
                  <option value="Neighbor">Neighbor</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Location / Shop / ID</label>
                <input
                  type="text"
                  value={referralLocationOrId}
                  onChange={(e) => setReferralLocationOrId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete client "${borrower.fullName}" and all associated loans? This cannot be undone.`
                  )
                ) {
                  onDelete(borrower.id);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Client
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EDIT OR DELETE LOAN MODAL (UPGRADE 3)
// ---------------------------------------------------------------------------
export function EditLoanModal({
  loan,
  onClose,
  onSave,
  onDelete,
}: {
  loan: LoanRecord;
  onClose: () => void;
  onSave: (updated: LoanRecord) => void;
  onDelete: (loanId: string) => void;
}) {
  const [principal, setPrincipal] = useState(String(loan.principalAmount));
  const [rate, setRate] = useState(String(loan.interestRatePercent));
  const [days, setDays] = useState(String(loan.durationDays));
  const [issueDate, setIssueDate] = useState(loan.issueDate);
  const [dueDate, setDueDate] = useState(loan.dueDate);
  const [overdueRule, setOverdueRule] = useState<OverdueRule>(loan.overdueRule);
  const [amountPaid, setAmountPaid] = useState(String(loan.amountPaid));
  const [notes, setNotes] = useState(loan.notes);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const P = Math.max(1000, Math.round(Number(principal) || 0));
    const r = Math.max(0, Number(rate) || 0);
    const D = Math.max(1, Math.round(Number(days) || 30));
    const paid = Math.max(0, Math.round(Number(amountPaid) || 0));

    onSave({
      ...loan,
      principalAmount: P,
      interestRatePercent: r,
      durationDays: D,
      issueDate,
      dueDate,
      overdueRule,
      amountPaid: paid,
      notes: notes.trim(),
      updatedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#131C2E] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base text-white">
            Edit Loan #{loan.loanNumber} (TZS Terms)
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Principal (TZS)</label>
              <input
                type="number"
                required
                value={principal}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Interest Rate (%)</label>
              <input
                type="number"
                step="0.5"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-emerald-400 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Duration (Days)</label>
              <input
                type="number"
                required
                value={days}
                onChange={(e) => {
                  setDays(e.target.value);
                  const dNum = Number(e.target.value) || 30;
                  setDueDate(addDaysToDate(issueDate, dNum));
                }}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-white font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  setDueDate(addDaysToDate(e.target.value, Number(days) || 30));
                }}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Overdue "Or Else" Rule</label>
              <select
                value={overdueRule}
                onChange={(e) => setOverdueRule(e.target.value as OverdueRule)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-white"
              >
                <option value="SIMPLE_ROLLOVER">Simple Rollover (+Base Interest)</option>
                <option value="COMPOUND_ROLLOVER">Compound Rollover</option>
                <option value="DAILY_PENALTY">Daily Penalty (%)</option>
                <option value="MANUAL_PENALTY">Manual Flag Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Total Paid So Far (TZS)</label>
              <input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-amber-300 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Loan Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B111E] border border-slate-700 text-sm text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Delete Loan #${loan.loanNumber} (${formatTZS(loan.principalAmount)}) permanently?`
                  )
                ) {
                  onDelete(loan.id);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Loan
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> Update Loan
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ACCOUNT SECURITY & PORTFOLIO RESET MODAL (UPGRADE 1 & UPGRADE 2)
// ---------------------------------------------------------------------------
export function AccountSecurityModal({
  user,
  onClose,
  onUpdateProfile,
  onClearDemoPortfolio,
}: {
  user: UserProfile;
  onClose: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  onClearDemoPortfolio: () => void;
}) {
  const [businessName, setBusinessName] = useState(user.businessName);
  const [emailOrPhone, setEmailOrPhone] = useState(user.emailOrPhone);
  const [newPassword, setNewPassword] = useState(user.passwordHash);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !emailOrPhone.trim() || !newPassword.trim()) {
      alert('Business Name, Login Email/Phone, and Password cannot be empty.');
      return;
    }
    onUpdateProfile({
      ...user,
      businessName: businessName.trim(),
      emailOrPhone: emailOrPhone.trim(),
      passwordHash: newPassword,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#131C2E] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Account Security &amp; Live Portfolio Control
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Business / Lender Name
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#0B111E] border border-slate-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Login Email or Phone Number
            </label>
            <input
              type="text"
              required
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#0B111E] border border-slate-700 text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Login Password
            </label>
            <input
              type="text"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#0B111E] border border-emerald-500/50 text-sm text-emerald-300 font-mono"
            />
            <span className="text-[11px] text-slate-400">
              Change this from the default password so only you can access your Super Admin account.
            </span>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
          >
            ✓ Save My Login Credentials
          </button>
        </form>

        {/* Upgrade 2: Clear Sample Data (Start Fresh at TZS 0) */}
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2.5">
          <div className="text-xs font-bold uppercase text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Ready to Start Entering Real TZS Loans?
          </div>
          <p className="text-xs text-slate-300">
            Click below to wipe your current sample/demo clients and loans so your dashboard starts clean at <strong>TZS 0</strong>. Your login account and Activation Keys are kept safe.
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Clear all current clients, referrals, and loans in your workspace and start fresh at TZS 0?'
                )
              ) {
                onClearDemoPortfolio();
              }
            }}
            className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-slate-950 font-extrabold text-xs cursor-pointer"
          >
            🗑 Clear Sample Data &amp; Start Fresh at TZS 0
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PWA INSTALL GUIDE MODAL (UPGRADE 4)
// ---------------------------------------------------------------------------
export function InstallPwaModal({
  onClose,
  canTriggerNativeInstall,
  onTriggerNativeInstall,
}: {
  onClose: () => void;
  canTriggerNativeInstall: boolean;
  onTriggerNativeInstall: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#131C2E] border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-400" />
            Install NAS Microfinance App
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {canTriggerNativeInstall && (
          <button
            type="button"
            onClick={onTriggerNativeInstall}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm cursor-pointer shadow-lg"
          >
            📲 Install App Now (1-Click)
          </button>
        )}

        <div className="space-y-3 text-xs text-slate-300">
          <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800 space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Android Phone (Chrome)
            </div>
            <p>
              Tap the <strong>⋮ menu</strong> (top-right of Chrome) and select{' '}
              <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800 space-y-1">
            <div className="font-bold text-sky-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> iPhone / iPad (Safari)
            </div>
            <p>
              Tap the <strong>Share button (⬆️)</strong> at the bottom of Safari and tap{' '}
              <strong>"Add to Home Screen"</strong>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-[#0B111E] border border-slate-800 space-y-1">
            <div className="font-bold text-amber-300 flex items-center gap-1.5">
              <Monitor className="w-4 h-4" /> Windows / Mac Computer (Chrome or Edge)
            </div>
            <p>
              Click the <strong>Install icon (⊕)</strong> on the right side of your browser address bar to pin NAS Microfinance to your Desktop &amp; Taskbar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
