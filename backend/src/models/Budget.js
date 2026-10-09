const mongoose = require('mongoose');
const budgetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { type: String, required: true, trim: true, maxlength: 50 },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, uppercase: true, default: 'NGN', match: /^[A-Z]{3}$/ }
}, { timestamps: true });
budgetSchema.index({ userId: 1, category: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('Budget', budgetSchema);
