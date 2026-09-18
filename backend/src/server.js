require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, required: true },
  date: { type: Date, required: true },
  description: { type: String, default: '' }
}, { timestamps: true });

const Expense = mongoose.model('Expense', expenseSchema);

app.get('/', (req, res) => res.json({ message: 'Expense Tracker API is running' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/expenses', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1, createdAt: -1 });
    res.json(expenses);
  } catch (error) { res.status(500).json({ message: 'Failed to fetch expenses' }); }
});

app.post('/api/expenses', async (req, res) => {
  try {
    const expense = await Expense.create(req.body);
    res.status(201).json(expense);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.put('/api/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json(expense);
  } catch (error) { res.status(400).json({ message: error.message }); }
});

app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: 'Expense not found' });
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) { res.status(500).json({ message: 'Failed to delete expense' }); }
});

const PORT = process.env.PORT || 4500;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => console.log(`API running on port ${PORT}`)))
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
