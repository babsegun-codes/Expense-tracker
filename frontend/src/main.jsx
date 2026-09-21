import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4500/api';
const categories = ['Food','Transport','Bills','Shopping','Health','Entertainment','Education','Other'];
const money = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ title: '', amount: '', category: 'Food', date: today(), description: '' });

function App() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: 'All', month: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${API}/expenses`);
      if (!response.ok) throw new Error('Could not load expenses');
      setExpenses(await response.json());
    } catch (err) {
      setError(err.message || 'Could not connect to the API');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

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
      const url = editingId ? `${API}/expenses/${editingId}` : `${API}/expenses`;
      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not save expense');

      if (editingId) {
        setExpenses(current => current.map(item => item._id === editingId ? data : item));
      } else {
        setExpenses(current => [data, ...current]);
      }

      cancelEdit();
    } catch (err) {
      setError(err.message || 'Could not save expense');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this expense?')) return;
    try {
      setError('');
      const response = await fetch(`${API}/expenses/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not delete expense');
      setExpenses(current => current.filter(item => item._id !== id));
      if (editingId === id) cancelEdit();
    } catch (err) {
      setError(err.message || 'Could not delete expense');
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

  return (
    <div className="page">
      <header>
        <div>
          <p className="eyebrow">PERSONAL FINANCE</p>
          <h1>Expense Tracker</h1>
          <p className="sub">Track, search and manage your spending in one place.</p>
        </div>
        <div className="badge">● Connected workspace</div>
      </header>

      {error && <div className="error">{error}</div>}

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
            <div>
              <p className="eyebrow">ACTIVITY</p>
              <h2>Expenses</h2>
            </div>
            <button className="refresh" onClick={load} disabled={loading}><RefreshCw size={14}/>Refresh</button>
          </div>

          <div className="filters">
            <div className="search"><Search size={16}/><input value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} placeholder="Search expenses"/></div>
            <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
              <option>All</option>{categories.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="month" value={filters.month} onChange={e => setFilters({...filters, month: e.target.value})}/>
          </div>

          <div className="result-summary">
            <span>{filtered.length} transaction{filtered.length === 1 ? '' : 's'}</span>
            <strong>{money.format(total)}</strong>
          </div>

          {loading ? <p className="empty">Loading expenses...</p> :
           filtered.length === 0 ? <p className="empty">{expenses.length ? 'No expenses match your filters.' : 'No expenses yet. Add your first transaction.'}</p> :
           <div className="list">{filtered.map(expense => (
            <div className="item" key={expense._id}>
              <div className="item-main">
                <strong>{expense.title}</strong>
                <small>{expense.category} · {new Date(expense.date).toLocaleDateString('en-NG')}</small>
                {expense.description && <p>{expense.description}</p>}
              </div>
              <div className="right">
                <b>{money.format(expense.amount)}</b>
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
