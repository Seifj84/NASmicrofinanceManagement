# NAS Microfinance Management System — Simple User & Admin Guide

**Primary Currency:** Tanzanian Shillings (`TZS`)  
**Live App URL:** `https://na-smicrofinance-management.vercel.app/`

---

## 1. Getting Started (Sign In or Activate an Account)

### A. Existing Users (Sign In & Password Recovery)
1. Open the app on your **PC** or **Phone**.
2. Enter your **Email or Phone Number** and **Password**.
3. Click **Sign In**.
4. **Forgot Your Password?** Click **"Forgot Password?"** under the password box. The app opens a security recovery helper that pre-composes an official Swahili request message with your phone/email to send to the NAS Super Administrator via **WhatsApp** or **Email** for fast verification and credential reset.

### B. New Users (Sign Up with a One-Time Activation Key)
1. Click **Sign Up** on the login screen.
2. Enter the **One-Time Activation Key** given to you by the Super Admin (e.g., `NAS-2026-XXXX-XXXX`), your **Business Name**, **Phone/Email**, and a **Password**.
3. Click **Activate Account**.
4. **How the Key Works:** Each key works **only once**. The moment you activate your account, the key automatically changes to **`USED`** so nobody else can reuse it, and you get your own private `TZS` lending ledger.

---

## 2. Issuing Financial Assistance (Creating a `TZS` Loan)

Click **New TZS Loan** (or **Offer Assistance** / press **`N`** on your keyboard):

1. **Client Details:**
   - Enter the borrower's **Full Name**, **Phone Number (`+255...`)**, **NIDA / ID Number**, and any **Collateral Notes**.
   - *(Tip: If they are a returning client, just select them from the dropdown at the top and their info fills in automatically!)*
2. **Mandatory Referral / Guarantor (Who Brought Them):**
   - Every borrower **must** have a Referral / Guarantor recorded: **Referral Name**, **Referral Phone (`+255...`)**, **Relationship**, and **Location / Office**.
   - **Smart Risk Alert:** If that guarantor previously referred someone else who is currently **Overdue**, the app automatically shows a **Red Warning Banner** before you lend.
3. **Money & Terms (in `TZS`):**
   - **Principal Offered (`TZS`):** The exact amount you are giving (e.g., `TZS 1,000,000`).
   - **Interest Rate (`%`) & Duration (`Days`):** For example, `20%` for `30 Days` (or click a 1-click preset: `7d @ 10%`, `14d @ 15%`, `30d @ 20%`).
   - **Live Preview:** The app immediately calculates the **Expected Profit (`+TZS 200,000`)**, **Total Return (`TZS 1,200,000`)**, and exact **Due Date**.
4. **The "Or Else" Rule (What Happens If They Pass the Deadline):**
   - **Simple Rollover:** Automatically adds another cycle of interest (`+20%` of Principal) when the deadline passes.
   - **Compound Rollover:** Adds interest on top of the unpaid balance + interest.
   - **Daily Penalty:** Adds a daily percentage (`%`) for every day they are late.
   - **Manual Penalty:** Lets you enter a custom `TZS` penalty fee when they are late.

---

## 3. Tracking Loans & Recording Repayments

All loans are automatically color-coded on your **Executive Dashboard** and **Financial Assistance** tabs:
- 🟢 **On-Track (`ACTIVE`):** Within the normal loan period.
- 🟡 **Due Soon (`DUE_SOON`):** Due within **3 days** — send a reminder now.
- 🔴 **Overdue (`OVERDUE`):** Past the deadline — the **"Or Else"** rollover or penalty is automatically applied.
- ⚪ **Settled (`PAID`):** Paid in full (`TZS 0` remaining).

### Recording a Partial or Full Payment
1. Click on any loan row to open the **Loan Detail Drawer** on the right.
2. Enter the **Amount Paid (`TZS`)**, select the **Payment Method** (`M-Pesa`, `Tigo Pesa`, `Airtel Money`, `HaloPesa`, `Bank Transfer`, or `Cash`), and add an optional receipt/reference number.
3. Click **Record Payment**. The remaining balance updates immediately and logs the payment in the audit history.

---

## 4. Handling Late / Overdue Clients (WhatsApp & Referral Escalation)

When a client is **Due Soon** or **Overdue**, open their loan and use the 1-click escalation tools:
- **WhatsApp Client (`W`):** Opens WhatsApp with a pre-written Swahili message showing their loan number, due date, and exact `TZS` balance remaining.
- **Contact Referral (`R`):** If the borrower is not responding, click **Contact Referral** to immediately call or WhatsApp the **Guarantor / Referral** who vouched for them.
- **Overdue "Or Else" Actions:** Apply a manual `TZS` penalty, trigger a cycle rollover, or edit/settle the loan.

---

## 5. Super Admin Powers: Seeing Other Users' Activities & Ledgers

Regular users (`STANDARD_LENDER`) are strictly isolated—they can **only** see their own clients, loans, and repayments.

As **Super Admin (`admin@nas.co.tz`)**, you have **full visibility and control** over all users on the platform:
1. **Top Header Ledger Switcher:**
   - At the top right of the screen, use the **`Ledger`** dropdown to switch between:
     - **`Ledger: My Admin Account`** (only your own HQ loans and clients)
     - **`Ledger: All Users Combined`** (every loan, client, and repayment across all users in one view)
     - **`Inspect: [Business Name]`** (e.g., `Inspect: Gunje Enterprises` — views that specific user's exact Dashboard, Loans, Clients, and Repayments).
2. **Admin Keys $\rightarrow$ Registered Users & Licensed Accounts Table:**
   - Shows every registered user on the platform, which Activation Key they claimed, how many **Loans** and **Clients** they have, their **Total Principal Offered (`TZS`)**, and **Total Collected (`TZS`)**.
   - Click **`View Ledger`** on any user row to immediately inspect their live portfolio.
   - Click **`Reset Password` (🔑)** to open the 1-Click Password Recovery Drawer:
     - Generate a new secure temporary password (e.g. `Nas#2026!7x9K`) or type a custom one.
     - Saves the salted SHA-256 hash immediately.
     - 1-Click **Copy Swahili WhatsApp message** or click **Send via WhatsApp** to dispatch credentials directly to the lender's phone.
   - Click **`Suspend` / `Activate`** to lock or unlock a user's login access, or **`Delete User`** to remove an account.

---

## 6. Extra Tools (Calculator, Excel Export & PC/Phone Sync)

- **TZS Profit Calculator:** Test out "what-if" numbers (different loan amounts, rates, or late days) before issuing a real loan.
- **Export CSV (Excel):** Download the current loan ledger and referral list to an Excel-compatible `.csv` file with one click.
- **Real-Time PC & Phone Sync:** Powered by Supabase Cloud—any loan, payment, or user key created on your PC immediately syncs to your phone (and vice versa).

---

## 7. System Activity & Security Audit Logs (Categorized & Error Tracking)

Access the live audit trail by clicking **Activity & Audit Logs** in the sidebar (or press **`A`**):

### The 5 Log Categories:
1. 🔐 **Auth & Security:** Real-time logging of logins, logouts, 15-minute idle lockouts, account activations, and blocked login attempts.
2. 💰 **Transactions & Ledger:** Creation of new loans (`TZS`), repayments recorded (`M-Pesa`, `Tigo Pesa`, `Cash`, etc.), overdue rollover cycles, and penalty waivers.
3. 👥 **Clients & Referrals:** Client additions, profile edits, guarantor changes, and 1-click Swahili WhatsApp reminder escalations.
4. ⚠️ **Technical & System Errors:** Automatic black-box recording of runtime JavaScript glitches, network drops/restorations, and cloud sync errors with full diagnostic stack traces.
5. ⚡ **Admin Actions:** Activation keys generated, user accounts created/suspended/deleted, and portfolio resets.

### Key Audit Features:
- **Category Filter Tabs:** Click **All Logs**, or filter directly into **Auth & Security**, **Transactions**, **Technical & Errors**, etc.
- **Inspect Metadata & Error Stacks:** Click **Inspect** on any log entry to view diagnostic metadata, error stacks, or transaction parameters.
- **Super Admin User Filter:** Super Admin can view logs for all accounts combined or isolate a single user's activity; regular users only see their own logs.
- **Export to CSV:** Download audit records to an Excel-compatible CSV file for compliance and bookkeeping.
- **Crash Prevention (Error Boundary):** If any unexpected browser glitch happens, a friendly recovery card appears with a 1-click **Reload & Recover Workspace** button, preventing black screens permanently.
