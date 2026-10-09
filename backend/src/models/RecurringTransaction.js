const mongoose = require('mongoose');
const recurringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialAccount', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  category: { type: String, trim: true, maxlength: 50, default: 'Other' },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },
  nextDate: { type: Date, required: true },
  active: { type: Boolean, default: true },
  currency: { type: String, uppercase: true, default: 'NGN', match: /^[A-Z]{3}$/ }
}, { timestamps: true });
module.exports = mongoose.model('RecurringTransaction', recurringSchema);
