const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Expense = require('./models/Expense');
const authRoutes = require('./routes/auth');
const authenticate = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

app.get('/', (req, res) => res.json({ message: 'Expense Tracker API is running' }));
app.get('/health', (req, res) => res.json({
  status: 'ok',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
}));
app.use('/api/auth', authRoutes);

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
    return res.json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Expense not found.' });
    console.error('Expense deletion failed:', error.message);
    return res.status(500).json({ message: 'Could not delete the expense.' });
  }
});

module.exports = app;
