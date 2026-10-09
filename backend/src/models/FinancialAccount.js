const mongoose = require('mongoose');

const financialAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  type: { type: String, enum: ['bank', 'cash', 'savings', 'mobile_money'], required: true },
  currency: { type: String, uppercase: true, default: 'NGN', match: /^[A-Z]{3}$/ },
  openingBalanceMinor: { type: Number, required: true, default: 0, min: 0, validate: Number.isSafeInteger },
  provider: { type: String, enum: ['mono'], default: null },
  providerEnvironment: { type: String, enum: ['sandbox', 'production', 'unknown'], default: 'unknown' },
  providerAccountId: { type: String, default: null, select: false },
  providerCustomerId: { type: String, default: null, select: false },
  connectionRef: { type: String, default: null, select: false },
  institution: { type: String, default: '' },
  accountNumberMasked: { type: String, default: '' },
  connectionStatus: { type: String, enum: ['manual', 'pending', 'connected', 'syncing', 'error', 'disconnected'], default: 'manual' },
  dataStatus: { type: String, default: '' },
  retrievedData: [{ type: String }],
  providerBalanceMinor: { type: Number, default: null, select: false },
  providerBalanceAt: { type: Date, default: null },
  lastSyncedAt: { type: Date, default: null },
  lastSyncError: { type: String, default: '' },
  active: { type: Boolean, default: true }
}, { timestamps: true });

financialAccountSchema.index({ userId: 1, provider: 1, providerAccountId: 1 }, { unique: true, partialFilterExpression: { providerAccountId: { $type: 'string' } } });
module.exports = mongoose.model('FinancialAccount', financialAccountSchema);
