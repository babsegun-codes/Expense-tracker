import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, BarChart3, BriefcaseBusiness, CalendarDays, Check, ChevronDown, CircleHelp,
  GraduationCap, LayoutDashboard, Landmark, LogOut, Menu, Plus, ReceiptText, RefreshCw, Search,
  ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Tag, Trash2,
  Utensils, Wallet, X, Pencil, Bus, HeartPulse, Clapperboard, Shapes, Eye, EyeOff
} from 'lucide-react';
import './style.css';

const API = '/api';
const categories = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Entertainment', 'Education', 'Other'];
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const emptyForm = () => ({ title: '', amount: '', category: 'Food', date: today(), description: '' });

async function apiRequest(path, token, options = {}) {
  let response;
  try {
    response = await fetch(API + path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error('We could not reach the service. Check your connection and try again.');
  }
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function displayError(error, action = 'complete this action') {
  if (error.status === 400) return 'Please check the information and try again.';
  if (error.status === 401) return 'Your session has expired. Please sign in again.';
  if (error.status === 403) return 'This action is not available for this account.';
  if (error.status === 404) return 'This expense could not be found. Refresh the list and try again.';
  if (error.status === 409) return 'An account with this email already exists. Try signing in instead.';
  if (error.status >= 500) return 'We could not ' + action + ' right now. Please try again.';
  return error.message || 'We could not ' + action + '. Please try again.';
}

function categoryIcon(category) {
  const icons = {
    Food: Utensils, Transport: Bus, Bills: ReceiptText, Shopping: ShoppingBag,
    Health: HeartPulse, Entertainment: Clapperboard, Education: GraduationCap, Other: Shapes
  };
  return icons[category] || Tag;
}

function localDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).format(date);
}

function monthKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dateInputValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? today() : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function displayName(email = '') {
  const localPart = email.split('@')[0] || 'there';
  const firstName = localPart.split(/[._+-]/).filter(Boolean)[0] || 'there';
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

function SetupGuide({ expensesCount, onAddExpense, onDismiss, onShow, dismissed }) {
  const expenseAdded = expensesCount > 0;
  const progress = expenseAdded ? 1 : 0;
  if (dismissed) return (
    <div className="setup-reminder">
      <span><Check size={15}/> Setup guide <strong>{progress} of 3 steps</strong></span>
      <button className="text-action" onClick={onShow}>Continue setup <span aria-hidden="true">→</span></button>
    </div>
  );

  return (
    <section className="setup-guide" aria-labelledby="setup-title">
      <div className="setup-heading">
        <div>
          <p className="eyebrow">YOUR FIRST STEPS</p>
          <h2 id="setup-title">Build a clearer picture of your money</h2>
          <p>Start with an expense. Account tracking and financial goals are on our roadmap.</p>
        </div>
        <button className="icon-control setup-dismiss" onClick={onDismiss} aria-label="Dismiss setup guide" title="Dismiss setup guide"><X size={18}/></button>
      </div>
      <div className="setup-progress" role="progressbar" aria-label="Setup progress" aria-valuemin="0" aria-valuemax="3" aria-valuenow={progress}><span style={{ width: `${progress / 3 * 100}%` }}/></div>
      <p className="setup-progress-label">{progress} of 3 steps complete</p>
      <ol className="setup-steps">
        <li className="setup-step unavailable"><span className="setup-step-icon"><Landmark size={17}/></span><span><strong>Add a financial account</strong><small>Bank, cash and savings accounts · Coming later</small></span><span className="soon-pill">COMING LATER</span></li>
        <li className={`setup-step ${expenseAdded ? 'complete' : 'current'}`}><span className="setup-step-icon">{expenseAdded ? <Check size={17}/> : <ReceiptText size={17}/>}</span><span><strong>{expenseAdded ? 'Record your first expense' : 'Add your first expense'}</strong><small>{expenseAdded ? 'Your first expense is saved to your account.' : 'See your spending summary and recent activity.'}</small></span>{!expenseAdded && <button className="button button-primary setup-action" onClick={onAddExpense}><Plus size={15}/>Add expense</button>}</li>
        <li className="setup-step unavailable"><span className="setup-step-icon"><Sparkles size={17}/></span><span><strong>Set a financial goal</strong><small>Plan for what matters to you · Coming later</small></span><span className="soon-pill">COMING LATER</span></li>
      </ol>
    </section>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('expense-tracker-token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSaving, setAuthSaving] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: 'All', month: '' });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [toast, setToast] = useState(null);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [newUserSession, setNewUserSession] = useState(false);
  const [setupManuallyOpened, setSetupManuallyOpened] = useState(false);
  const formDialog = useRef(null);
  const deleteDialog = useRef(null);
  const toastTimer = useRef(null);

  function notify(message, tone = 'success') {
    window.clearTimeout(toastTimer.current);
    setToast({ message, tone, id: Date.now() });
    if (tone !== 'error') toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    setOnboardingDismissed(user?.id ? localStorage.getItem(`expense-tracker-setup-dismissed:${user.id}`) === 'true' : false);
    setNewUserSession(user?.id ? localStorage.getItem(`expense-tracker-new-user:${user.id}`) === 'true' : false);
    setSetupManuallyOpened(false);
  }, [user?.id]);

  function dismissSetup() {
    if (user?.id) localStorage.setItem(`expense-tracker-setup-dismissed:${user.id}`, 'true');
    setOnboardingDismissed(true);
    setSetupManuallyOpened(false);
  }

  function showSetup() {
    if (user?.id) localStorage.removeItem(`expense-tracker-setup-dismissed:${user.id}`);
    setOnboardingDismissed(false);
    setSetupManuallyOpened(true);
  }

  function clearSession() {
    if (user?.id) localStorage.removeItem(`expense-tracker-new-user:${user.id}`);
    localStorage.removeItem('expense-tracker-token');
    setToken('');
    setUser(null);
    setExpenses([]);
    setAuthForm({ email: '', password: '' });
  }

  async function loadExpenses(authToken = token) {
    try {
      setLoading(true);
      setLoadError('');
      setExpenses(await apiRequest('/expenses', authToken));
      return true;
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        setAuthMode('login');
        notify('Your session expired. Please sign in again.', 'error');
      }
      setLoadError(displayError(error, 'load your expenses'));
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const result = await apiRequest('/auth/me', token);
        if (!active) return;
        setUser(result.user);
        setNewUserSession(localStorage.getItem(`expense-tracker-new-user:${result.user.id}`) === 'true');
        await loadExpenses(token);
      } catch (error) {
        if (!active) return;
        if (error.status === 401) {
          clearSession();
          setAuthMode('login');
          notify('Your session expired. Please sign in again.', 'error');
        } else {
          setLoadError('We could not restore your session. Check your connection and try again.');
        }
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    restoreSession();
    return () => { active = false; };
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setAuthSaving(true);
    try {
      const result = await apiRequest('/auth/' + authMode, '', {
        method: 'POST',
        body: JSON.stringify(authForm)
      });
      localStorage.setItem('expense-tracker-token', result.token);
      setToken(result.token);
      setUser(result.user);
      const isNewRegistration = authMode === 'register';
      if (isNewRegistration) localStorage.setItem(`expense-tracker-new-user:${result.user.id}`, 'true');
      else localStorage.removeItem(`expense-tracker-new-user:${result.user.id}`);
      setNewUserSession(isNewRegistration);
      setAuthForm({ email: '', password: '' });
      const loaded = await loadExpenses(result.token);
      if (loaded) notify(authMode === 'login' ? 'Welcome back.' : 'Your account is ready.');
    } catch (error) {
      notify(authMode === 'login' && error.status === 401
        ? 'Email or password is incorrect.'
        : displayError(error, authMode === 'login' ? 'sign in' : 'create your account'), 'error');
    } finally {
      setAuthSaving(false);
    }
  }

  function logout() {
    clearSession();
    setAuthMode('login');
    setLoadError('');
    setClaimToken('');
    setLegacyOpen(false);
    notify('You have signed out.');
  }

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function openNewExpense() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setExpenseDialogOpen(true);
  }

  function startEdit(expense) {
    setEditingId(expense._id);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category,
      date: dateInputValue(expense.date),
      description: expense.description || ''
    });
    setFormError('');
    setExpenseDialogOpen(true);
  }

  function closeExpenseDialog() {
    setExpenseDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
  }

  async function saveExpense(event) {
    event.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      const path = editingId ? '/expenses/' + editingId : '/expenses';
      const data = await apiRequest(path, token, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) })
      });
      const wasEditing = Boolean(editingId);
      if (wasEditing) setExpenses(current => current.map(item => item._id === editingId ? data : item));
      else setExpenses(current => [data, ...current]);
      closeExpenseDialog();
      notify(wasEditing ? 'Expense updated.' : 'Expense added.');
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        setAuthMode('login');
        setExpenseDialogOpen(false);
      }
      setFormError(displayError(error, editingId ? 'update this expense' : 'save this expense'));
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense() {
    if (!deletingExpense) return;
    const expense = deletingExpense;
    setDeletingExpense(null);
    try {
      await apiRequest('/expenses/' + expense._id, token, { method: 'DELETE' });
      setExpenses(current => current.filter(item => item._id !== expense._id));
      notify('Expense deleted.');
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        setAuthMode('login');
      }
      notify(displayError(error, 'delete this expense'), 'error');
    }
  }

  async function claimLegacy(event) {
    event.preventDefault();
    try {
      const result = await apiRequest('/auth/claim-legacy', token, {
        method: 'POST',
        body: JSON.stringify({ claimToken })
      });
      setClaimToken('');
      setLegacyOpen(false);
      notify(result.claimed
        ? `${result.claimed} original expense record${result.claimed === 1 ? '' : 's'} added to your account.`
        : 'No unassigned original expenses were found.');
      await loadExpenses();
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        setAuthMode('login');
      }
      notify(displayError(error, 'claim original expenses'), 'error');
    }
  }

  const filtered = useMemo(() => expenses.filter(item => {
    const search = filters.search.trim().toLowerCase();
    const matchesSearch = !search || [item.title, item.category, item.description]
      .some(value => String(value || '').toLowerCase().includes(search));
    return matchesSearch && (filters.category === 'All' || item.category === filters.category) &&
      (!filters.month || monthKey(item.date) === filters.month);
  }), [expenses, filters]);

  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const month = today().slice(0, 7);
  const monthTotal = expenses.filter(item => monthKey(item.date) === month)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const average = expenses.length ? total / expenses.length : 0;
  const filteredTotal = filtered.reduce((sum, item) => sum + Number(item.amount), 0);
  const activeFilterCount = Number(Boolean(filters.search.trim())) + Number(filters.category !== 'All') + Number(Boolean(filters.month));
  const categoryTotals = useMemo(() => {
    const totals = expenses.reduce((result, item) => {
      result[item.category] = (result[item.category] || 0) + Number(item.amount);
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const recentExpenses = [...expenses].slice(0, 5);
  const welcomeStage = expenses.length === 0 ? 'new' : expenses.length < 4 ? 'starting' : 'established';
  const setupExpanded = setupManuallyOpened || (!onboardingDismissed && (welcomeStage === 'new' || (welcomeStage === 'starting' && newUserSession)));

  function setSection(section) {
    setActiveSection(section);
    setMobileNavOpen(false);
    document.getElementById(section === 'overview' ? 'overview' : 'transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearFilters() {
    setFilters({ search: '', category: 'All', month: '' });
  }

  if (authLoading) return <AuthLoading />;

  if (!user) return (
    <AuthScreen
      authMode={authMode}
      setAuthMode={mode => { setAuthMode(mode); setAuthForm({ email: '', password: '' }); setShowPassword(false); setToast(null); }}
      authForm={authForm}
      setAuthForm={setAuthForm}
      showPassword={showPassword}
      setShowPassword={setShowPassword}
      authSaving={authSaving}
      onSubmit={submitAuth}
      toast={toast}
      dismissToast={() => setToast(null)}
    />
  );

  return (
    <div className="app-shell">
      <button className={`nav-scrim ${mobileNavOpen ? 'visible' : ''}`} aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />
      <aside id="app-navigation" className={`sidebar ${mobileNavOpen ? 'open' : ''}`} aria-label="Main navigation">
        <a className="brand" href="#overview" onClick={event => { event.preventDefault(); setSection('overview'); }}>
          <span className="brand-mark"><Wallet size={19} strokeWidth={2.2}/></span>
          <span><strong>Expense Tracker</strong><small>PERSONAL FINANCE</small></span>
        </a>

        <div className="side-section-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Sections">
          <button className={activeSection === 'overview' ? 'active' : ''} aria-current={activeSection === 'overview' ? 'page' : undefined} onClick={() => setSection('overview')}>
            <LayoutDashboard size={18}/><span>Overview</span>
          </button>
          <button className={activeSection === 'transactions' ? 'active' : ''} aria-current={activeSection === 'transactions' ? 'page' : undefined} onClick={() => setSection('transactions')}>
            <ReceiptText size={18}/><span>Transactions</span>{expenses.length > 0 && <span className="nav-count">{expenses.length}</span>}
          </button>
          <button className="disabled-nav" disabled aria-disabled="true" title="Account management is not available yet">
            <Landmark size={18}/><span>Accounts</span><span className="soon-label">SOON</span>
          </button>
        </nav>

        <div className="sidebar-note">
          <span className="note-icon"><ShieldCheck size={16}/></span>
          <strong>Your data stays yours</strong>
          <p>Your expenses are private to your account.</p>
        </div>

        <div className="profile-area">
          <div className="profile-avatar" aria-hidden="true">{(user.email || 'U').slice(0, 1).toUpperCase()}</div>
          <div className="profile-text"><strong>Your account</strong><span title={user.email}>{user.email}</span></div>
          <button className="logout-icon" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17}/></button>
        </div>
      </aside>

      <main className="main-area" id="overview">
        <div className="mobile-header">
          <button className="icon-control" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" aria-controls="app-navigation" aria-expanded={mobileNavOpen}><Menu size={21}/></button>
          <a className="brand compact" href="#overview" onClick={event => { event.preventDefault(); setSection('overview'); }}>
            <span className="brand-mark"><Wallet size={17}/></span><strong>Expense Tracker</strong>
          </a>
          <button className="icon-control" onClick={logout} aria-label="Sign out"><LogOut size={18}/></button>
        </div>

        <div className="content-wrap">
          <header className="page-header">
            <div className="header-title">
              <p className="eyebrow">YOUR MONEY, IN FOCUS</p>
              <h1>{localGreeting()}, {displayName(user.email)}</h1>
              <p>{welcomeStage === 'new' ? 'Your financial dashboard starts here.' : welcomeStage === 'starting' ? 'You’re building a clearer view of your spending.' : 'Here’s what’s happening with your expenses.'}</p>
            </div>
            <div className="header-actions">
              <span className="date-context"><CalendarDays size={16}/>{new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(new Date())}</span>
              <button className="button button-primary" onClick={openNewExpense}><Plus size={17}/>Add expense</button>
            </div>
          </header>

          {loadError && expenses.length === 0 && <div className="inline-alert" role="alert"><span>{loadError}</span><button className="button button-quiet" onClick={() => loadExpenses()}><RefreshCw size={15}/>Try again</button></div>}

          {loading ? <DashboardSkeleton/> : (
            <>
              <SetupGuide expensesCount={expenses.length} onAddExpense={openNewExpense} onDismiss={dismissSetup} onShow={showSetup} dismissed={!setupExpanded}/>
              {expenses.length > 0 && <>
              <section className="summary-grid" aria-label="Expense summary">
                <SummaryCard icon={Wallet} label="Total expenses" value={money.format(total)} hint="Across all recorded expenses" tone="navy"/>
                <SummaryCard icon={CalendarDays} label="This month" value={money.format(monthTotal)} hint="Spending recorded this month" tone="teal"/>
                <SummaryCard icon={ReceiptText} label="Transactions" value={String(expenses.length)} hint="Saved expense records" tone="blue"/>
                <SummaryCard icon={Activity} label="Average expense" value={money.format(average)} hint="Per recorded transaction" tone="amber"/>
              </section>

              <section className="insight-grid" aria-label="Spending overview">
                <div className="surface category-panel">
                  <div className="section-heading">
                    <div><p className="eyebrow">SPENDING OVERVIEW</p><h2>By category</h2></div>
                    <span className="soft-tag"><BarChart3 size={15}/>All time</span>
                  </div>
                  {categoryTotals.length === 0 ? <EmptyInline title="No category data yet" message="Your category totals will appear here."/> : (
                    <div className="category-list">
                      {categoryTotals.slice(0, 5).map(([category, amount]) => {
                        const Icon = categoryIcon(category);
                        return <div className="category-row" key={category}>
                          <span className="category-icon"><Icon size={16}/></span>
                          <div className="category-detail"><div className="category-label"><strong>{category}</strong><span>{money.format(amount)}</span></div>
                            <div className="bar-track"><span style={{ width: `${Math.max(5, amount / total * 100)}%` }}/></div>
                          </div>
                        </div>;
                      })}
                    </div>
                  )}
                </div>

                <div className="surface account-preview">
                  <div className="section-heading">
                    <div><p className="eyebrow">ACCOUNTS</p><h2>One step at a time</h2></div>
                    <span className="soon-pill">COMING LATER</span>
                  </div>
                  <div className="account-preview-body">
                    <span className="account-preview-icon"><Landmark size={21}/></span>
                    <div><strong>Account tracking isn’t available yet</strong><p>Expenses are currently tracked together, without separate bank, cash or savings accounts.</p></div>
                  </div>
                  <div className="account-preview-foot"><ShieldCheck size={15}/>Your saved expenses are still private to your account.</div>
                </div>
              </section>

              <section className="surface recent-panel" aria-labelledby="recent-title">
                <div className="section-heading">
                  <div><p className="eyebrow">LATEST ACTIVITY</p><h2 id="recent-title">Recent expenses</h2></div>
                  <button className="text-action" onClick={() => setSection('transactions')}>View all <span aria-hidden="true">→</span></button>
                </div>
                <div className="recent-list">{recentExpenses.map(expense => <ExpenseRow key={expense._id} expense={expense} onEdit={startEdit} onDelete={setDeletingExpense}/>)}</div>
              </section>

              <section className="surface transactions-panel" id="transactions" aria-labelledby="transactions-title">
                <div className="section-heading transactions-heading">
                  <div><p className="eyebrow">YOUR RECORDS</p><h2 id="transactions-title">All transactions</h2></div>
                  <div className="list-actions">
                    <span className="result-count">{filtered.length} of {expenses.length}</span>
                    <button className="button button-quiet refresh-button" onClick={() => loadExpenses()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''}/>Refresh</button>
                  </div>
                </div>
                <TransactionFilters
                  filters={filters}
                  setFilters={setFilters}
                  filteredTotal={filteredTotal}
                  activeCount={activeFilterCount}
                  mobileOpen={mobileFiltersOpen}
                  setMobileOpen={setMobileFiltersOpen}
                  onClear={clearFilters}
                />
                {loadError ? <EmptyInline icon={CircleHelp} title="Transactions could not load" message="Try refreshing to reconnect and load your records." action={<button className="button button-quiet" onClick={() => loadExpenses()}><RefreshCw size={15}/>Retry</button>}/> :
                  filtered.length === 0 ? <EmptyInline icon={Search} title="No transactions match these filters" message="Try another search, or clear your filters to see every expense." action={<button className="button button-quiet" onClick={clearFilters}>Clear filters</button>}/> :
                  <div className="transaction-list">{filtered.map(expense => <ExpenseRow key={expense._id} expense={expense} onEdit={startEdit} onDelete={setDeletingExpense}/>)}</div>}
              </section>

              </>}
            </>
          )}
          <details className={`legacy-details ${legacyOpen ? 'is-open' : ''}`} open={legacyOpen} onToggle={event => setLegacyOpen(event.currentTarget.open)}>
            <summary><span><BriefcaseBusiness size={17}/><span><strong>Bring over original expenses</strong><small>For verified owners of older shared records</small></span></span><ChevronDown size={17}/></summary>
            <div className="legacy-content">
              <p>Only continue if these unassigned records are yours and the server has enabled your verified owner account.</p>
              <form className="legacy-form" onSubmit={claimLegacy}>
                <label htmlFor="claim-token">One-time claim code</label>
                <div><input id="claim-token" type="password" autoComplete="off" value={claimToken} onChange={event => setClaimToken(event.target.value)} required/><button className="button button-secondary" type="submit">Claim original expenses</button></div>
              </form>
            </div>
          </details>
        </div>
      </main>

      <ExpenseDialog
        dialogRef={formDialog}
        open={expenseDialogOpen}
        editing={Boolean(editingId)}
        form={form}
        onChange={change}
        onSubmit={saveExpense}
        onClose={closeExpenseDialog}
        saving={saving}
        error={formError}
      />
      <ConfirmDialog
        dialogRef={deleteDialog}
        open={Boolean(deletingExpense)}
        title="Delete this expense?"
        description={deletingExpense ? `“${deletingExpense.title}” will be removed from your records.` : ''}
        onCancel={() => setDeletingExpense(null)}
        onConfirm={removeExpense}
      />
      {toast && <Toast key={toast.id} toast={toast} onDismiss={() => setToast(null)}/>}
    </div>
  );
}

function AuthLoading() {
  return <main className="auth-loading"><div className="auth-loading-card"><span className="skeleton skeleton-icon"/><span className="skeleton skeleton-line wide"/><span className="skeleton skeleton-line"/><span className="skeleton skeleton-field"/><span className="skeleton skeleton-field"/><span className="skeleton skeleton-button"/><p>Checking your secure session…</p></div></main>;
}

function AuthScreen({ authMode, setAuthMode, authForm, setAuthForm, showPassword, setShowPassword, authSaving, onSubmit, toast, dismissToast }) {
  const isRegister = authMode === 'register';
  return (
    <main className="auth-screen" id="top">
      <section className="auth-story">
        <a className="brand auth-brand" href="#top"><span className="brand-mark"><Wallet size={19}/></span><span><strong>Expense Tracker</strong><small>PERSONAL FINANCE</small></span></a>
        <div className="story-copy">
          <span className="story-kicker"><Sparkles size={15}/> A clearer view of your spending</span>
          <h1>Feel more in control of your money.</h1>
          <p>One calm place to understand what you spend and keep your personal expenses organized.</p>
          <div className="story-points"><span><Check size={16}/> Private to your account</span><span><Check size={16}/> Simple, useful spending insights</span></div>
        </div>
        <div className="story-foot"><ShieldCheck size={15}/>Secure sign-in. Your expenses are yours.</div>
        <div className="auth-art" aria-hidden="true"><div className="auth-art-shape shape-a"/><div className="auth-art-shape shape-b"/><div className="auth-art-card"><span/><span/><span/></div></div>
      </section>
      <section className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-heading"><p className="eyebrow">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</p><h2>{isRegister ? 'Create your account' : 'Sign in to Expense Tracker'}</h2><p>{isRegister ? 'Start building a clearer picture of your spending.' : 'Your personal expense overview is ready when you are.'}</p></div>
          <form className="auth-form" onSubmit={onSubmit}>
            <label htmlFor="auth-email">Email address</label>
            <input id="auth-email" type="email" autoComplete="email" required maxLength="254" value={authForm.email} onChange={event => setAuthForm({ ...authForm, email: event.target.value })} placeholder="you@example.com"/>
            <label htmlFor="auth-password">Password</label>
            <div className="password-wrap"><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength="10" maxLength="72" value={authForm.password} onChange={event => setAuthForm({ ...authForm, password: event.target.value })} placeholder={isRegister ? 'At least 10 characters' : 'Enter your password'}/><button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
            {isRegister && <small className="field-hint">Use at least 10 characters. Your password is securely hashed.</small>}
            <button className="button button-primary auth-submit" disabled={authSaving}>{authSaving ? <><span className="button-spinner"/>Please wait…</> : isRegister ? 'Create account' : 'Sign in'}<span aria-hidden="true">→</span></button>
          </form>
          <div className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Expense Tracker?'} <button type="button" onClick={() => setAuthMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Sign in' : 'Create an account'}</button></div>
          <p className="auth-privacy"><ShieldCheck size={14}/> Your account and expenses stay private.</p>
        </div>
        <p className="auth-footer">A thoughtful way to keep track of everyday spending.</p>
      </section>
      {toast && <Toast key={toast.id} toast={toast} onDismiss={dismissToast}/>}
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value, hint, tone }) {
  return <article className="summary-card"><div className="summary-label"><span>{label}</span><span className={`summary-icon ${tone}`}><Icon size={17}/></span></div><strong>{value}</strong><small>{hint}</small></article>;
}

function ExpenseRow({ expense, onEdit, onDelete }) {
  const Icon = categoryIcon(expense.category);
  return <article className="expense-row">
    <span className="expense-symbol"><Icon size={18}/></span>
    <div className="expense-description"><strong>{expense.title}</strong><span className="expense-meta"><span className="category-chip">{expense.category}</span><span className="meta-dot" aria-hidden="true">·</span><span>{localDate(expense.date)}</span></span>
      {expense.description && <small>{expense.description}</small>}
    </div>
    <span className="expense-type">Expense</span>
    <strong className="expense-amount">−{money.format(expense.amount)}</strong>
    <div className="expense-actions"><button className="icon-control" onClick={() => onEdit(expense)} aria-label={`Edit ${expense.title}`} title="Edit expense"><Pencil size={16}/></button><button className="icon-control danger-control" onClick={() => onDelete(expense)} aria-label={`Delete ${expense.title}`} title="Delete expense"><Trash2 size={16}/></button></div>
  </article>;
}

function EmptyInline({ icon: Icon = CircleHelp, title, message, action }) {
  return <div className="empty-inline"><span className="empty-inline-icon"><Icon size={19}/></span><strong>{title}</strong><p>{message}</p>{action}</div>;
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton" aria-label="Loading your expenses"><div className="skeleton-grid">{[1, 2, 3, 4].map(item => <div className="skeleton-card" key={item}><span className="skeleton skeleton-line"/><span className="skeleton skeleton-line wide"/><span className="skeleton skeleton-line short"/></div>)}</div><div className="skeleton-row"><div className="skeleton-card large"><span className="skeleton skeleton-line wide"/><span className="skeleton skeleton-block"/></div><div className="skeleton-card large"><span className="skeleton skeleton-line wide"/><span className="skeleton skeleton-block"/></div></div><p>Loading your spending overview…</p></div>;
}

function TransactionFilters({ filters, setFilters, filteredTotal, activeCount, mobileOpen, setMobileOpen, onClear }) {
  return <>
    <div className="filter-mobile-bar"><button className={`button button-quiet filter-toggle ${mobileOpen ? 'selected' : ''}`} onClick={() => setMobileOpen(value => !value)} aria-expanded={mobileOpen}><SlidersHorizontal size={16}/>Filters{activeCount > 0 && <span className="filter-count">{activeCount}</span>}</button><strong>{money.format(filteredTotal)}</strong></div>
    <div className={`filters ${mobileOpen ? 'filters-open' : ''}`}>
      <label className="search-field"><span className="sr-only">Search expenses</span><Search size={16}/><input type="search" value={filters.search} onChange={event => setFilters({ ...filters, search: event.target.value })} placeholder="Search description or category"/></label>
      <label><span className="sr-only">Filter by category</span><select value={filters.category} onChange={event => setFilters({ ...filters, category: event.target.value })}><option value="All">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
      <label className="month-filter"><span className="sr-only">Filter by month</span><CalendarDays size={16}/><input type="month" value={filters.month} onChange={event => setFilters({ ...filters, month: event.target.value })}/></label>
      {activeCount > 0 && <button className="clear-filters" onClick={onClear}>Clear filters</button>}
      <span className="filter-total">Filtered total <strong>{money.format(filteredTotal)}</strong></span>
    </div>
  </>;
}

function ExpenseDialog({ dialogRef, open, editing, form, onChange, onSubmit, onClose, saving, error }) {
  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open, dialogRef]);
  return <dialog className="modal expense-modal" ref={dialogRef} onClose={onClose} aria-labelledby="expense-dialog-title">
    <div className="modal-heading"><div><p className="eyebrow">{editing ? 'UPDATE RECORD' : 'NEW RECORD'}</p><h2 id="expense-dialog-title">{editing ? 'Edit expense' : 'Add an expense'}</h2><p>Keep the details clear. You can update them later.</p></div><button className="icon-control" type="button" onClick={onClose} aria-label="Close expense form"><X size={19}/></button></div>
    {error && <div className="inline-alert form-alert" role="alert">{error}</div>}
    <form className="expense-form" onSubmit={onSubmit}>
      <label htmlFor="expense-title">Description<input id="expense-title" required maxLength="100" value={form.title} onChange={event => onChange('title', event.target.value)} placeholder="e.g. Weekly groceries" autoFocus/></label>
      <div className="form-two"><label htmlFor="expense-amount">Amount<input id="expense-amount" required min="0.01" step="0.01" type="number" inputMode="decimal" value={form.amount} onChange={event => onChange('amount', event.target.value)} placeholder="0.00"/><small>In Nigerian naira (₦)</small></label><label htmlFor="expense-category">Category<select id="expense-category" value={form.category} onChange={event => onChange('category', event.target.value)}>{categories.map(category => <option key={category}>{category}</option>)}</select></label></div>
      <label htmlFor="expense-date">Date<input id="expense-date" required type="date" value={form.date} onChange={event => onChange('date', event.target.value)}/></label>
      <label htmlFor="expense-note">Notes <span className="optional-label">Optional</span><textarea id="expense-note" maxLength="500" value={form.description} onChange={event => onChange('description', event.target.value)} placeholder="Add a note to help you remember" rows="3"/></label>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? <><span className="button-spinner"/>Saving…</> : <>{editing ? <Check size={16}/> : <Plus size={17}/>} {editing ? 'Save changes' : 'Add expense'}</>}</button></div>
    </form>
  </dialog>;
}

function ConfirmDialog({ dialogRef, open, title, description, onCancel, onConfirm }) {
  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open, dialogRef]);
  return <dialog className="modal confirm-modal" ref={dialogRef} onClose={onCancel} aria-labelledby="delete-title">
    <span className="confirm-icon"><Trash2 size={20}/></span><h2 id="delete-title">{title}</h2><p>{description} This can’t be undone.</p>
    <div className="modal-actions"><button className="button button-secondary" onClick={onCancel}>Keep expense</button><button className="button button-danger" onClick={onConfirm}><Trash2 size={15}/>Delete expense</button></div>
  </dialog>;
}

function Toast({ toast, onDismiss }) {
  return <div className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}><span className="toast-icon">{toast.tone === 'error' ? <CircleHelp size={17}/> : <Check size={17}/>}</span><span>{toast.message}</span><button onClick={onDismiss} aria-label="Dismiss notification"><X size={16}/></button></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
