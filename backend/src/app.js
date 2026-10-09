const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Expense = require('./models/Expense');
const authRoutes = require('./routes/auth');
const authenticate = require('./middleware/auth');
const financeRoutes = require('./routes/finance').router;
const bankModule = require('./routes/bank');
const bankRoutes = bankModule.router;
const bankWebhook = bankModule.webhook;
const FinancialAccount = require('./models/FinancialAccount');
const FinancialTransaction = require('./models/FinancialTransaction');

const app = express();
app.use(cors());

app.get('/', (req, res) => res.json({ message: 'Expense Tracker API is running' }));
app.get('/health', (req, res) => res.json({
  status: 'ok',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
}));
app.post('/api/bank/webhook', express.raw({ type: 'application/json', limit: '256kb' }), bankWebhook);
app.use(express.json({ limit: '3mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/bank', bankRoutes);

function expenseFields(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Invalid expense body');
    error.name = 'ValidationError';
    throw error;
  }
  return {
    title: body.title,
    amount: body.amount,
    category: body.category,
    date: body.date,
    description: body.description
  };
}

app.get('/api/expenses', authenticate, async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user.id }).sort({ date: -1, createdAt: -1 });
    return res.json(expenses);
  } catch (error) {
    console.error('Expense fetch failed:', error.message);
    return res.status(500).json({ message: 'Failed to fetch expenses.' });
  }
});

app.post('/api/expenses', authenticate, async (req, res) => {
  try {
    const expense = await Expense.create({ ...expenseFields(req.body), userId: req.user.id });
    const account = await FinancialAccount.findOneAndUpdate(
      { userId: req.user.id, name: 'Personal account', type: 'cash', active: true },
      { $setOnInsert: { userId: req.user.id, name: 'Personal account', type: 'cash', currency: 'NGN', openingBalanceMinor: 0 } },
      { upsert: true, new: true }
    );
    await FinancialTransaction.create({ userId: req.user.id, accountId: account._id, type: 'expense', amountMinor: Math.round(Number(expense.amount) * 100), currency: 'NGN', category: expense.category, description: expense.title, date: expense.date, source: 'legacy_migration', legacyExpenseId: expense._id });
    return res.status(201).json(expense);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: 'Please check the expense details and try again.' });
    }
    console.error('Expense creation failed:', error.message);
    return res.status(500).json({ message: 'Could not save the expense.' });
  }
});

app.put('/api/expenses/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: expenseFields(req.body) },
      { new: true, runValidators: true }
    );
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    await FinancialTransaction.updateOne({ userId: req.user.id, legacyExpenseId: expense._id, status: 'posted' }, { $set: { amountMinor: Math.round(Number(expense.amount) * 100), category: expense.category, description: expense.title, date: expense.date } });
    return res.json(expense);
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: 'Please check the expense details and try again.' });
    }
    console.error('Expense update failed:', error.message);
    return res.status(500).json({ message: 'Could not update the expense.' });
  }
});

app.delete('/api/expenses/:id', authenticate, async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!expense) return res.status(404).json({ message: 'Expense not found.' });
    await FinancialTransaction.updateOne({ userId: req.user.id, legacyExpenseId: expense._id, status: 'posted' }, { $set: { status: 'cancelled' } });
    return res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Expense not found.' });
    console.error('Expense deletion failed:', error.message);
    return res.status(500).json({ message: 'Could not delete the expense.' });
  }
});

module.exports = app;
