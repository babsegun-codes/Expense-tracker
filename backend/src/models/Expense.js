const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Optional only so pre-V2 records without an owner remain readable by
  // migration tooling. All API-created expenses set this from the JWT.
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  title: { type: String, required: true, trim: true, maxlength: 100 },
  amount: { type: Number, required: true, min: 0.01 },
  category: { type: String, required: true, trim: true, maxlength: 50 },
  date: { type: Date, required: true },
  description: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
