import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  Users,
  KeyRound,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  MessageSquare,
  Copy,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Calculator,
  Printer,
  X,
  ArrowUpRight,
  Cloud,
  Sparkles,
  UserCheck,
  Wallet,
  Download,
  Edit3,
  Smartphone,
  Settings,
} from 'lucide-react';
import {
  AccountSecurityModal,
  EditBorrowerModal,
  EditLoanModal,
  InstallPwaModal,
  exportPortfolioToCSV,
} from './components/Stage2Modals';
import {
  ActivationKey,
  Borrower,
  LoanRecord,
  OverdueRule,
  PaymentMethod,
  RepaymentRecord,
  UserProfile,
  addDaysToDate,
  computeLoanMetrics,
  evaluateReferralRisk,
  formatTZS,
  generateActivationKeyCode,
  hashPassword,
  normalizeActivationKeyInput,
  verifyPassword,
} from './lib/finance-engine';
import {
  AppStateData,
  CloudSyncConfig,
  createInitialSeedState,
  createSupabaseClientIfConfigured,
  getActiveSessionUserId,
  getTodayIso,
  loadAppState,
  loadCloudConfig,
  pullStateFromSupabaseCloud,
  pushStateToSupabaseCloud,
  saveAppState,
  saveCloudConfig,
  setActiveSessionUserId,
} from './lib/storage-sync';

type NavTab = 'DASHBOARD' | 'LOANS' | 'BORROWERS' | 'CALCULATOR' | 'ADMIN_KEYS';

export default function App() {
  const [appState, setAppState] = useState<AppStateData>(() => loadAppState());
  const [currentUserId, setCurrentUserId] = useState<string | null>(() =>
    getActiveSessionUserId()
  );

  const [activeTab, setActiveTab] = useState<NavTab>('DASHBOARD');
  const [loanFilter, setLoanFilter] = useState<'ALL' | 'OVERDUE' | 'DUE_SOON' | 'ACTIVE' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(0);

  // Modals
  const [isNewLoanOpen, setIsNewLoanOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [editingBorrower, setEditingBorrower] = useState<Borrower | null>(null);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auth / Activation Screen state (when logged out)
  const [authMode, setAuthMode] = useState<'SIGN_IN' | 'ACTIVATE_KEY'>('SIGN_IN');
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [activationKeyInput, setActivationKeyInput] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newPhoneOrEmail, setNewPhoneOrEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [failedLoginCount, setFailedLoginCount] = useState<number>(0);
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number>(0);

  // New Financial Assistance (Loan + Mandatory Referral) Form State
  const [selectedExistingBorrowerId, setSelectedExistingBorrowerId] = useState<string>('NEW');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('+255 ');
  const [clientNationalId, setClientNationalId] = useState('');
  const [clientCollateral, setClientCollateral] = useState('');
  // Mandatory Referral Fields
  const [referralName, setReferralName] = useState('');
  const [referralPhone, setReferralPhone] = useState('+255 ');
  const [referralRelationship, setReferralRelationship] = useState('Business Partner');
  const [referralLocation, setReferralLocation] = useState('');
  // Loan Financial Fields (TZS)
  const [principalInput, setPrincipalInput] = useState('500000');
  const [interestRateInput, setInterestRateInput] = useState('20');
  const [durationDaysInput, setDurationDaysInput] = useState('30');
  const [issueDateInput, setIssueDateInput] = useState(() => getTodayIso());
  const [overdueRuleInput, setOverdueRuleInput] = useState<OverdueRule>('SIMPLE_ROLLOVER');
  const [dailyPenaltyInput, setDailyPenaltyInput] = useState('1');
  const [loanNotesInput, setLoanNotesInput] = useState('');

  // Repayment Drawer Form State
  const [repaymentAmountInput, setRepaymentAmountInput] = useState('');
  const [repaymentMethodInput, setRepaymentMethodInput] = useState<PaymentMethod>('M_PESA');
  const [repaymentRefInput, setRepaymentRefInput] = useState('');

  // Standalone Calculator State
  const [calcPrincipal, setCalcPrincipal] = useState('1000000');
  const [calcRate, setCalcRate] = useState('20');
  const [calcDays, setCalcDays] = useState('30');
  const [calcRule, setCalcRule] = useState<OverdueRule>('SIMPLE_ROLLOVER');

  // Admin Key Generator State
  const [newKeyNotes, setNewKeyNotes] = useState('');
  const [newKeyValidityDays, setNewKeyValidityDays] = useState<string>('LIFETIME');
  const [adminScopeUserId, setAdminScopeUserId] = useState<string>('SELF');

  // Cloud Config State
  const [cloudConfig, setCloudConfig] = useState<CloudSyncConfig>(() => loadCloudConfig());

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3800);
  };

  // 15-minute Idle Session Auto-Lock (SEC-04)
  useEffect(() => {
    if (!currentUserId) return;
    let timer: ReturnType<typeof setTimeout>;
    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setCurrentUserId(null);
        setActiveSessionUserId(null);
      }, 15 * 60 * 1000);
    };
    resetIdleTimer();
    const events = ['mousemove', 'keydown', 'click', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetIdleTimer, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetIdleTimer));
    };
  }, [currentUserId]);

  // Listen to PWA beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen to cross-tab BroadcastChannel updates & Supabase Cloud Realtime Sync
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    const bc = new BroadcastChannel('nas_microfinance_sync');
    bc.onmessage = (ev) => {
      if (ev.data?.type === 'STATE_UPDATED' && ev.data.payload) {
        setAppState(ev.data.payload);
      }
    };
    return () => bc.close();
  }, []);

  useEffect(() => {
    const client = createSupabaseClientIfConfigured(cloudConfig);
    if (!client) return;

    // Initial cloud pull (or seed cloud if empty)
    pullStateFromSupabaseCloud().then((remote) => {
      if (remote) {
        setAppState(remote);
      } else {
        void pushStateToSupabaseCloud(appState);
      }
    });

    const channel = client
      .channel('nas_cloud_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nas_cloud_state' },
        (payload) => {
          const next = (payload.new as { payload?: AppStateData })?.payload;
          if (next && next.lastSyncedAt) {
            setAppState(next);
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [cloudConfig.enabled, cloudConfig.supabaseUrl, cloudConfig.supabaseAnonKey]);

  const currentUser = useMemo(
    () => appState.users.find((u) => u.id === currentUserId) || null,
    [appState.users, currentUserId]
  );

  // Tenant-isolated data for regular users; Super Admin can inspect SELF, ALL, or any specific userId
  const userBorrowers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'SUPER_ADMIN') {
      if (adminScopeUserId === 'ALL') return appState.borrowers;
      if (adminScopeUserId !== 'SELF') {
        return appState.borrowers.filter((b) => b.userId === adminScopeUserId);
      }
    }
    return appState.borrowers.filter((b) => b.userId === currentUser.id);
  }, [appState.borrowers, currentUser, adminScopeUserId]);

  const userLoans = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'SUPER_ADMIN') {
      if (adminScopeUserId === 'ALL') return appState.loans;
      if (adminScopeUserId !== 'SELF') {
        return appState.loans.filter((l) => l.userId === adminScopeUserId);
      }
    }
    return appState.loans.filter((l) => l.userId === currentUser.id);
  }, [appState.loans, currentUser, adminScopeUserId]);

  const todayIso = getTodayIso();

  const enrichedLoans = useMemo(() => {
    return userLoans.map((loan) => {
      const borrower = userBorrowers.find((b) => b.id === loan.borrowerId);
      const metrics = computeLoanMetrics(loan, todayIso);
      return {
        loan,
        borrower,
        metrics,
      };
    });
  }, [userLoans, userBorrowers, todayIso]);

  const filteredLoans = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedLoans.filter(({ loan, borrower, metrics }) => {
      if (loanFilter !== 'ALL' && metrics.status !== loanFilter) return false;
      if (!q) return true;
      return (
        loan.loanNumber.toLowerCase().includes(q) ||
        borrower?.fullName.toLowerCase().includes(q) ||
        borrower?.phoneNumber.toLowerCase().includes(q) ||
        borrower?.referralName.toLowerCase().includes(q) ||
        borrower?.referralPhone.toLowerCase().includes(q) ||
        String(loan.principalAmount).includes(q)
      );
    });
  }, [enrichedLoans, loanFilter, searchQuery]);

  // Portfolio Dashboard Summary KPIs in TZS
  const dashboardKpis = useMemo(() => {
    let activePrincipalOffered = 0;
    let totalPrincipalAllTime = 0;
    let expectedProfitActive = 0;
    let totalExpectedCollectionActive = 0;
    let totalRemainingToCollect = 0;
    let overdueBalanceTotal = 0;
    let overdueLoansCount = 0;
    let dueSoonLoansCount = 0;
    let activeLoansCount = 0;
    let realizedProfitTotal = 0;
    let totalCollectedCash = 0;
    let weightedRateSum = 0;

    for (const { loan, metrics } of enrichedLoans) {
      totalPrincipalAllTime += loan.principalAmount;
      realizedProfitTotal += metrics.realizedProfit;
      totalCollectedCash += loan.amountPaid;

      if (metrics.status !== 'PAID') {
        activeLoansCount += 1;
        activePrincipalOffered += loan.principalAmount;
        expectedProfitActive += metrics.expectedBaseInterest + metrics.effectiveOverduePenalty;
        totalExpectedCollectionActive += metrics.totalExpectedReturn;
        totalRemainingToCollect += metrics.remainingBalance;
        weightedRateSum += loan.interestRatePercent;
      }
      if (metrics.status === 'OVERDUE') {
        overdueLoansCount += 1;
        overdueBalanceTotal += metrics.remainingBalance;
      }
      if (metrics.status === 'DUE_SOON') {
        dueSoonLoansCount += 1;
      }
    }

    const avgInterestRate =
      activeLoansCount > 0 ? (weightedRateSum / activeLoansCount).toFixed(1) : '20.0';

    return {
      activePrincipalOffered,
      totalPrincipalAllTime,
      expectedProfitActive,
      totalExpectedCollectionActive,
      totalRemainingToCollect,
      overdueBalanceTotal,
      overdueLoansCount,
      dueSoonLoansCount,
      activeLoansCount,
      realizedProfitTotal,
      totalCollectedCash,
      avgInterestRate,
    };
  }, [enrichedLoans]);

  const selectedLoanBundle = useMemo(
    () => enrichedLoans.find((item) => item.loan.id === selectedLoanId) || null,
    [enrichedLoans, selectedLoanId]
  );

  // Live New Loan Preview Metrics
  const liveNewLoanPreview = useMemo(() => {
    const P = Math.max(0, Number(principalInput.replace(/,/g, '')) || 0);
    const r = Math.max(0, Number(interestRateInput) || 0);
    const D = Math.max(1, Number(durationDaysInput) || 30);
    const dueDate = addDaysToDate(issueDateInput || todayIso, D);
    const metrics = computeLoanMetrics(
      {
        principalAmount: P,
        interestRatePercent: r,
        durationDays: D,
        issueDate: issueDateInput || todayIso,
        dueDate,
        overdueRule: overdueRuleInput,
        dailyPenaltyPercent: Number(dailyPenaltyInput) || 1,
        gracePeriodDays: 0,
        manualPenaltyAmount: 0,
        waivedPenaltyAmount: 0,
        amountPaid: 0,
      },
      issueDateInput || todayIso
    );
    const referralRisk = evaluateReferralRisk(
      referralName || referralPhone,
      userBorrowers,
      userLoans,
      todayIso
    );
    return { P, r, D, dueDate, metrics, referralRisk };
  }, [
    principalInput,
    interestRateInput,
    durationDaysInput,
    issueDateInput,
    overdueRuleInput,
    dailyPenaltyInput,
    referralName,
    referralPhone,
    userBorrowers,
    userLoans,
    todayIso,
  ]);

  // Auto-populate client + referral fields when an existing borrower is chosen
  useEffect(() => {
    if (selectedExistingBorrowerId === 'NEW') return;
    const found = userBorrowers.find((b) => b.id === selectedExistingBorrowerId);
    if (found) {
      setClientName(found.fullName);
      setClientPhone(found.phoneNumber);
      setClientNationalId(found.nationalId);
      setClientCollateral(found.collateralNotes);
      setReferralName(found.referralName);
      setReferralPhone(found.referralPhone);
      setReferralRelationship(found.referralRelationship);
      setReferralLocation(found.referralLocationOrId);
    }
  }, [selectedExistingBorrowerId, userBorrowers]);

  // Global Desktop Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (isNewLoanOpen) setIsNewLoanOpen(false);
        else if (selectedLoanId) setSelectedLoanId(null);
        else if (isCloudModalOpen) setIsCloudModalOpen(false);
        return;
      }

      // Preset shortcuts inside New Loan Modal (Alt+1, Alt+2, Alt+3)
      if (isNewLoanOpen && e.altKey) {
        if (e.key === '1') {
          e.preventDefault();
          setDurationDaysInput('7');
          setInterestRateInput('10');
        } else if (e.key === '2') {
          e.preventDefault();
          setDurationDaysInput('14');
          setInterestRateInput('15');
        } else if (e.key === '3') {
          e.preventDefault();
          setDurationDaysInput('30');
          setInterestRateInput('20');
        }
        return;
      }

      if (isInputFocused || !currentUser) return;

      const key = e.key.toLowerCase();
      if (key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === 'n') {
        e.preventDefault();
        setIsNewLoanOpen(true);
      } else if (key === 'd') {
        e.preventDefault();
        setActiveTab('DASHBOARD');
      } else if (key === 'l') {
        e.preventDefault();
        setActiveTab('LOANS');
      } else if (key === 'b') {
        e.preventDefault();
        setActiveTab('BORROWERS');
      } else if (key === 'c') {
        e.preventDefault();
        setActiveTab('CALCULATOR');
      } else if (key === 'k' && currentUser.role === 'SUPER_ADMIN') {
        e.preventDefault();
        setActiveTab('ADMIN_KEYS');
      } else if (key === 'o') {
        e.preventDefault();
        setLoanFilter((prev) => (prev === 'OVERDUE' ? 'ALL' : 'OVERDUE'));
        showToast('Toggled Overdue ("Or Else") Filter');
      } else if (key === 'j' || e.key === 'ArrowDown') {
        if (filteredLoans.length > 0) {
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.min(filteredLoans.length - 1, prev + 1));
        }
      } else if (key === 'k' || e.key === 'ArrowUp') {
        if (filteredLoans.length > 0) {
          e.preventDefault();
          setFocusedRowIndex((prev) => Math.max(0, prev - 1));
        }
      } else if (e.key === 'Enter' && !selectedLoanId && filteredLoans[focusedRowIndex]) {
        e.preventDefault();
        setSelectedLoanId(filteredLoans[focusedRowIndex].loan.id);
      } else if (key === 'f' && selectedLoanBundle) {
        e.preventDefault();
        setRepaymentAmountInput(String(selectedLoanBundle.metrics.remainingBalance));
        showToast(`Auto-filled full balance: ${formatTZS(selectedLoanBundle.metrics.remainingBalance)}`);
      } else if (key === 'w' && (selectedLoanBundle || filteredLoans[focusedRowIndex])) {
        e.preventDefault();
        const item = selectedLoanBundle || filteredLoans[focusedRowIndex];
        if (item?.borrower) openWhatsAppToClient(item.borrower, item.loan, item.metrics.remainingBalance);
      } else if (key === 'r' && (selectedLoanBundle || filteredLoans[focusedRowIndex])) {
        e.preventDefault();
        const item = selectedLoanBundle || filteredLoans[focusedRowIndex];
        if (item?.borrower) openWhatsAppToReferral(item.borrower, item.loan, item.metrics.remainingBalance);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isNewLoanOpen,
    selectedLoanId,
    isCloudModalOpen,
    currentUser,
    filteredLoans,
    focusedRowIndex,
    selectedLoanBundle,
  ]);

  // WhatsApp Helpers (Client & Referral)
  const openWhatsAppToClient = (borrower: Borrower, loan: LoanRecord, remainingTzs: number) => {
    const cleanPhone = borrower.phoneNumber.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Habari ${borrower.fullName}, ujumbe kutoka NAS Microfinance kuhusu msaada wa kifedha (${loan.loanNumber}) wa ${formatTZS(
        loan.principalAmount
      )} (${loan.interestRatePercent}% kwa siku ${loan.durationDays}). Salio linalodaiwa ni ${formatTZS(
        remainingTzs
      )} (Tarehe ya mwisho: ${loan.dueDate}). Tafadhali kamilisha malipo kwa wakati.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  const openWhatsAppToReferral = (borrower: Borrower, loan: LoanRecord, remainingTzs: number) => {
    const cleanPhone = borrower.referralPhone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Habari ${borrower.referralName}, tunakutaarifu kutoka NAS Microfinance kuwa mteja uliyemtambulisha/kumdhamini (${borrower.fullName}, Simu: ${borrower.phoneNumber}) ana mkopo #${loan.loanNumber} wenye salio la ${formatTZS(
        remainingTzs
      )} (Tarehe ya marejesho: ${loan.dueDate}). Tunaomba ushirikiano wako.`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  // Handlers: Login & One-Time Activation Key Onboarding (SEC-02 Hardened)
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (Date.now() < lockoutUntilMs) {
      const waitSec = Math.ceil((lockoutUntilMs - Date.now()) / 1000);
      setAuthError(`Too many failed attempts. Please wait ${waitSec}s before trying again.`);
      return;
    }

    const user = appState.users.find(
      (u) =>
        u.emailOrPhone.toLowerCase() === signInIdentifier.trim().toLowerCase() &&
        verifyPassword(signInPassword, u.passwordHash)
    );
    if (!user) {
      const nextCount = failedLoginCount + 1;
      setFailedLoginCount(nextCount);
      if (nextCount >= 5) {
        setLockoutUntilMs(Date.now() + 30_000);
        setFailedLoginCount(0);
        setAuthError('5 failed login attempts detected. Login locked for 30 seconds.');
      } else {
        setAuthError(
          `Invalid email/phone or password (${5 - nextCount} attempts remaining before cooldown).`
        );
      }
      return;
    }
    if (user.accountStatus !== 'ACTIVE') {
      setAuthError(`Account status is ${user.accountStatus}. Contact Super Admin.`);
      return;
    }
    setFailedLoginCount(0);
    setLockoutUntilMs(0);
    setSignInPassword('');
    setCurrentUserId(user.id);
    setActiveSessionUserId(user.id);
    showToast(`Welcome back, ${user.businessName}!`);
  };

  const verifiedKeyObj = useMemo(() => {
    const formatted = normalizeActivationKeyInput(activationKeyInput);
    return appState.activationKeys.find((k) => k.keyCode === formatted) || null;
  }, [appState.activationKeys, activationKeyInput]);

  const handleActivateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const formattedKey = normalizeActivationKeyInput(activationKeyInput);
    const keyRecord = appState.activationKeys.find((k) => k.keyCode === formattedKey);

    if (!keyRecord) {
      setAuthError('Activation Key not found. Please check the 16-character code.');
      return;
    }
    if (keyRecord.status !== 'UNUSED') {
      setAuthError(
        `This Activation Key has already been ${keyRecord.status} and expired after usage.`
      );
      return;
    }
    if (!newBusinessName.trim() || !newPhoneOrEmail.trim() || !newPassword.trim()) {
      setAuthError('Please fill in your Business Name, Phone/Email, and Password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setAuthError('Password must be at least 6 characters long.');
      return;
    }
    const existingUser = appState.users.find(
      (u) => u.emailOrPhone.toLowerCase() === newPhoneOrEmail.trim().toLowerCase()
    );
    if (existingUser) {
      setAuthError('An account with this Phone/Email already exists.');
      return;
    }

    const newUserId = `user-${Date.now()}`;
    const newUser: UserProfile = {
      id: newUserId,
      businessName: newBusinessName.trim(),
      emailOrPhone: newPhoneOrEmail.trim(),
      passwordHash: hashPassword(newPassword.trim()),
      role: 'LENDER',
      defaultCurrency: 'TZS',
      defaultInterestRate: 20,
      defaultDurationDays: 30,
      accountStatus: 'ACTIVE',
      activatedWithKey: formattedKey,
      createdAt: getTodayIso(),
    };

    const updatedKeys: ActivationKey[] = appState.activationKeys.map((k) =>
      k.id === keyRecord.id
        ? {
            ...k,
            status: 'USED',
            usedBy: newUserId,
            usedByName: `${newUser.businessName} (${newUser.emailOrPhone})`,
            usedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          }
        : k
    );

    const nextState: AppStateData = {
      ...appState,
      users: [...appState.users, newUser],
      activationKeys: updatedKeys,
    };

    setAppState(nextState);
    saveAppState(nextState);
    setCurrentUserId(newUserId);
    setActiveSessionUserId(newUserId);
    setNewPassword('');
    setActivationKeyInput('');
    showToast('Account activated successfully!');
  };

  // Handler: Create New Financial Assistance (Loan + Mandatory Client Referral)
  const handleCreateLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!clientName.trim() || !clientPhone.trim()) {
      alert('Client Full Name and Phone Number are required.');
      return;
    }
    if (!referralName.trim() || !referralPhone.trim() || !referralRelationship.trim()) {
      alert(
        'Mandatory Referral Information is required: Please enter Referral Name, Referral Phone, and Relationship.'
      );
      return;
    }

    const P = Math.round(Number(principalInput.replace(/,/g, '')) || 0);
    if (P <= 0) {
      alert('Principal Offered (TZS) must be greater than 0.');
      return;
    }

    let borrowerId = selectedExistingBorrowerId;
    let updatedBorrowers = [...appState.borrowers];

    if (selectedExistingBorrowerId === 'NEW') {
      borrowerId = `b-${Date.now()}`;
      const newBorrower: Borrower = {
        id: borrowerId,
        userId: currentUser.id,
        fullName: clientName.trim(),
        phoneNumber: clientPhone.trim(),
        nationalId: clientNationalId.trim() || 'N/A',
        collateralNotes: clientCollateral.trim(),
        referralName: referralName.trim(),
        referralPhone: referralPhone.trim(),
        referralRelationship: referralRelationship.trim(),
        referralLocationOrId: referralLocation.trim(),
        trustScore: 100,
        createdAt: todayIso,
      };
      updatedBorrowers.unshift(newBorrower);
    } else {
      updatedBorrowers = updatedBorrowers.map((b) =>
        b.id === borrowerId
          ? {
              ...b,
              fullName: clientName.trim(),
              phoneNumber: clientPhone.trim(),
              nationalId: clientNationalId.trim(),
              collateralNotes: clientCollateral.trim(),
              referralName: referralName.trim(),
              referralPhone: referralPhone.trim(),
              referralRelationship: referralRelationship.trim(),
              referralLocationOrId: referralLocation.trim(),
            }
          : b
      );
    }

    const rate = Number(interestRateInput) || 20;
    const days = Number(durationDaysInput) || 30;
    const due = addDaysToDate(issueDateInput || todayIso, days);
    const loanNum = `NAS-${1050 + appState.loans.length + 1}`;

    const newLoan: LoanRecord = {
      id: `loan-${Date.now()}`,
      loanNumber: loanNum,
      userId: currentUser.id,
      borrowerId,
      currency: 'TZS',
      principalAmount: P,
      interestRatePercent: rate,
      durationDays: days,
      issueDate: issueDateInput || todayIso,
      dueDate: due,
      overdueRule: overdueRuleInput,
      dailyPenaltyPercent: Number(dailyPenaltyInput) || 1,
      gracePeriodDays: 0,
      manualPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      amountPaid: 0,
      notes: loanNotesInput.trim(),
      auditLog: [
        {
          id: `ev-${Date.now()}`,
          timestamp: `${todayIso} ${new Date().toTimeString().slice(0, 5)}`,
          type: 'ISSUED',
          description: `Issued ${formatTZS(P)} @ ${rate}% for ${days} days (Referred by ${referralName.trim()})`,
          amountTzs: P,
        },
      ],
      createdAt: todayIso,
      updatedAt: todayIso,
    };

    const nextState: AppStateData = {
      ...appState,
      borrowers: updatedBorrowers,
      loans: [newLoan, ...appState.loans],
    };

    setAppState(nextState);
    saveAppState(nextState);
    setIsNewLoanOpen(false);
    setSelectedLoanId(newLoan.id);
    showToast(`Issued ${loanNum}: ${formatTZS(P)} (${rate}% for ${days}d)`);

    // Reset form
    setSelectedExistingBorrowerId('NEW');
    setClientName('');
    setClientPhone('+255 ');
    setClientNationalId('');
    setClientCollateral('');
    setReferralName('');
    setReferralPhone('+255 ');
    setReferralLocation('');
    setLoanNotesInput('');
  };

  // Handler: Record TZS Repayment
  const handleRecordRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedLoanBundle) return;

    const amount = Math.round(Number(repaymentAmountInput.replace(/,/g, '')) || 0);
    if (amount <= 0) return;

    const { loan } = selectedLoanBundle;
    const nowStamp = `${todayIso} ${new Date().toTimeString().slice(0, 5)}`;

    const newRepayment: RepaymentRecord = {
      id: `rep-${Date.now()}`,
      userId: currentUser.id,
      loanId: loan.id,
      amount,
      paymentMethod: repaymentMethodInput,
      referenceNote: repaymentRefInput.trim() || `${repaymentMethodInput} Payment`,
      paidAt: nowStamp,
    };

    const updatedLoans = appState.loans.map((l) => {
      if (l.id !== loan.id) return l;
      return {
        ...l,
        amountPaid: l.amountPaid + amount,
        updatedAt: todayIso,
        auditLog: [
          {
            id: `ev-${Date.now()}`,
            timestamp: nowStamp,
            type: 'REPAYMENT' as const,
            description: `Repayment of ${formatTZS(amount)} via ${repaymentMethodInput.replace('_', ' ')} (${
              newRepayment.referenceNote
            })`,
            amountTzs: amount,
          },
          ...l.auditLog,
        ],
      };
    });

    const nextState: AppStateData = {
      ...appState,
      loans: updatedLoans,
      repayments: [newRepayment, ...appState.repayments],
    };

    setAppState(nextState);
    saveAppState(nextState);
    setRepaymentAmountInput('');
    setRepaymentRefInput('');
    showToast(`Recorded repayment of ${formatTZS(amount)} for ${loan.loanNumber}`);
  };

  // Handler: Waive Overdue Penalty or Extend Due Date
  const handleWaiveOverduePenalty = (loanId: string, penaltyToWaive: number) => {
    const nowStamp = `${todayIso} ${new Date().toTimeString().slice(0, 5)}`;
    const updatedLoans = appState.loans.map((l) => {
      if (l.id !== loanId) return l;
      return {
        ...l,
        waivedPenaltyAmount: l.waivedPenaltyAmount + penaltyToWaive,
        auditLog: [
          {
            id: `ev-${Date.now()}`,
            timestamp: nowStamp,
            type: 'FEE_WAIVED' as const,
            description: `Waived overdue rollover/penalty fee of ${formatTZS(penaltyToWaive)}`,
            amountTzs: penaltyToWaive,
          },
          ...l.auditLog,
        ],
      };
    });
    const nextState = { ...appState, loans: updatedLoans };
    setAppState(nextState);
    saveAppState(nextState);
    showToast(`Waived ${formatTZS(penaltyToWaive)} overdue fee.`);
  };

  const handleExtendDueDate = (loanId: string, extraDays: number) => {
    const nowStamp = `${todayIso} ${new Date().toTimeString().slice(0, 5)}`;
    const updatedLoans = appState.loans.map((l) => {
      if (l.id !== loanId) return l;
      const nextDue = addDaysToDate(l.dueDate, extraDays);
      return {
        ...l,
        dueDate: nextDue,
        auditLog: [
          {
            id: `ev-${Date.now()}`,
            timestamp: nowStamp,
            type: 'DATE_EXTENDED' as const,
            description: `Extended due date by +${extraDays} days to ${nextDue}`,
          },
          ...l.auditLog,
        ],
      };
    });
    const nextState = { ...appState, loans: updatedLoans };
    setAppState(nextState);
    saveAppState(nextState);
    showToast(`Extended loan deadline by +${extraDays} days.`);
  };

  // Handler: Super Admin Generate New Activation Key
  const handleGenerateKey = () => {
    if (!currentUser) return;
    const code = generateActivationKeyCode(2026);
    const newKey: ActivationKey = {
      id: `key-${Date.now()}`,
      keyCode: code,
      status: 'UNUSED',
      planName: 'STANDARD_LENDER',
      validityDays: newKeyValidityDays === 'LIFETIME' ? null : Number(newKeyValidityDays),
      notes: newKeyNotes.trim() || 'Standard Lender License (TZS)',
      createdBy: currentUser.id,
      createdAt: todayIso,
    };
    const nextState = {
      ...appState,
      activationKeys: [newKey, ...appState.activationKeys],
    };
    setAppState(nextState);
    saveAppState(nextState);
    setNewKeyNotes('');
    showToast(`Generated One-Time Activation Key: ${code}`);
  };

  // Stage 2 Upgrade Handlers: Edit/Delete Borrower, Edit/Delete Loan, Update Profile, Clear Demo Data
  const handleSaveEditedBorrower = (updated: Borrower) => {
    const nextState: AppStateData = {
      ...appState,
      borrowers: appState.borrowers.map((b) => (b.id === updated.id ? updated : b)),
    };
    setAppState(nextState);
    saveAppState(nextState);
    setEditingBorrower(null);
    showToast(`Updated client & referral details for ${updated.fullName}`);
  };

  const handleDeleteBorrower = (borrowerId: string) => {
    const nextState: AppStateData = {
      ...appState,
      borrowers: appState.borrowers.filter((b) => b.id !== borrowerId),
      loans: appState.loans.filter((l) => l.borrowerId !== borrowerId),
    };
    setAppState(nextState);
    saveAppState(nextState);
    setEditingBorrower(null);
    setSelectedLoanId(null);
    showToast('Deleted client and associated loans.');
  };

  const handleSaveEditedLoan = (updated: LoanRecord) => {
    const nextState: AppStateData = {
      ...appState,
      loans: appState.loans.map((l) => (l.id === updated.id ? updated : l)),
    };
    setAppState(nextState);
    saveAppState(nextState);
    setEditingLoan(null);
    showToast(`Updated Loan #${updated.loanNumber}`);
  };

  const handleDeleteLoan = (loanId: string) => {
    const nextState: AppStateData = {
      ...appState,
      loans: appState.loans.filter((l) => l.id !== loanId),
      repayments: appState.repayments.filter((r) => r.loanId !== loanId),
    };
    setAppState(nextState);
    saveAppState(nextState);
    setEditingLoan(null);
    setSelectedLoanId(null);
    showToast('Deleted loan record.');
  };

  const handleUpdateUserProfile = (updated: UserProfile) => {
    const nextState: AppStateData = {
      ...appState,
      users: appState.users.map((u) => (u.id === updated.id ? updated : u)),
    };
    setAppState(nextState);
    saveAppState(nextState);
    setIsSecurityModalOpen(false);
    showToast('Saved your login credentials & business profile!');
  };

  const handleClearDemoPortfolio = () => {
    if (!currentUser) return;
    const nextState: AppStateData = {
      ...appState,
      borrowers: appState.borrowers.filter((b) => b.userId !== currentUser.id),
      loans: appState.loans.filter((l) => l.userId !== currentUser.id),
      repayments: appState.repayments.filter((r) => r.userId !== currentUser.id),
    };
    setAppState(nextState);
    saveAppState(nextState);
    setIsSecurityModalOpen(false);
    setIsCloudModalOpen(false);
    setSelectedLoanId(null);
    showToast('Cleared sample data! Your TZS portfolio is now fresh at TZS 0.');
  };

  // ---------------------------------------------------------------------------
  // RENDER SCREEN 1: SIGN IN & SIGN UP (ACTIVATE ACCOUNT)
  // ---------------------------------------------------------------------------
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0B111E] text-slate-100 flex flex-col justify-center items-center p-4 md:p-8">
        <div className="max-w-md w-full space-y-6">
          {/* Clean Brand Header */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              NAS
            </div>
            <h1 className="font-bold text-xl tracking-tight text-white">
              NAS Microfinance
            </h1>
            <p className="text-xs text-slate-400">
              {authMode === 'SIGN_IN'
                ? 'Sign in to manage your lending portfolio'
                : 'Enter your activation key to create an account'}
            </p>
          </div>

          <main className="bg-[#131C2E] border border-slate-800/90 rounded-2xl p-6 md:p-7 shadow-2xl">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B111E] rounded-xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('SIGN_IN');
                  setAuthError(null);
                }}
                className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  authMode === 'SIGN_IN'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('ACTIVATE_KEY');
                  setAuthError(null);
                }}
                className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition cursor-pointer ${
                  authMode === 'ACTIVATE_KEY'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{authError}</span>
              </div>
            )}

            {authMode === 'SIGN_IN' ? (
              <form onSubmit={handleSignIn} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Email or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Email or phone number"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleActivateNewUser} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                    Activation Key
                  </label>
                  <input
                    type="text"
                    required
                    autoComplete="off"
                    value={activationKeyInput}
                    onChange={(e) =>
                      setActivationKeyInput(normalizeActivationKeyInput(e.target.value))
                    }
                    maxLength={19}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-emerald-500/60 font-mono text-sm tracking-widest text-emerald-300 uppercase focus:border-emerald-400 focus:outline-none"
                    placeholder="NAS-2026-XXXX-XXXX"
                  />
                  {verifiedKeyObj && (
                    <div className="mt-1.5 text-xs">
                      {verifiedKeyObj.status === 'UNUSED' ? (
                        <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
                          <CheckCircle2 className="w-4 h-4" /> Valid Activation Key
                        </span>
                      ) : (
                        <span className="text-red-400 flex items-center gap-1.5 font-medium">
                          <AlertTriangle className="w-4 h-4" /> Key is {verifiedKeyObj.status}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Full Name or Business Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newBusinessName}
                    onChange={(e) => setNewBusinessName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Your name or business name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Email or Phone Number
                  </label>
                  <input
                    type="text"
                    required
                    value={newPhoneOrEmail}
                    onChange={(e) => setNewPhoneOrEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Email or phone number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Create a password"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  Activate Account
                </button>
              </form>
            )}
          </main>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // AUTHENTICATED WORKSPACE (DESKTOP SIDEBAR + MOBILE BOTTOM NAV)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0B111E] text-slate-100 flex flex-col lg:flex-row">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-[#11192B] border-r border-slate-800/80 shrink-0 justify-between p-4 no-print">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-base shadow">
              NAS
            </div>
            <div className="overflow-hidden">
              <div className="font-bold text-sm text-white truncate">
                {currentUser.businessName}
              </div>
              <div className="text-xs text-emerald-400 font-medium">
                Currency: TZS • {currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Licensed Lender'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsNewLoanOpen(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm flex items-center justify-between shadow-lg transition cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4 stroke-[2.5]" />
              New TZS Loan
            </span>
            <kbd className="text-[11px] bg-slate-950/20 px-1.5 py-0.5 rounded font-mono">N</kbd>
          </button>

          <nav className="space-y-1">
            {[
              { id: 'DASHBOARD' as NavTab, label: 'Executive Dashboard', icon: LayoutDashboard, key: 'D' },
              { id: 'LOANS' as NavTab, label: 'Financial Assistance', icon: FileText, key: 'L' },
              { id: 'BORROWERS' as NavTab, label: 'Clients & Referrals', icon: Users, key: 'B' },
              { id: 'CALCULATOR' as NavTab, label: 'TZS Profit Calculator', icon: Calculator, key: 'C' },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                    {item.key}
                  </kbd>
                </button>
              );
            })}

            {currentUser.role === 'SUPER_ADMIN' && (
              <div className="pt-4 mt-4 border-t border-slate-800/80">
                <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Multi-User Licensing
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('ADMIN_KEYS')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                    activeTab === 'ADMIN_KEYS'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <KeyRound className="w-4 h-4 text-amber-400" />
                    Activation Keys
                  </span>
                  <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 font-mono">
                    K
                  </kbd>
                </button>
              </div>
            )}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setIsInstallModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-xs text-emerald-300 border border-emerald-500/30 cursor-pointer"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              📲 Install App (PC/Phone)
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsSecurityModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs text-slate-200 border border-slate-800 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              Password &amp; Clear Demo Data
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCloudModalOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-xs text-slate-300 border border-slate-800 cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              PC &amp; Phone Cloud Sync
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentUserId(null);
              setActiveSessionUserId(null);
              setSignInIdentifier('');
              setSignInPassword('');
              setActivationKeyInput('');
              setNewPassword('');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out / Switch User
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Top Command & Search Bar */}
        <header className="sticky top-0 z-30 bg-[#0B111E]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, referral name, phone, or loan # (Ctrl+K)..."
              className="w-full pl-10 pr-12 py-2 rounded-xl bg-[#131C2E] border border-slate-700/80 text-sm text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            ) : (
              <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                Ctrl+K
              </kbd>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role === 'SUPER_ADMIN' && (
              <select
                value={adminScopeUserId}
                onChange={(e) => {
                  setAdminScopeUserId(e.target.value);
                  setSelectedLoanId(null);
                }}
                title="Super Admin: Inspect any user's ledger or all users combined"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#131C2E] text-emerald-300 border border-emerald-500/40 focus:outline-none cursor-pointer"
              >
                <option value="SELF">Ledger: My Admin Account</option>
                <option value="ALL">Ledger: All Users Combined ({appState.users.length})</option>
                {appState.users
                  .filter((u) => u.id !== currentUser.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      Inspect: {u.businessName} ({u.emailOrPhone})
                    </option>
                  ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => {
                exportPortfolioToCSV(enrichedLoans);
                showToast('Exported TZS Portfolio & Referrals to Excel CSV!');
              }}
              title="Export TZS Loans & Referrals to Excel (CSV)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#131C2E] hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setIsInstallModalOpen(true)}
              title="Install App on Phone or PC"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#131C2E] hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">Install App</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSecurityModalOpen(true)}
              title="Account Password & Clear Sample Data"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#131C2E] hover:bg-slate-800 text-amber-300 border border-amber-500/30 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCloudModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden xl:inline">Synced (TZS)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewLoanOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer shadow"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Offer Assistance</span>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1 & 2: EXECUTIVE DASHBOARD / LOANS */}
          {(activeTab === 'DASHBOARD' || activeTab === 'LOANS') && (
            <>
              {/* 4 High-Impact TZS KPI Summary Cards */}
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-[#131C2E] border border-slate-800 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <span>Principal Offered (Active)</span>
                    <Wallet className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-white">
                    {formatTZS(dashboardKpis.activePrincipalOffered)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 flex items-center justify-between">
                    <span>{dashboardKpis.activeLoansCount} Active TZS Loans</span>
                    <span>All-time: {formatTZS(dashboardKpis.totalPrincipalAllTime, false)}</span>
                  </div>
                </div>

                <div className="bg-[#131C2E] border border-emerald-500/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    <span>Expected Profit (Interest)</span>
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-emerald-400">
                    +{formatTZS(dashboardKpis.expectedProfitActive)}
                  </div>
                  <div className="mt-1 text-xs text-slate-300 flex items-center justify-between">
                    <span>Avg Rate: {dashboardKpis.avgInterestRate}% / cycle</span>
                    <span className="text-emerald-300">
                      Realized: +{formatTZS(dashboardKpis.realizedProfitTotal, false)}
                    </span>
                  </div>
                </div>

                <div className="bg-[#131C2E] border border-amber-500/30 rounded-2xl p-5">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-amber-300">
                    <span>Total Expected Return</span>
                    <ArrowUpRight className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-amber-300">
                    {formatTZS(dashboardKpis.totalExpectedCollectionActive)}
                  </div>
                  <div className="mt-1 text-xs text-slate-300 flex items-center justify-between">
                    <span>Remaining: {formatTZS(dashboardKpis.totalRemainingToCollect, false)}</span>
                    <span>Collected: {formatTZS(dashboardKpis.totalCollectedCash, false)}</span>
                  </div>
                </div>

                <div
                  onClick={() =>
                    setLoanFilter((prev) => (prev === 'OVERDUE' ? 'ALL' : 'OVERDUE'))
                  }
                  className="bg-[#131C2E] border border-red-500/40 hover:border-red-400 rounded-2xl p-5 cursor-pointer transition"
                >
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-red-400">
                    <span>Overdue ("Or Else") Alert</span>
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-red-400">
                    {formatTZS(dashboardKpis.overdueBalanceTotal)}
                  </div>
                  <div className="mt-1 text-xs text-red-300 flex items-center justify-between">
                    <span>{dashboardKpis.overdueLoansCount} Overdue Loans</span>
                    <span className="underline">Press 'O' to filter</span>
                  </div>
                </div>
              </section>

              {/* Filter Chips & Shortcut Bar */}
              <section className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'ALL', label: `All Loans (${enrichedLoans.length})` },
                    { id: 'OVERDUE', label: `🔴 Overdue (${dashboardKpis.overdueLoansCount})` },
                    { id: 'DUE_SOON', label: `🟡 Due Soon (${dashboardKpis.dueSoonLoansCount})` },
                    { id: 'ACTIVE', label: '🟢 On-Track' },
                    { id: 'PAID', label: '✓ Settled / Paid' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLoanFilter(tab.id as typeof loanFilter)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        loanFilter === tab.id
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-[#131C2E] text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="hidden md:flex items-center gap-3 text-xs text-slate-400">
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">J</kbd>/
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">K</kbd> Navigate
                  </span>
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">Enter</kbd> Open
                  </span>
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">W</kbd> WhatsApp Client
                  </span>
                  <span>
                    <kbd className="px-1.5 py-0.5 bg-slate-800 rounded font-mono">R</kbd> Contact Referral
                  </span>
                </div>
              </section>

              {/* Loans Table (Desktop) & Cards (Mobile) */}
              <section className="bg-[#131C2E] border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-[#0F172A]">
                        <th className="py-3.5 px-4">Client &amp; Mandatory Referral</th>
                        <th className="py-3.5 px-4">Principal Offered</th>
                        <th className="py-3.5 px-4">Rate &amp; Term</th>
                        <th className="py-3.5 px-4">Expected Return</th>
                        <th className="py-3.5 px-4">Remaining Balance</th>
                        <th className="py-3.5 px-4">Status / Countdown</th>
                        <th className="py-3.5 px-4 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 text-sm">
                      {filteredLoans.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            No financial assistance records match this filter. Click{' '}
                            <button
                              type="button"
                              onClick={() => setIsNewLoanOpen(true)}
                              className="text-emerald-400 underline font-semibold"
                            >
                              + Offer Assistance (N)
                            </button>{' '}
                            to create one.
                          </td>
                        </tr>
                      ) : (
                        filteredLoans.map(({ loan, borrower, metrics }, idx) => {
                          const isFocused = idx === focusedRowIndex;
                          return (
                            <tr
                              key={loan.id}
                              onClick={() => {
                                setFocusedRowIndex(idx);
                                setSelectedLoanId(loan.id);
                              }}
                              className={`transition cursor-pointer ${
                                isFocused
                                  ? 'bg-emerald-500/10'
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3.5 px-4">
                                <div className="font-bold text-white flex items-center gap-2">
                                  <span>{borrower?.fullName || 'Unknown Client'}</span>
                                  <span className="text-xs font-mono text-slate-400">
                                    ({loan.loanNumber})
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400">
                                  Client: {borrower?.phoneNumber}
                                </div>
                                <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                                  <UserCheck className="w-3 h-3" />
                                  <span>
                                    Ref: <strong>{borrower?.referralName}</strong> ({borrower?.referralRelationship} •{' '}
                                    {borrower?.referralPhone})
                                  </span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4 font-semibold text-white">
                                {formatTZS(loan.principalAmount)}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-emerald-400">
                                  {loan.interestRatePercent}% / {loan.durationDays} Days
                                </div>
                                <div className="text-xs text-slate-400">
                                  Base Profit: +{formatTZS(metrics.expectedBaseInterest, false)}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-bold text-slate-100">
                                  {formatTZS(metrics.totalExpectedReturn)}
                                </div>
                                {metrics.effectiveOverduePenalty > 0 && (
                                  <div className="text-xs text-red-400 font-medium">
                                    Includes +{formatTZS(metrics.effectiveOverduePenalty, false)} Rollover
                                  </div>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="font-extrabold text-amber-300">
                                  {formatTZS(metrics.remainingBalance)}
                                </div>
                                <div className="text-xs text-slate-400">
                                  Paid: {formatTZS(loan.amountPaid, false)}
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                {metrics.status === 'OVERDUE' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                                    🔴 OVERDUE ({metrics.daysOverdue}d Late)
                                  </span>
                                )}
                                {metrics.status === 'DUE_SOON' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    🟡 Due in {metrics.daysUntilDue}d ({loan.dueDate})
                                  </span>
                                )}
                                {metrics.status === 'ACTIVE' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                    🟢 {metrics.daysUntilDue}d left ({loan.dueDate})
                                  </span>
                                )}
                                {metrics.status === 'PAID' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                                    ✓ PAID IN FULL
                                  </span>
                                )}
                              </td>

                              <td
                                className="py-3.5 px-4 text-right space-x-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedLoanId(loan.id)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                                >
                                  Pay / View
                                </button>
                                {borrower && (
                                  <>
                                    <button
                                      type="button"
                                      title="WhatsApp Client (Shortcut: W)"
                                      onClick={() =>
                                        openWhatsAppToClient(borrower, loan, metrics.remainingBalance)
                                      }
                                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs cursor-pointer"
                                    >
                                      Client 💬
                                    </button>
                                    <button
                                      type="button"
                                      title="Contact Referral / Guarantor (Shortcut: R)"
                                      onClick={() =>
                                        openWhatsAppToReferral(borrower, loan, metrics.remainingBalance)
                                      }
                                      className="px-2 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs cursor-pointer"
                                    >
                                      Ref 📞
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {/* TAB 3: CLIENTS & MANDATORY REFERRALS DIRECTORY */}
          {activeTab === 'BORROWERS' && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    Clients &amp; Mandatory Referrals Directory ({userBorrowers.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Every client is bound to a verified Referral / Guarantor with full phone &amp; location traceability.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewLoanOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  + Add Client &amp; Issue Loan
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userBorrowers.map((b) => {
                  const bLoans = enrichedLoans.filter((l) => l.loan.borrowerId === b.id);
                  const totalBorrowed = bLoans.reduce((acc, x) => acc + x.loan.principalAmount, 0);
                  const totalProfit = bLoans.reduce((acc, x) => acc + x.metrics.realizedProfit, 0);
                  return (
                    <div
                      key={b.id}
                      className="bg-[#131C2E] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-base text-white">{b.fullName}</h3>
                          <p className="text-xs text-slate-400">
                            Phone: {b.phoneNumber} • ID: {b.nationalId}
                          </p>
                          {b.collateralNotes && (
                            <p className="text-xs text-slate-300 mt-1">
                              Collateral: {b.collateralNotes}
                            </p>
                          )}
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Trust: {b.trustScore}%
                        </span>
                      </div>

                      {/* Mandatory Referral Box */}
                      <div className="p-3.5 rounded-xl bg-[#0B111E] border border-amber-500/30 space-y-1">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                          <span>Mandatory Referral / Guarantor</span>
                          <span>{b.referralRelationship}</span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {b.referralName} ({b.referralPhone})
                        </div>
                        {b.referralLocationOrId && (
                          <div className="text-xs text-slate-400">
                            Location / ID: {b.referralLocationOrId}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                        <div>
                          <span className="text-slate-400">Total Offered: </span>
                          <strong className="text-white">{formatTZS(totalBorrowed)}</strong>
                          <span className="mx-2 text-slate-600">•</span>
                          <span className="text-slate-400">Realized Profit: </span>
                          <strong className="text-emerald-400">+{formatTZS(totalProfit)}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingBorrower(b)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" /> Edit / Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedExistingBorrowerId(b.id);
                              setIsNewLoanOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 font-semibold transition cursor-pointer"
                          >
                            + Issue New Loan
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* TAB 4: STANDALONE TZS PROFIT & OVERDUE ROLLOVER CALCULATOR */}
          {activeTab === 'CALCULATOR' && (
            <section className="max-w-3xl mx-auto bg-[#131C2E] border border-slate-800 rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-emerald-400" />
                  Standalone TZS Financial Assistance &amp; "Or Else" Rollover Simulator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Simulate any TZS principal, interest percentage, duration, and overdue penalty rule before offering assistance.
                </p>
              </div>

              {(() => {
                const P = Math.max(0, Number(calcPrincipal.replace(/,/g, '')) || 0);
                const r = Math.max(0, Number(calcRate) || 0);
                const D = Math.max(1, Number(calcDays) || 30);
                const baseProfit = Math.round(P * (r / 100));
                const initialTotal = P + baseProfit;
                const cycle2Total =
                  calcRule === 'SIMPLE_ROLLOVER'
                    ? initialTotal + baseProfit
                    : calcRule === 'COMPOUND_ROLLOVER'
                    ? Math.round(initialTotal * (1 + r / 100))
                    : initialTotal + Math.round(P * 0.01 * D);

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                          Principal Offered (TZS)
                        </label>
                        <input
                          type="number"
                          value={calcPrincipal}
                          onChange={(e) => setCalcPrincipal(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white font-bold"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                            Interest Rate (%)
                          </label>
                          <input
                            type="number"
                            value={calcRate}
                            onChange={(e) => setCalcRate(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-emerald-400 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                            Duration (Days)
                          </label>
                          <input
                            type="number"
                            value={calcDays}
                            onChange={(e) => setCalcDays(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white font-bold"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                          Overdue "Or Else" Rule
                        </label>
                        <select
                          value={calcRule}
                          onChange={(e) => setCalcRule(e.target.value as OverdueRule)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-white text-sm"
                        >
                          <option value="SIMPLE_ROLLOVER">Simple Cycle Rollover (+Base Interest)</option>
                          <option value="COMPOUND_ROLLOVER">Compound Balance Rollover</option>
                          <option value="DAILY_PENALTY">Daily Late Percentage (1%/day)</option>
                        </select>
                      </div>
                    </div>

                    <div className="bg-[#0B111E] border-2 border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                      <div>
                        <div className="text-xs font-bold uppercase text-emerald-400">
                          Simulated TZS Return Breakdown
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Principal Offered:</span>
                            <span className="font-bold text-white">{formatTZS(P)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Expected Profit ({r}%):</span>
                            <span className="font-bold text-emerald-400">+{formatTZS(baseProfit)}</span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-slate-800 text-base">
                            <span className="font-bold text-white">Due on Day {D}:</span>
                            <span className="font-extrabold text-amber-300">
                              {formatTZS(initialTotal)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-slate-800 text-xs text-red-300">
                            <span>If Unpaid (Day {D + 1}+ Rollover):</span>
                            <span className="font-bold">{formatTZS(cycle2Total)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPrincipalInput(String(P));
                          setInterestRateInput(String(r));
                          setDurationDaysInput(String(D));
                          setOverdueRuleInput(calcRule);
                          setIsNewLoanOpen(true);
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Use These Terms in New Loan →
                      </button>
                    </div>
                  </div>
                );
              })()}
            </section>
          )}

          {/* TAB 5: SUPER ADMIN ACTIVATION KEY GENERATOR & USER LICENSING */}
          {activeTab === 'ADMIN_KEYS' && currentUser.role === 'SUPER_ADMIN' && (
            <section className="space-y-6">
              <div className="bg-[#131C2E] border border-amber-500/30 rounded-2xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-amber-400" />
                      Super Admin: Generate One-Time Activation Key
                    </h2>
                    <p className="text-xs text-slate-400">
                      Each generated key allows a new user to create an account once and immediately expires (`USED`) after registration.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      Issued For / Client Note
                    </label>
                    <input
                      type="text"
                      value={newKeyNotes}
                      onChange={(e) => setNewKeyNotes(e.target.value)}
                      placeholder="e.g. Mwanza Branch Partner - David M."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                      License Validity After Activation
                    </label>
                    <select
                      value={newKeyValidityDays}
                      onChange={(e) => setNewKeyValidityDays(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B111E] border border-slate-700 text-sm text-white"
                    >
                      <option value="LIFETIME">Lifetime Access</option>
                      <option value="30">30 Days Subscription</option>
                      <option value="90">90 Days Subscription</option>
                      <option value="365">1 Year (365 Days)</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateKey}
                    className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm cursor-pointer shadow"
                  >
                    ⚡ Generate One-Time Key
                  </button>
                </div>
              </div>

              <div className="bg-[#131C2E] border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">
                    Generated Activation Keys ({appState.activationKeys.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-[#0F172A]">
                        <th className="py-3 px-4">Activation Key Code</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Plan &amp; Note</th>
                        <th className="py-3 px-4">Claimed By / Used At</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {appState.activationKeys.map((k) => (
                        <tr key={k.id} className="hover:bg-slate-800/30">
                          <td className="py-3.5 px-4 font-mono font-bold text-emerald-300">
                            {k.keyCode}
                          </td>
                          <td className="py-3.5 px-4">
                            {k.status === 'UNUSED' ? (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                🟢 UNUSED (Ready)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300">
                                ⚫ {k.status} (Expired)
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300">
                            <div>{k.notes}</div>
                            <div className="text-slate-500">
                              Validity: {k.validityDays ? `${k.validityDays} Days` : 'Lifetime'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300">
                            {k.usedByName ? (
                              <div>
                                <div className="font-semibold text-white">{k.usedByName}</div>
                                <div className="text-slate-400">Used at: {k.usedAt}</div>
                              </div>
                            ) : (
                              <span className="text-slate-500">Waiting for registration</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            {k.status === 'UNUSED' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(k.keyCode);
                                    showToast(`Copied ${k.keyCode} to clipboard!`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Copy className="w-3 h-3" /> Copy
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = appState.activationKeys.map((item) =>
                                      item.id === k.id ? { ...item, status: 'REVOKED' as const } : item
                                    );
                                    const next = { ...appState, activationKeys: updated };
                                    setAppState(next);
                                    saveAppState(next);
                                    showToast(`Revoked key ${k.keyCode}`);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs cursor-pointer"
                                >
                                  Revoke
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = {
                                    ...appState,
                                    activationKeys: appState.activationKeys.filter(
                                      (item) => item.id !== k.id
                                    ),
                                  };
                                  setAppState(next);
                                  saveAppState(next);
                                  showToast(`Removed key ${k.keyCode} from log`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 text-xs cursor-pointer"
                              >
                                Delete Log
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Registered Users / Licensed Lenders Table */}
              <div className="bg-[#131C2E] border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      Registered Users &amp; Licensed Accounts ({appState.users.length})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Manage all users who have activated an account on the platform.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-bold uppercase text-slate-400 bg-[#0F172A]">
                        <th className="py-3 px-4">Business / User Name</th>
                        <th className="py-3 px-4">Email / Phone</th>
                        <th className="py-3 px-4">Role &amp; Activated Key</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4 text-right">Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {appState.users.map((u) => {
                        const uLoans = appState.loans.filter((l) => l.userId === u.id);
                        const uBorrowersCount = appState.borrowers.filter((b) => b.userId === u.id).length;
                        const uPrincipalTotal = uLoans.reduce((sum, l) => sum + l.principalAmount, 0);
                        const uCollectedTotal = uLoans.reduce((sum, l) => sum + l.amountPaid, 0);
                        return (
                          <tr key={u.id} className="hover:bg-slate-800/30">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">{u.businessName}</div>
                              <div className="text-xs text-slate-400">
                                {uLoans.length} Loans • {uBorrowersCount} Clients • Principal:{' '}
                                <span className="text-emerald-300 font-semibold">
                                  {formatTZS(uPrincipalTotal)}
                                </span>{' '}
                                • Collected: {formatTZS(uCollectedTotal)}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-slate-200">
                              {u.emailOrPhone}
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              <span className="font-semibold text-emerald-400">{u.role}</span>
                              {u.activatedWithKey && (
                                <div className="font-mono text-slate-400">
                                  Key: {u.activatedWithKey}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {u.accountStatus === 'ACTIVE' ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  🟢 ACTIVE
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                                  🔴 {u.accountStatus}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminScopeUserId(u.id === currentUser.id ? 'SELF' : u.id);
                                  setActiveTab('DASHBOARD');
                                  showToast(`Viewing ledger & activity for ${u.businessName}`);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-semibold cursor-pointer"
                              >
                                View Ledger
                              </button>
                              {u.role !== 'SUPER_ADMIN' ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextStatus =
                                        u.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
                                      const next = {
                                        ...appState,
                                        users: appState.users.map((item) =>
                                          item.id === u.id
                                            ? { ...item, accountStatus: nextStatus as 'ACTIVE' | 'SUSPENDED' }
                                            : item
                                        ),
                                      };
                                      setAppState(next);
                                      saveAppState(next);
                                      showToast(
                                        `${u.businessName} is now ${nextStatus}`
                                      );
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold cursor-pointer"
                                  >
                                    {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Activate'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Delete user "${u.businessName}" (${u.emailOrPhone}) and their data?`
                                        )
                                      ) {
                                        const next = {
                                          ...appState,
                                          users: appState.users.filter((item) => item.id !== u.id),
                                          borrowers: appState.borrowers.filter(
                                            (b) => b.userId !== u.id
                                          ),
                                          loans: appState.loans.filter((l) => l.userId !== u.id),
                                          repayments: appState.repayments.filter(
                                            (r) => r.userId !== u.id
                                          ),
                                        };
                                        setAppState(next);
                                        saveAppState(next);
                                        showToast(`Deleted user ${u.businessName}`);
                                      }
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 text-xs font-semibold cursor-pointer"
                                  >
                                    Delete User
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-500">Master Admin</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#11192B] border-t border-slate-800 px-3 py-2 flex items-center justify-around no-print">
        {[
          { id: 'DASHBOARD' as NavTab, label: 'Home', icon: LayoutDashboard },
          { id: 'LOANS' as NavTab, label: 'Loans', icon: FileText },
          { id: 'BORROWERS' as NavTab, label: 'Referrals', icon: Users },
          { id: 'CALCULATOR' as NavTab, label: 'Calc', icon: Calculator },
          ...(currentUser.role === 'SUPER_ADMIN'
            ? [{ id: 'ADMIN_KEYS' as NavTab, label: 'Keys', icon: KeyRound }]
            : []),
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium ${
                active ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* SCREEN 3 MODAL: NEW FINANCIAL ASSISTANCE (TZS + MANDATORY CLIENT REFERRAL) */}
      {isNewLoanOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
          <div className="bg-[#131C2E] border border-slate-700 rounded-2xl max-w-4xl w-full p-5 md:p-7 shadow-2xl my-auto max-h-[94vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Offer New Financial Assistance (TZS) + Mandatory Referral
                </h2>
                <p className="text-xs text-slate-400">
                  Presets: <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Alt+1</kbd> 7d@10% •{' '}
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Alt+2</kbd> 14d@15% •{' '}
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Alt+3</kbd> 30d@20% •{' '}
                  <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Esc</kbd> Close
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewLoanOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateLoan} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-5">
                {/* 1. Client Details */}
                <div className="p-4 rounded-xl bg-[#0B111E] border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      1. Client (Borrower) Information
                    </span>
                    <select
                      value={selectedExistingBorrowerId}
                      onChange={(e) => setSelectedExistingBorrowerId(e.target.value)}
                      className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200"
                    >
                      <option value="NEW">+ New Client</option>
                      {userBorrowers.map((b) => (
                        <option key={b.id} value={b.id}>
                          Existing: {b.fullName} ({b.phoneNumber})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Client Full Name *</label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. John Mwangi"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Client Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="+255 712 999 888"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">NIDA / National ID</label>
                      <input
                        type="text"
                        value={clientNationalId}
                        onChange={(e) => setClientNationalId(e.target.value)}
                        placeholder="NIDA-1990..."
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Collateral / Security Note</label>
                      <input
                        type="text"
                        value={clientCollateral}
                        onChange={(e) => setClientCollateral(e.target.value)}
                        placeholder="Shop stock / Vehicle card"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Mandatory Client Referral / Guarantor Info */}
                <div className="p-4 rounded-xl bg-[#0B111E] border-2 border-amber-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      2. Mandatory Client Referral / Guarantor Information *
                    </span>
                    <span className="text-[11px] text-amber-300">Required for every client</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Referred By (Full Name) *
                      </label>
                      <input
                        type="text"
                        required
                        value={referralName}
                        onChange={(e) => setReferralName(e.target.value)}
                        placeholder="e.g. Musa Juma"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-amber-500/40 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Referral Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={referralPhone}
                        onChange={(e) => setReferralPhone(e.target.value)}
                        placeholder="+255 754 111 222"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-amber-500/40 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">
                        Relationship to Client *
                      </label>
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
                      <label className="block text-xs text-slate-300 mb-1">
                        Referral Shop / Location / NIDA
                      </label>
                      <input
                        type="text"
                        value={referralLocation}
                        onChange={(e) => setReferralLocation(e.target.value)}
                        placeholder="Kariakoo Shop #42, DSM"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-sm text-white"
                      />
                    </div>
                  </div>

                  {liveNewLoanPreview.referralRisk.overdueReferredCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-xs text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>
                        Warning: This referral ({referralName}) has{' '}
                        {liveNewLoanPreview.referralRisk.overdueReferredCount} referred client(s) currently OVERDUE (
                        {liveNewLoanPreview.referralRisk.overdueClientNames.join(', ')}).
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Principal & Interest Terms in TZS */}
                <div className="p-4 rounded-xl bg-[#0B111E] border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      3. Principal (TZS), Rate % &amp; "Or Else" Rule
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { d: '7', r: '10', label: '7d @ 10%' },
                        { d: '14', r: '15', label: '14d @ 15%' },
                        { d: '30', r: '20', label: '30d @ 20%' },
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => {
                            setDurationDaysInput(p.d);
                            setInterestRateInput(p.r);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer ${
                            durationDaysInput === p.d && interestRateInput === p.r
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Principal Offered (TZS) *
                      </label>
                      <input
                        type="number"
                        required
                        min={1000}
                        step={1000}
                        value={principalInput}
                        onChange={(e) => setPrincipalInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border-2 border-emerald-500/60 text-white font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Interest Rate (%)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={0.5}
                        value={interestRateInput}
                        onChange={(e) => setInterestRateInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-emerald-400 font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Duration (Days)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={durationDaysInput}
                        onChange={(e) => setDurationDaysInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-white font-bold text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Issue Date</label>
                      <input
                        type="date"
                        value={issueDateInput}
                        onChange={(e) => setIssueDateInput(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Overdue "Or Else" Rule (After {durationDaysInput} Days)
                      </label>
                      <select
                        value={overdueRuleInput}
                        onChange={(e) => setOverdueRuleInput(e.target.value as OverdueRule)}
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-white text-sm"
                      >
                        <option value="SIMPLE_ROLLOVER">
                          Auto-Rollover (+{interestRateInput}% of Principal every {durationDaysInput}d)
                        </option>
                        <option value="COMPOUND_ROLLOVER">
                          Compound Rollover (+{interestRateInput}% of Unpaid Balance)
                        </option>
                        <option value="DAILY_PENALTY">Daily Late Penalty (% per day)</option>
                        <option value="MANUAL_PENALTY">Manual Flag Only</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Live TZS Earnings & Return Preview */}
              <div className="lg:col-span-5 flex flex-col justify-between bg-[#0B111E] border-2 border-emerald-500/50 rounded-2xl p-5 space-y-5">
                <div className="space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Live TZS Earnings &amp; Return Preview
                  </div>

                  <div className="space-y-2.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Principal Offered:</span>
                      <span className="font-bold text-white">
                        {formatTZS(liveNewLoanPreview.P)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Expected Profit ({liveNewLoanPreview.r}%):
                      </span>
                      <span className="font-bold text-emerald-400">
                        +{formatTZS(liveNewLoanPreview.metrics.expectedBaseInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-3 border-t border-slate-800 text-base">
                      <span className="font-bold text-white">Total Expected Return:</span>
                      <span className="font-extrabold text-amber-300">
                        {formatTZS(liveNewLoanPreview.metrics.initialExpectedReturn)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Agreed Due Date ({liveNewLoanPreview.D} Days):</span>
                      <span className="text-white font-semibold">{liveNewLoanPreview.dueDate}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1">
                    <div className="text-[11px] font-bold uppercase text-red-400">
                      "Or Else" Overdue Projection (Day {liveNewLoanPreview.D + 1}+)
                    </div>
                    <div className="text-xs text-red-200">
                      If unpaid by <strong>{liveNewLoanPreview.dueDate}</strong>, total due automatically becomes{' '}
                      <strong className="text-white">
                        {formatTZS(liveNewLoanPreview.metrics.ifLateDay31Projection)}
                      </strong>
                      .
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1 text-xs">
                    <div className="font-bold uppercase text-amber-400">
                      Bound Referral / Guarantor
                    </div>
                    <div className="text-white font-semibold">
                      {referralName || 'Enter Referral Name...'} ({referralPhone})
                    </div>
                    <div className="text-slate-400">
                      Relation: {referralRelationship}{' '}
                      {referralLocation ? `• ${referralLocation}` : ''}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm transition cursor-pointer shadow-lg"
                  >
                    ✓ Confirm &amp; Issue {formatTZS(liveNewLoanPreview.P)} Loan (Enter ↵)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewLoanOpen(false)}
                    className="w-full py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel (Esc)
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCREEN 4 DRAWER: LOAN DETAIL, OVERDUE ROLLOVER, REFERRAL ESCALATION & REPAYMENT */}
      {selectedLoanBundle && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end">
          <div className="bg-[#131C2E] border-l border-slate-700 w-full max-w-2xl h-full overflow-y-auto p-5 md:p-7 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 no-print">
                <div>
                  <span className="text-xs font-mono text-emerald-400">
                    LOAN #{selectedLoanBundle.loan.loanNumber}
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    {selectedLoanBundle.borrower?.fullName}
                  </h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLoan(selectedLoanBundle.loan)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit / Delete Loan
                  </button>
                  {selectedLoanBundle.borrower && (
                    <button
                      type="button"
                      onClick={() => setEditingBorrower(selectedLoanBundle.borrower!)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Client/Referral
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print / PDF Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLoanId(null)}
                    className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Overdue Alert Banner */}
              {selectedLoanBundle.metrics.status === 'OVERDUE' && (
                <div className="p-4 rounded-xl bg-red-500/15 border-2 border-red-500/50 space-y-1">
                  <div className="text-xs font-extrabold uppercase text-red-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    OVERDUE ALERT: {selectedLoanBundle.metrics.daysOverdue} DAYS PAST DEADLINE (CYCLE{' '}
                    {selectedLoanBundle.metrics.rolloverCyclesCount + 1})
                  </div>
                  <p className="text-xs text-red-200">
                    Original Due Date was <strong>{selectedLoanBundle.loan.dueDate}</strong>. Overdue Rule (
                    {selectedLoanBundle.loan.overdueRule}) added{' '}
                    <strong>+{formatTZS(selectedLoanBundle.metrics.effectiveOverduePenalty)}</strong>.
                  </p>
                </div>
              )}

              {/* Client & Mandatory Referral Contact Card */}
              {selectedLoanBundle.borrower && (
                <div className="p-4 rounded-xl bg-[#0B111E] border border-amber-500/40 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-sky-400">
                        Client (Borrower)
                      </div>
                      <div className="text-sm font-bold text-white">
                        {selectedLoanBundle.borrower.fullName} •{' '}
                        {selectedLoanBundle.borrower.phoneNumber}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsAppToClient(
                          selectedLoanBundle.borrower!,
                          selectedLoanBundle.loan,
                          selectedLoanBundle.metrics.remainingBalance
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer no-print"
                    >
                      💬 WhatsApp Client (W)
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-bold uppercase text-amber-400">
                        Mandatory Referral / Guarantor ({selectedLoanBundle.borrower.referralRelationship})
                      </div>
                      <div className="text-sm font-bold text-white">
                        {selectedLoanBundle.borrower.referralName} •{' '}
                        {selectedLoanBundle.borrower.referralPhone}
                      </div>
                      {selectedLoanBundle.borrower.referralLocationOrId && (
                        <div className="text-xs text-slate-400">
                          Location/ID: {selectedLoanBundle.borrower.referralLocationOrId}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsAppToReferral(
                          selectedLoanBundle.borrower!,
                          selectedLoanBundle.loan,
                          selectedLoanBundle.metrics.remainingBalance
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer no-print"
                    >
                      📞 Notify Referral / Guarantor (R)
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Financial Breakdown Cards in TZS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[#0B111E] border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Principal</div>
                  <div className="text-base font-extrabold text-white mt-1">
                    {formatTZS(selectedLoanBundle.loan.principalAmount)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B111E] border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-emerald-400">
                    Base Interest ({selectedLoanBundle.loan.interestRatePercent}%)
                  </div>
                  <div className="text-base font-extrabold text-emerald-400 mt-1">
                    +{formatTZS(selectedLoanBundle.metrics.expectedBaseInterest)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B111E] border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-red-400">
                    Overdue Rollover
                  </div>
                  <div className="text-base font-extrabold text-red-400 mt-1">
                    +{formatTZS(selectedLoanBundle.metrics.effectiveOverduePenalty)}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#0B111E] border-2 border-amber-500/40">
                  <div className="text-[10px] font-bold uppercase text-amber-300">
                    Remaining Balance
                  </div>
                  <div className="text-base font-extrabold text-amber-300 mt-1">
                    {formatTZS(selectedLoanBundle.metrics.remainingBalance)}
                  </div>
                </div>
              </div>

              {/* Record Repayment Form */}
              {selectedLoanBundle.metrics.remainingBalance > 0 && (
                <form
                  onSubmit={handleRecordRepayment}
                  className="p-4 rounded-xl bg-[#0B111E] border border-slate-800 space-y-3 no-print"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase text-white">
                      Record TZS Repayment
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setRepaymentAmountInput(
                            String(selectedLoanBundle.metrics.remainingBalance)
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer"
                      >
                        [F] Full ({formatTZS(selectedLoanBundle.metrics.remainingBalance)})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRepaymentAmountInput(
                            String(Math.round(selectedLoanBundle.metrics.remainingBalance / 2))
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                      >
                        50% ({formatTZS(Math.round(selectedLoanBundle.metrics.remainingBalance / 2))})
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Amount Received (TZS) *
                      </label>
                      <input
                        type="number"
                        required
                        min={100}
                        value={repaymentAmountInput}
                        onChange={(e) => setRepaymentAmountInput(e.target.value)}
                        placeholder="e.g. 500000"
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-emerald-500/60 text-white font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Payment Method</label>
                      <select
                        value={repaymentMethodInput}
                        onChange={(e) =>
                          setRepaymentMethodInput(e.target.value as PaymentMethod)
                        }
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-white text-sm"
                      >
                        <option value="M_PESA">M-Pesa</option>
                        <option value="TIGO_PESA">Tigo Pesa (Mixx by Yas)</option>
                        <option value="AIRTEL_MONEY">Airtel Money</option>
                        <option value="HALOPESA">HaloPesa</option>
                        <option value="BANK_TRANSFER">Bank Transfer (CRDB/NMB)</option>
                        <option value="CASH">Cash (TZS)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Receipt / Reference ID
                      </label>
                      <input
                        type="text"
                        value={repaymentRefInput}
                        onChange={(e) => setRepaymentRefInput(e.target.value)}
                        placeholder="e.g. QK892M..."
                        className="w-full px-3 py-2 rounded-lg bg-[#131C2E] border border-slate-700 text-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer"
                    >
                      ✓ Record TZS Payment (Enter ↵)
                    </button>
                    {selectedLoanBundle.metrics.effectiveOverduePenalty > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleWaiveOverduePenalty(
                            selectedLoanBundle.loan.id,
                            selectedLoanBundle.metrics.effectiveOverduePenalty
                          )
                        }
                        className="px-3 py-2.5 rounded-xl bg-red-500/15 text-red-300 border border-red-500/30 text-xs font-semibold cursor-pointer"
                      >
                        Waive Overdue Fee
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExtendDueDate(selectedLoanBundle.loan.id, 7)}
                      className="px-3 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                    >
                      +7d Grace
                    </button>
                  </div>
                </form>
              )}

              {/* Audit & Lifecycle Log */}
              <div className="p-4 rounded-xl bg-[#0B111E] border border-slate-800 space-y-3">
                <div className="text-xs font-bold uppercase text-slate-400">
                  Audit &amp; Transaction Timeline
                </div>
                <div className="space-y-2.5 text-xs">
                  {selectedLoanBundle.loan.auditLog.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-start justify-between gap-3 border-b border-slate-800/60 pb-2"
                    >
                      <div>
                        <span className="font-mono text-slate-400">{ev.timestamp}</span>
                        <div className="text-slate-200 font-medium mt-0.5">{ev.description}</div>
                      </div>
                      {ev.amountTzs && (
                        <span className="font-bold text-emerald-400 shrink-0">
                          {formatTZS(ev.amountTzs)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLOUD SYNC STATUS MODAL (PC & PHONE OUTSIDE LOCAL NETWORK) */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#131C2E] border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Cloud className="w-5 h-5 text-emerald-400" />
                PC &amp; Phone Cloud Sync Status
              </h3>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#0B111E] border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  Cloud Realtime Sync Active (TLS 1.3)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Last Synced: {appState.lastSyncedAt.slice(0, 19).replace('T', ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your PC and Mobile Phone are connected via encrypted cloud synchronization with per-tenant vault partitioning and local encrypted offline fallback.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={async () => {
                  const pulled = await pullStateFromSupabaseCloud();
                  if (pulled) {
                    setAppState(pulled);
                    showToast('Pulled latest TZS portfolio from Cloud!');
                  } else {
                    await pushStateToSupabaseCloud(appState);
                    showToast('Pushed local TZS portfolio to Cloud!');
                  }
                  setIsCloudModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Force Cloud Sync Now
              </button>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2 MODALS: EDIT CLIENT/REFERRAL, EDIT LOAN, ACCOUNT SECURITY, PWA INSTALL */}
      {editingBorrower && (
        <EditBorrowerModal
          borrower={editingBorrower}
          onClose={() => setEditingBorrower(null)}
          onSave={handleSaveEditedBorrower}
          onDelete={handleDeleteBorrower}
        />
      )}

      {editingLoan && (
        <EditLoanModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSave={handleSaveEditedLoan}
          onDelete={handleDeleteLoan}
        />
      )}

      {isSecurityModalOpen && currentUser && (
        <AccountSecurityModal
          user={currentUser}
          onClose={() => setIsSecurityModalOpen(false)}
          onUpdateProfile={handleUpdateUserProfile}
          onClearDemoPortfolio={handleClearDemoPortfolio}
        />
      )}

      {isInstallModalOpen && (
        <InstallPwaModal
          onClose={() => setIsInstallModalOpen(false)}
          canTriggerNativeInstall={Boolean(deferredInstallPrompt)}
          onTriggerNativeInstall={async () => {
            if (!deferredInstallPrompt) return;
            deferredInstallPrompt.prompt();
            await deferredInstallPrompt.userChoice;
            setDeferredInstallPrompt(null);
            setIsInstallModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
