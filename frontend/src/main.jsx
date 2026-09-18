import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Plus, Trash2 } from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4500/api';
const categories = ['Food','Transport','Bills','Shopping','Health','Entertainment','Education','Other'];
const money = new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:2});

function App(){
  const [expenses,setExpenses]=useState([]);
  const [form,setForm]=useState({title:'',amount:'',category:'Food',date:new Date().toISOString().slice(0,10),description:''});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  async function load(){
    try { setLoading(true); const r=await fetch(`${API}/expenses`); if(!r.ok) throw new Error('Could not load expenses'); setExpenses(await r.json()); }
    catch(e){setError(e.message)} finally{setLoading(false)}
  }
  useEffect(()=>{load()},[]);

  async function addExpense(e){
    e.preventDefault(); setError('');
    try{
      const r=await fetch(`${API}/expenses`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,amount:Number(form.amount)})});
      if(!r.ok){const d=await r.json();throw new Error(d.message||'Could not add expense')}
      const item=await r.json(); setExpenses(x=>[item,...x]);
      setForm({title:'',amount:'',category:'Food',date:new Date().toISOString().slice(0,10),description:''});
    }catch(e){setError(e.message)}
  }

  async function remove(id){
    if(!confirm('Delete this expense?')) return;
    try{const r=await fetch(`${API}/expenses/${id}`,{method:'DELETE'});if(!r.ok)throw new Error('Could not delete expense');setExpenses(x=>x.filter(i=>i._id!==id))}catch(e){setError(e.message)}
  }

  const total=expenses.reduce((s,e)=>s+Number(e.amount),0);
  const average=expenses.length?total/expenses.length:0;
  const month=new Date().getMonth();
  const monthly=expenses.filter(e=>new Date(e.date).getMonth()===month).reduce((s,e)=>s+Number(e.amount),0);

  return <div className="page">
    <header><div><p className="eyebrow">PERSONAL FINANCE</p><h1>Expense Tracker</h1><p className="sub">A simple view of where your money goes.</p></div><div className="badge">● Live workspace</div></header>
    {error&&<div className="error">{error}</div>}
    <section className="stats">
      <div className="card"><span>Total spending</span><strong>{money.format(total)}</strong><small>All recorded expenses</small></div>
      <div className="card"><span>This month</span><strong>{money.format(monthly)}</strong><small>Current month</small></div>
      <div className="card"><span>Transactions</span><strong>{expenses.length}</strong><small>Total records</small></div>
      <div className="card"><span>Average</span><strong>{money.format(average)}</strong><small>Per transaction</small></div>
    </section>
    <section className="grid">
      <form className="panel form" onSubmit={addExpense}><div className="panel-title"><div><p className="eyebrow">NEW TRANSACTION</p><h2>Add expense</h2></div><Plus size={20}/></div>
        <label>Title<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. Groceries"/></label>
        <div className="two"><label>Amount (₦)<input required min="0" step="0.01" type="number" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label></div>
        <label>Date<input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Optional note" rows="3"/></label>
        <button className="primary"><Plus size={17}/>Add expense</button>
      </form>
      <div className="panel"><div className="panel-title"><div><p className="eyebrow">ACTIVITY</p><h2>Recent expenses</h2></div><button className="refresh" onClick={load}>Refresh</button></div>
        {loading?<p className="empty">Loading...</p>:expenses.length===0?<p className="empty">No expenses yet. Add your first transaction.</p>:<div className="list">{expenses.map(e=><div className="item" key={e._id}><div><strong>{e.title}</strong><small>{e.category} · {new Date(e.date).toLocaleDateString('en-NG')}</small></div><div className="right"><b>{money.format(e.amount)}</b><button onClick={()=>remove(e._id)}><Trash2 size={16}/></button></div></div>)}</div>}
      </div>
    </section>
  </div>
}
createRoot(document.getElementById('root')).render(<App/>);
