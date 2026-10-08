import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LogOut, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import './style.css';

const API = '/api';
const categories = ['Food','Transport','Bills','Shopping','Health','Entertainment','Education','Other'];
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ title: '', amount: '', category: 'Food', date: today(), description: '' });

async function apiRequest(path, token, options = {}) {
  const response = await fetch(API + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers
    }
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.message || 'The request could not be completed.'); error.status = response.status; throw error; }
  return data;
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('expense-tracker-token') || '');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(true);
  const [authSaving, setAuthSaving] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: 'All', month: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [claimMessage, setClaimMessage] = useState('');

  function clearSession() {
    localStorage.removeItem('expense-tracker-token');
    setToken('');
    setUser(null);
    setExpenses([]);
  }

  async function load(authToken = token) {
    try {
      setLoading(true);
      setError('');
      setExpenses(await apiRequest('/expenses', authToken));
    } catch (err) {
      if (err.status === 401) clearSession();
      setError(err.message || 'Could not load expenses');
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
        await load(token);
      } catch (err) {
        if (active && err.status === 401) clearSession();
        else if (active) setError('Could not restore your session. Check your connection and try again.');
      } finally {
        if (active) setAuthLoading(false);
      }
    }
    restoreSession();
    return () => { active = false; };
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setError('');
    setAuthSaving(true);
    try {
      const result = await apiRequest('/auth/' + authMode, '', {
        method: 'POST',
        body: JSON.stringify(authForm)
      });
      localStorage.setItem('expense-tracker-token', result.token);
      setToken(result.token);
      setUser(result.user);
      setAuthForm({ email: '', password: '' });
      await load(result.token);
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setAuthSaving(false);
    }
  }

  function logout() {
    clearSession();
    setError('');
    setClaimMessage('');
  }

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function startEdit(expense) {
    setEditingId(expense._id);
    setForm({
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category,
      date: new Date(expense.date).toISOString().slice(0, 10),
      description: expense.description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  async function saveExpense(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const path = editingId ? '/expenses/' + editingId : '/expenses';
      const data = await apiRequest(path, token, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) })
      });
      if (editingId) setExpenses(current => current.map(item => item._id === editingId ? data : item));
      else setExpenses(current => [data, ...current]);
      cancelEdit();
    } catch (err) {
      if (err.status === 401) clearSession();
      setError(err.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      setError('');
      await apiRequest('/expenses/' + id, token, { method: 'DELETE' });
      setExpenses(current => current.filter(item => item._id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      if (err.status === 401) clearSession();
      setError(err.message || 'Could not delete expense');
    }
  }

  async function claimLegacy(event) {
    event.preventDefault();
    setClaimMessage('');
    setError('');
    try {
      const result = await apiRequest('/auth/claim-legacy', token, {
        method: 'POST',
        body: JSON.stringify({ claimToken })
      });
      setClaimToken('');
      setClaimMessage(result.claimed
        ? result.claimed + ' existing expense record(s) are now in your account.'
        : 'No unassigned legacy expenses were found.');
      await load();
    } catch (err) {
      if (err.status === 401) clearSession();
      setError(err.message || 'Could not claim existing expenses.');
    }
  }

  const filtered = useMemo(() => expenses.filter(item => {
    const text = filters.search.trim().toLowerCase();
    const matchesText = !text || [item.title, item.category, item.description].some(value => String(value || '').toLowerCase().includes(text));
    const matchesCategory = filters.category === 'All' || item.category === filters.category;
    const matchesMonth = !filters.month || new Date(item.date).toISOString().slice(0, 7) === filters.month;
    return matchesText && matchesCategory && matchesMonth;
  }), [expenses, filters]);

  const total = filtered.reduce((sum, item) => sum + Number(item.amount), 0);
  const allTotal = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthly = expenses.filter(item => new Date(item.date).toISOString().slice(0, 7) === currentMonth)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const average = expenses.length ? allTotal / expenses.length : 0;

  if (authLoading) return <main className="auth-page"><p className="empty">Checking your session...</p></main>;

  if (!user) return (
    <main className="auth-page">
      <section className="auth-card">
        <p className="eyebrow">PERSONAL FINANCE</p>
        <h1>Expense Tracker</h1>
        <p className="sub">{authMode === 'login' ? 'Sign in to view your private expenses.' : 'Create an account for your personal finances.'}</p>
        {error && <div className="error">{error}</div>}
        <form className="auth-form" onSubmit={submitAuth}>
          <label>Email<input type="email" autoComplete="email" required maxLength="254" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })}/></label>
          <label>Password<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} required minLength="10" maxLength="128" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })}/></label>
          {authMode === 'register' && <small className="hint">Use at least 10 characters.</small>}
          <button className="primary" disabled={authSaving}>{authSaving ? 'Please wait...' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="auth-switch">
          {authMode === 'login' ? 'New to Expense Tracker?' : 'Already have an account?'}
          {' '}<button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}>
            {authMode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </section>
    </main>
  );

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">PERSONAL FINANCE</p>
          <h1>Expense Tracker</h1>
          <p className="sub">Track, search and manage your spending in one place.</p>
        </div>
        <div className="account-bar">
          <span>{user.email}</span>
          <button className="refresh" onClick={logout}><LogOut size={14}/>Sign out</button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}
      {claimMessage && <div className="success">{claimMessage}</div>}

      <section className="panel legacy-panel">
        <div>
          <p className="eyebrow">EXISTING DATA</p>
          <h2>Bring over your original expenses</h2>
          <p className="sub">Only use this if these records are yours and the server has enabled your verified owner account.</p>
        </div>
        <form className="claim-form" onSubmit={claimLegacy}>
          <label>One-time claim code<input type="password" autoComplete="off" value={claimToken} onChange={e => setClaimToken(e.target.value)} required/></label>
          <button className="refresh" type="submit">Claim unassigned expenses</button>
        </form>
      </section>

      <section className="stats">
        <div className="card"><span>Total spending</span><strong>{money.format(allTotal)}</strong><small>All recorded expenses</small></div>
        <div className="card"><span>This month</span><strong>{money.format(monthly)}</strong><small>Current month</small></div>
        <div className="card"><span>Transactions</span><strong>{expenses.length}</strong><small>Saved records</small></div>
        <div className="card"><span>Average</span><strong>{money.format(average)}</strong><small>Per transaction</small></div>
      </section>

      <section className="grid">
        <form className="panel form" onSubmit={saveExpense}>
          <div className="panel-title">
            <div>
              <p className="eyebrow">{editingId ? 'EDIT TRANSACTION' : 'NEW TRANSACTION'}</p>
              <h2>{editingId ? 'Edit expense' : 'Add expense'}</h2>
            </div>
            {editingId ? <button type="button" className="icon-button" onClick={cancelEdit} title="Cancel"><X size={18}/></button> : <Plus size={20}/>}
          </div>
          <label>Title<input required maxLength="100" value={form.title} onChange={e => change('title', e.target.value)} placeholder="e.g. Groceries"/></label>
          <div className="two">
            <label>Amount (₦)<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={e => change('amount', e.target.value)}/></label>
            <label>Category<select value={form.category} onChange={e => change('category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
          </div>
          <label>Date<input required type="date" value={form.date} onChange={e => change('date', e.target.value)}/></label>
          <label>Description<textarea maxLength="500" value={form.description} onChange={e => change('description', e.target.value)} placeholder="Optional note" rows="3"/></label>
          <button className="primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Add expense'}</button>
        </form>

        <div className="panel">
          <div className="panel-title">
            <div><p className="eyebrow">ACTIVITY</p><h2>Expenses</h2></div>
            <button className="refresh" onClick={load} disabled={loading}><RefreshCw size={14}/>Refresh</button>
          </div>
          <div className="filters">
            <div className="search"><Search size={16}/><input value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="Search expenses"/></div>
            <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
              <option>All</option>{categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="month" value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})}/>
          </div>
          <div className="result-summary"><span>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}</span><strong>{money.format(total)}</strong></div>
          {loading ? <p className="empty">Loading expenses...</p> :
           filtered.length === 0 ? <p className="empty">{expenses.length ? 'No expenses match your filters.' : 'No expenses yet. Add your first transaction.'}</p> :
           <div className="list">{filtered.map(expense => (
            <div className="item" key={expense._id}>
              <div className="item-main"><strong>{expense.title}</strong>
                <small>{expense.category} · {new Date(expense.date).toLocaleDateString('en-NG')}</small>
                {expense.description && <p>{expense.description}</p>}
              </div>
              <div className="right"><b>{money.format(expense.amount)}</b>
                <button onClick={() => startEdit(expense)} title="Edit"><Pencil size={15}/></button>
                <button onClick={() => remove(expense._id)} title="Delete"><Trash2 size={15}/></button>
              </div>
            </div>
          ))}</div>}
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
