const mongoose = require('mongoose');

const financialTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialAccount', required: true, index: true },
  transferToAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialAccount', default: null },
  type: { type: String, enum: ['income', 'expense', 'transfer', 'fee', 'refund'], required: true },
  amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  currency: { type: String, uppercase: true, default: 'NGN', match: /^[A-Z]{3}$/ },
  category: { type: String, trim: true, maxlength: 50, default: 'Other' },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  date: { type: Date, required: true },
  reference: { type: String, trim: true, maxlength: 120, default: '' },
  source: { type: String, enum: ['manual', 'bank_import', 'statement_import', 'receipt_import', 'recurring', 'legacy_migration'], default: 'manual' },
  provider: { type: String, default: null },
  providerTransactionId: { type: String, default: null },
  providerMetadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['posted', 'reversed', 'cancelled'], default: 'posted' },
  reversesTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  transferGroupId: { type: String, default: null },
  idempotencyKey: { type: String, default: null },
  dedupeKey: { type: String, default: null },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, default: null },
  recurringTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  recurringOccurrenceDate: { type: String, default: null },
  legacyExpenseId: { type: mongoose.Schema.Types.ObjectId, default: null },
  receipt: {
    filename: { type: String, default: '', select: false },
    mimeType: { type: String, default: '', select: false },
    data: { type: String, default: '', select: false }
  }
}, { timestamps: true });

financialTransactionSchema.pre('validate', function validateTransfer(next) {
  if (this.type === 'transfer' && (!this.transferToAccountId || String(this.transferToAccountId) === String(this.accountId))) {
    this.invalidate('transferToAccountId', 'A transfer requires a different destination account.');
  }
  if (this.type !== 'transfer' && this.transferToAccountId) this.invalidate('transferToAccountId', 'Only transfers can have a destination account.');
  next();
});

financialTransactionSchema.index({ userId: 1, provider: 1, accountId: 1, providerTransactionId: 1 }, { unique: true, partialFilterExpression: { providerTransactionId: { $type: 'string' } } });
financialTransactionSchema.index({ userId: 1, date: -1, _id: -1 });
financialTransactionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } });
financialTransactionSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });
financialTransactionSchema.index({ userId: 1, legacyExpenseId: 1 }, { unique: true, partialFilterExpression: { legacyExpenseId: { $type: 'objectId' } } });
financialTransactionSchema.index({ userId: 1, recurringTransactionId: 1, recurringOccurrenceDate: 1 }, { unique: true, partialFilterExpression: { recurringTransactionId: { $type: 'objectId' } } });
module.exports = mongoose.model('FinancialTransaction', financialTransactionSchema);
