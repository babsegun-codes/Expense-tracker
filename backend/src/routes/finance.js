const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const authenticate = require('../middleware/auth');
const Account = require('../models/FinancialAccount');
const Transaction = require('../models/FinancialTransaction');
const Budget = require('../models/Budget');
const Recurring = require('../models/RecurringTransaction');
const transactionDedupeKey = require('../utils/transaction-dedupe');
const { summarizeTransactions } = require('../utils/finance-math');

const router = express.Router();
const isId = value => mongoose.isValidObjectId(value);
const isMonth = value => /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '');
const minor = (value, allowZero = false) => {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Object.assign(new Error('Amount must be positive and use no more than two decimal places.'), { status: 400 });
  const [whole, fraction = ''] = text.split('.');
  const minorUnits = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if ((allowZero ? minorUnits < 0n : minorUnits < 1n) || minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) throw Object.assign(new Error('Amount is outside the supported range.'), { status: 400 });
  return Number(minorUnits);
};
const dateValue = value => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw Object.assign(new Error('A valid transaction date is required.'), { status: 400 });
  return date;
};
const ownAccount = async (userId, id) => {
  if (!isId(id)) return null;
  return Account.findOne({ _id: id, userId, active: true });
};
const serializeAccount = account => {
  const row = account.toObject();
  delete row.providerAccountId; delete row.providerCustomerId; delete row.connectionRef;
  return row;
};

async function accountBalances(userId, accounts) {
  const rows = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'posted' } },
    { $group: { _id: '$accountId', net: { $sum: { $cond: [
      { $in: ['$type', ['income', 'refund']] }, '$amountMinor', { $multiply: ['$amountMinor', -1] }
    ] } } } }
  ]);
  const map = new Map(rows.map(row => [String(row._id), row.net]));
  const transfersIn = await Transaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'posted', type: 'transfer' } },
    { $group: { _id: '$transferToAccountId', total: { $sum: '$amountMinor' } } }
  ]);
  const incoming = new Map(transfersIn.map(row => [String(row._id), row.total]));
  return accounts.map(account => ({ ...serializeAccount(account), balanceMinor: account.openingBalanceMinor + (map.get(String(account._id)) || 0) + (incoming.get(String(account._id)) || 0) }));
}

router.use(authenticate);

router.get('/accounts', async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user.id, active: true }).sort({ createdAt: 1 });
    return res.json(await accountBalances(req.user.id, accounts));
  } catch { return res.status(500).json({ message: 'Could not load your accounts.' }); }
});

router.post('/accounts', async (req, res) => {
  try {
    const { name, type, currency = 'NGN' } = req.body || {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80 || !['bank', 'cash', 'savings', 'mobile_money'].includes(type)) return res.status(400).json({ message: 'Enter a name and a valid account type.' });
    const openingBalanceMinor = req.body.openingBalance === undefined || req.body.openingBalance === '' ? 0 : minor(req.body.openingBalance, true);
    const account = await Account.create({ userId: req.user.id, name: name.trim(), type, currency, openingBalanceMinor });
    return res.status(201).json({ ...serializeAccount(account), balanceMinor: account.openingBalanceMinor });
  } catch (error) { return res.status(error.name === 'ValidationError' ? 400 : 500).json({ message: 'Could not create this account.' }); }
});

router.patch('/accounts/:id', async (req, res) => {
  try {
    const account = await ownAccount(req.user.id, req.params.id);
    if (!account || account.provider) return res.status(account ? 403 : 404).json({ message: 'This account cannot be edited.' });
    if (req.body.name !== undefined) account.name = String(req.body.name).trim();
    await account.save();
    return res.json(serializeAccount(account));
  } catch { return res.status(400).json({ message: 'Please check the account details.' }); }
});

router.delete('/accounts/:id', async (req, res) => {
  try {
    const account = await ownAccount(req.user.id, req.params.id);
    if (!account) return res.status(404).json({ message: 'Account not found.' });
    if (await Transaction.exists({ userId: req.user.id, $or: [{ accountId: account._id }, { transferToAccountId: account._id }], status: 'posted' })) return res.status(409).json({ message: 'This account has transactions. Disconnect it or keep it active so your history remains accurate.' });
    account.active = false; account.connectionStatus = 'disconnected'; await account.save();
    return res.json({ message: 'Account removed.' });
  } catch { return res.status(500).json({ message: 'Could not remove this account.' }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const filter = { userId: req.user.id };
    if (req.query.accountId) filter.accountId = req.query.accountId;
    if (req.query.from || req.query.to) filter.date = { ...(req.query.from ? { $gte: dateValue(req.query.from) } : {}), ...(req.query.to ? { $lte: dateValue(req.query.to) } : {}) };
    const [items, total] = await Promise.all([Transaction.find(filter).sort({ date: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), Transaction.countDocuments(filter)]);
    return res.json({ items, page, limit, total });
  } catch { return res.status(400).json({ message: 'Could not load transactions. Check the filters.' }); }
});

router.post('/transactions', async (req, res) => {
  try {
    const { accountId, type, description, category = 'Other', amount, date, reference = '' } = req.body || {};
    const account = await ownAccount(req.user.id, accountId);
    if (!account) return res.status(400).json({ message: 'Choose one of your active accounts.' });
    if (!['income', 'expense', 'fee', 'refund'].includes(type)) return res.status(400).json({ message: 'Choose income, expense, fee or refund.' });
    if (typeof description !== 'string' || !description.trim() || description.length > 200) return res.status(400).json({ message: 'A description is required.' });
    const transaction = await Transaction.create({ userId: req.user.id, accountId, type, amountMinor: minor(amount), currency: account.currency, description: description.trim(), category: String(category).slice(0, 50), date: dateValue(date), reference: String(reference).slice(0, 120) });
    return res.status(201).json(transaction);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || 'Could not save the transaction.' }); }
});

router.post('/transfers', async (req, res) => {
  try {
    const { sourceAccountId, destinationAccountId, amount, date, description = 'Transfer', reference = '', fee = 0 } = req.body || {};
    const idempotencyKey = String(req.get('Idempotency-Key') || '').slice(0, 100);
    if (idempotencyKey) {
      const prior = await Transaction.findOne({ userId: req.user.id, idempotencyKey });
      if (prior) {
        const same = String(prior.accountId) === String(sourceAccountId) && String(prior.transferToAccountId) === String(destinationAccountId) && prior.amountMinor === minor(amount) && prior.description === String(description).trim().slice(0, 200) && prior.date.toISOString() === dateValue(date).toISOString() && prior.reference === String(reference).slice(0, 120);
        if (!same) return res.status(409).json({ message: 'This idempotency key was already used for a different transfer.' });
        return res.json({ transfer: prior, fee: null, message: 'This transfer was already recorded.' });
      }
    }
    if (sourceAccountId === destinationAccountId) return res.status(400).json({ message: 'Choose two different accounts.' });
    const [source, destination] = await Promise.all([ownAccount(req.user.id, sourceAccountId), ownAccount(req.user.id, destinationAccountId)]);
    if (!source || !destination) return res.status(400).json({ message: 'Both accounts must belong to you and be active.' });
    if (source.currency !== destination.currency) return res.status(400).json({ message: 'Transfers between different currencies are not supported yet.' });
    const amountMinor = minor(amount); const feeMinor = fee ? minor(fee) : 0;
    const current = (await accountBalances(req.user.id, [source]))[0].balanceMinor;
    if (current < amountMinor + feeMinor) return res.status(409).json({ message: 'The recorded balance is insufficient for this transfer and fee.' });
    const transferGroupId = crypto.randomUUID();
    const transaction = await Transaction.create({ userId: req.user.id, accountId: source._id, transferToAccountId: destination._id, type: 'transfer', amountMinor, currency: source.currency, description: String(description).trim().slice(0, 200) || 'Transfer', date: dateValue(date), reference: String(reference).slice(0, 120), transferGroupId, idempotencyKey: idempotencyKey || null });
    let feeTransaction = null;
    if (feeMinor) {
      try { feeTransaction = await Transaction.create({ userId: req.user.id, accountId: source._id, type: 'fee', amountMinor: feeMinor, currency: source.currency, category: 'Bank fees', description: `Transfer fee: ${transaction.description}`, date: transaction.date, reference: transaction.reference, transferGroupId }); }
      catch (error) { await Transaction.deleteOne({ _id: transaction._id, userId: req.user.id }); throw error; }
    }
    return res.status(201).json({ transfer: transaction, fee: feeTransaction, message: 'Transfer recorded in your tracker. No money was moved by this app.' });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || 'Could not record the transfer.' }); }
});

router.post('/transactions/:id/reverse', async (req, res) => {
  try {
    const original = await Transaction.findOne({ _id: req.params.id, userId: req.user.id, status: 'posted' });
    if (!original) return res.status(404).json({ message: 'Posted transaction not found.' });
    if (await Transaction.exists({ userId: req.user.id, reversesTransactionId: original._id })) return res.status(409).json({ message: 'This transaction has already been reversed.' });
    const reverseType = ({ income: 'expense', expense: 'income', fee: 'income', refund: 'expense', transfer: 'transfer' })[original.type];
    const reversal = await Transaction.create({ userId: req.user.id, accountId: original.type === 'transfer' ? original.transferToAccountId : original.accountId, transferToAccountId: original.type === 'transfer' ? original.accountId : null, type: reverseType, amountMinor: original.amountMinor, currency: original.currency, category: original.category, description: `Reversal: ${original.description}`, date: new Date(), source: 'manual', status: 'posted', reversesTransactionId: original._id });
    original.status = 'reversed'; await original.save();
    return res.status(201).json(reversal);
  } catch { return res.status(400).json({ message: 'Could not reverse this transaction.' }); }
});

router.put('/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id, source: 'manual', type: { $ne: 'transfer' }, status: 'posted' });
    if (!transaction) return res.status(404).json({ message: 'Editable manual transaction not found.' });
    const account = await ownAccount(req.user.id, req.body.accountId || transaction.accountId);
    if (!account) return res.status(400).json({ message: 'Choose one of your active accounts.' });
    if (req.body.type && !['income', 'expense', 'fee', 'refund'].includes(req.body.type)) return res.status(400).json({ message: 'Invalid transaction type.' });
    transaction.accountId = account._id; transaction.currency = account.currency;
    if (req.body.amount !== undefined) transaction.amountMinor = minor(req.body.amount);
    if (req.body.type) transaction.type = req.body.type;
    if (req.body.description !== undefined) transaction.description = String(req.body.description).trim();
    if (req.body.category !== undefined) transaction.category = String(req.body.category).slice(0, 50);
    if (req.body.date !== undefined) transaction.date = dateValue(req.body.date);
    await transaction.save();
    return res.json(transaction);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || 'Could not update this transaction.' }); }
});

router.post('/transactions/:id/cancel', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id, source: 'manual', status: 'posted' });
    if (!transaction) return res.status(404).json({ message: 'Cancellable manual transaction not found.' });
    transaction.status = 'cancelled'; await transaction.save();
    if (transaction.transferGroupId) await Transaction.updateMany({ userId: req.user.id, transferGroupId: transaction.transferGroupId, _id: { $ne: transaction._id }, status: 'posted' }, { $set: { status: 'cancelled' } });
    return res.json({ message: 'Transaction cancelled; account history is retained.' });
  } catch { return res.status(400).json({ message: 'Could not cancel this transaction.' }); }
});

router.put('/transfers/:id', async (req, res) => {
  try {
    const transfer = await Transaction.findOne({ _id: req.params.id, userId: req.user.id, type: 'transfer', source: 'manual', status: 'posted' });
    if (!transfer) return res.status(404).json({ message: 'Editable manual transfer not found.' });
    const sourceId = req.body.sourceAccountId || transfer.accountId;
    const destinationId = req.body.destinationAccountId || transfer.transferToAccountId;
    if (String(sourceId) === String(destinationId)) return res.status(400).json({ message: 'Choose two different accounts.' });
    const [source, destination] = await Promise.all([ownAccount(req.user.id, sourceId), ownAccount(req.user.id, destinationId)]);
    if (!source || !destination || source.currency !== destination.currency) return res.status(400).json({ message: 'Choose two of your active accounts with the same currency.' });
    const amountMinor = req.body.amount === undefined ? transfer.amountMinor : minor(req.body.amount);
    const current = (await accountBalances(req.user.id, [source]))[0].balanceMinor;
    const priorOutgoing = String(source._id) === String(transfer.accountId) ? transfer.amountMinor : 0;
    const available = current + priorOutgoing;
    if (available < amountMinor) return res.status(409).json({ message: 'The recorded balance is insufficient for this transfer.' });
    transfer.accountId = source._id; transfer.transferToAccountId = destination._id; transfer.amountMinor = amountMinor; transfer.currency = source.currency;
    if (req.body.description !== undefined) transfer.description = String(req.body.description).trim().slice(0, 200);
    if (req.body.reference !== undefined) transfer.reference = String(req.body.reference).slice(0, 120);
    if (req.body.date !== undefined) transfer.date = dateValue(req.body.date);
    await transfer.save();
    await Transaction.updateMany({ userId: req.user.id, transferGroupId: transfer.transferGroupId, type: 'fee', status: 'posted' }, { $set: { accountId: source._id, currency: source.currency, date: transfer.date, reference: transfer.reference } });
    return res.json(transfer);
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || 'Could not update this transfer.' }); }
});

router.post('/transactions/:id/receipt', async (req, res) => {
  try {
    const { filename, mimeType, data } = req.body || {};
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(mimeType) || typeof data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return res.status(400).json({ message: 'Upload a JPG, PNG, WebP image or PDF receipt.' });
    const bytes = Buffer.from(data, 'base64');
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) return res.status(400).json({ message: 'Receipt must be smaller than 2 MB.' });
    const signatures = { 'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-', 'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/jpeg': bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, 'image/webp': bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' };
    if (!signatures[mimeType]) return res.status(400).json({ message: 'The file content does not match its declared format.' });
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found.' });
    transaction.receipt = { filename: String(filename || 'receipt').replace(/[\\/\r\n"]/g, '').slice(0, 120), mimeType, data: bytes.toString('base64') };
    await transaction.save();
    return res.status(201).json({ message: 'Receipt attached.' });
  } catch { return res.status(400).json({ message: 'Could not attach this receipt.' }); }
});

router.get('/transactions/:id/receipt', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id }).select('+receipt.filename +receipt.mimeType +receipt.data');
    if (!transaction || !transaction.receipt?.data) return res.status(404).json({ message: 'Receipt not found.' });
    res.set('Content-Type', transaction.receipt.mimeType);
    res.set('Content-Disposition', `attachment; filename="${transaction.receipt.filename || 'receipt'}"`);
    res.set('X-Content-Type-Options', 'nosniff');
    return res.send(Buffer.from(transaction.receipt.data, 'base64'));
  } catch { return res.status(404).json({ message: 'Receipt not found.' }); }
});

router.get('/summary', async (req, res) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
    const [year, monthNumber] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, monthNumber - 1, 1)); const end = new Date(Date.UTC(year, monthNumber, 1));
    const items = await Transaction.find({ userId: req.user.id, status: 'posted', date: { $gte: start, $lt: end } });
    return res.json({ ...summarizeTransactions(items), currency: 'NGN', month });
  } catch { return res.status(500).json({ message: 'Could not calculate your summary.' }); }
});

router.get('/reconciliation/balances', async (req, res) => {
  try {
    const accounts = await Account.find({ userId: req.user.id, active: true }).select('+providerBalanceMinor');
    const computed = await accountBalances(req.user.id, accounts);
    return res.json(computed.map(account => ({ accountId: account._id, name: account.name, currency: account.currency, calculatedBalanceMinor: account.balanceMinor, providerBalanceMinor: accounts.find(x => String(x._id) === String(account._id))?.providerBalanceMinor ?? null, differenceMinor: accounts.find(x => String(x._id) === String(account._id))?.providerBalanceMinor == null ? null : accounts.find(x => String(x._id) === String(account._id)).providerBalanceMinor - account.balanceMinor, providerBalanceAt: accounts.find(x => String(x._id) === String(account._id))?.providerBalanceAt || null })));
  } catch { return res.status(500).json({ message: 'Could not reconcile account balances.' }); }
});

router.get('/reconciliation/suggestions', async (req, res) => {
  try {
    const imported = await Transaction.find({ userId: req.user.id, source: 'bank_import', status: 'posted', type: { $in: ['income', 'expense'] }, description: /transfer|nip|own account|interbank/i }).sort({ date: -1 }).limit(400).lean();
    const suggestions = [];
    for (const debit of imported.filter(item => item.type === 'expense')) {
      const credit = imported.find(item => item.type === 'income' && String(item.accountId) !== String(debit.accountId) && item.currency === debit.currency && item.amountMinor === debit.amountMinor && Math.abs(new Date(item.date) - new Date(debit.date)) <= 3 * 86400000);
      if (credit) {
        const names = await Account.find({ userId: req.user.id, _id: { $in: [debit.accountId, credit.accountId] } }).select('name').lean();
        suggestions.push({ debitId: debit._id, creditId: credit._id, amountMinor: debit.amountMinor, date: debit.date, description: debit.description, debitAccount: names.find(x => String(x._id) === String(debit.accountId))?.name || 'Account', creditAccount: names.find(x => String(x._id) === String(credit.accountId))?.name || 'Account' });
      }
    }
    return res.json(suggestions.slice(0, 50));
  } catch { return res.status(500).json({ message: 'Could not load reconciliation suggestions.' }); }
});

router.post('/reconciliation/match', async (req, res) => {
  try {
    const { debitId, creditId } = req.body || {};
    if (!isId(debitId) || !isId(creditId) || debitId === creditId) return res.status(400).json({ message: 'Choose two valid transactions.' });
    const [debit, credit] = await Promise.all([
      Transaction.findOne({ _id: debitId, userId: req.user.id, type: 'expense', source: 'bank_import', status: 'posted' }),
      Transaction.findOne({ _id: creditId, userId: req.user.id, type: 'income', source: 'bank_import', status: 'posted' })
    ]);
    if (!debit || !credit || String(debit.accountId) === String(credit.accountId) || debit.currency !== credit.currency || debit.amountMinor !== credit.amountMinor || Math.abs(new Date(debit.date) - new Date(credit.date)) > 3 * 86400000) return res.status(409).json({ message: 'These transactions no longer form a valid transfer candidate.' });
    const idempotencyKey = `reconcile:${[String(debit._id), String(credit._id)].sort().join(':')}`;
    const existing = await Transaction.findOne({ userId: req.user.id, idempotencyKey });
    if (existing) return res.json(existing);
    const transfer = await Transaction.create({ userId: req.user.id, accountId: debit.accountId, transferToAccountId: credit.accountId, type: 'transfer', amountMinor: debit.amountMinor, currency: debit.currency, description: `Matched transfer: ${debit.description}`, date: debit.date, source: 'bank_import', transferGroupId: crypto.randomUUID(), idempotencyKey, provider: 'mono' });
    try {
      const result = await Transaction.updateMany({ _id: { $in: [debit._id, credit._id] }, userId: req.user.id, status: 'posted' }, { $set: { status: 'reversed' } });
      if (result.modifiedCount !== 2) throw new Error('Transfer candidates changed during reconciliation.');
    } catch (error) {
      await Transaction.updateMany({ _id: { $in: [debit._id, credit._id] }, userId: req.user.id, status: 'reversed' }, { $set: { status: 'posted' } });
      await Transaction.deleteOne({ _id: transfer._id, userId: req.user.id });
      throw error;
    }
    return res.status(201).json(transfer);
  } catch { return res.status(400).json({ message: 'Could not match these transactions.' }); }
});

router.get('/budgets', async (req, res) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
    const budgets = await Budget.find({ userId: req.user.id, month }).lean();
    const [year, m] = month.split('-').map(Number); const from = new Date(year, m - 1, 1); const to = new Date(year, m, 1);
    const spent = await Transaction.aggregate([{ $match: { userId: new mongoose.Types.ObjectId(req.user.id), type: { $in: ['expense', 'fee'] }, status: 'posted', date: { $gte: from, $lt: to } } }, { $group: { _id: '$category', amountMinor: { $sum: '$amountMinor' } } }]);
    const spentByCategory = new Map(spent.map(x => [x._id, x.amountMinor]));
    return res.json(budgets.map(b => ({ ...b, spentMinor: spentByCategory.get(b.category) || 0 })));
  } catch { return res.status(500).json({ message: 'Could not load budgets.' }); }
});

router.post('/budgets', async (req, res) => {
  try {
    const { category, month, amount } = req.body || {};
    if (!category || !isMonth(month)) return res.status(400).json({ message: 'Enter a category and a valid month.' });
    const budget = await Budget.findOneAndUpdate({ userId: req.user.id, category: String(category).slice(0, 50), month }, { $set: { amountMinor: minor(amount), currency: 'NGN' } }, { upsert: true, new: true, runValidators: true });
    return res.json(budget);
  } catch (error) { return res.status(400).json({ message: error.message || 'Could not save this budget.' }); }
});

router.get('/recurring', async (req, res) => {
  try { return res.json(await Recurring.find({ userId: req.user.id }).sort({ nextDate: 1 })); }
  catch { return res.status(500).json({ message: 'Could not load recurring entries.' }); }
});

router.post('/recurring', async (req, res) => {
  try {
    const { accountId, type, amount, description, category, frequency, nextDate } = req.body || {};
    if (!await ownAccount(req.user.id, accountId)) return res.status(400).json({ message: 'Choose one of your active accounts.' });
    const recurring = await Recurring.create({ userId: req.user.id, accountId, type, amountMinor: minor(amount), description, category, frequency, nextDate: dateValue(nextDate) });
    return res.status(201).json(recurring);
  } catch (error) { return res.status(400).json({ message: error.message || 'Could not save this schedule.' }); }
});

router.post('/recurring/:id/post', async (req, res) => {
  try {
    const schedule = await Recurring.findOne({ _id: req.params.id, userId: req.user.id, active: true });
    if (!schedule) return res.status(404).json({ message: 'Active recurring schedule not found.' });
    const occurrence = schedule.nextDate.toISOString().slice(0, 10);
    if (occurrence > new Date().toISOString().slice(0, 10)) return res.status(409).json({ message: 'This recurring transaction is not due yet.' });
    let transaction = await Transaction.findOne({ userId: req.user.id, recurringTransactionId: schedule._id, recurringOccurrenceDate: occurrence });
    if (!transaction) transaction = await Transaction.create({ userId: req.user.id, accountId: schedule.accountId, type: schedule.type, amountMinor: schedule.amountMinor, currency: schedule.currency, category: schedule.category, description: schedule.description, date: schedule.nextDate, source: 'recurring', recurringTransactionId: schedule._id, recurringOccurrenceDate: occurrence });
    const next = new Date(schedule.nextDate);
    if (schedule.frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
    if (schedule.frequency === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + 1);
    if (schedule.frequency === 'monthly') {
      const day = next.getUTCDate(); next.setUTCDate(1); next.setUTCMonth(next.getUTCMonth() + 1);
      const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate(); next.setUTCDate(Math.min(day, lastDay));
    }
    schedule.nextDate = next; await schedule.save();
    return res.status(201).json({ transaction, nextDate: schedule.nextDate });
  } catch { return res.status(400).json({ message: 'Could not post this recurring transaction.' }); }
});

router.delete('/recurring/:id', async (req, res) => {
  try {
    const schedule = await Recurring.findOne({ _id: req.params.id, userId: req.user.id, active: true });
    if (!schedule) return res.status(404).json({ message: 'Schedule not found.' });
    schedule.active = false; await schedule.save();
    return res.json({ message: 'Recurring schedule stopped.' });
  } catch { return res.status(400).json({ message: 'Could not stop this schedule.' }); }
});

router.post('/imports/preview', async (req, res) => {
  try {
    const { accountId, rows } = req.body || {};
    const account = await ownAccount(req.user.id, accountId);
    if (!account) return res.status(400).json({ message: 'Choose one of your active accounts.' });
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 1000) return res.status(400).json({ message: 'Import must contain between 1 and 1,000 rows.' });
    const normalized = rows.map((row, index) => {
      const type = String(row.type || '').toLowerCase();
      const amountMinor = minor(row.amount);
      if (!['income', 'expense', 'fee', 'refund'].includes(type)) throw Object.assign(new Error(`Row ${index + 1}: use income, expense, fee or refund.`), { status: 400 });
      if (!row.description || String(row.description).length > 200) throw Object.assign(new Error(`Row ${index + 1}: description is required (maximum 200 characters).`), { status: 400 });
      const date = dateValue(row.date);
      const normalizedRow = { userId: req.user.id, accountId, type, amountMinor, currency: account.currency, description: String(row.description).trim(), category: String(row.category || 'Other').slice(0, 50), date, reference: String(row.reference || '').slice(0, 120), source: 'statement_import' };
      normalizedRow.dedupeKey = transactionDedupeKey(normalizedRow);
      return normalizedRow;
    });
    const keys = normalized.map(x => x.dedupeKey);
    const seen = new Set();
    for (let i = 0; i < normalized.length; i++) {
      const row = normalized[i];
      const duplicate = seen.has(keys[i]) || await Transaction.exists({ userId: req.user.id, dedupeKey: keys[i] });
      row.duplicate = Boolean(duplicate); seen.add(keys[i]);
    }
    return res.json({ items: normalized, accepted: normalized.filter(x => !x.duplicate).length, duplicates: normalized.filter(x => x.duplicate).length });
  } catch (error) { return res.status(error.status || 400).json({ message: error.message || 'Could not validate this import.' }); }
});

router.post('/imports/commit', async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length > 1000) return res.status(400).json({ message: 'Invalid reviewed import.' });
    const saved = []; const seen = new Set();
    for (const item of items) {
      if (item.duplicate) continue;
      const account = await ownAccount(req.user.id, item.accountId);
      if (!account) return res.status(403).json({ message: 'The selected account is no longer available.' });
      const amountMinor = Number(item.amountMinor);
      if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) return res.status(400).json({ message: 'Invalid import amount.' });
      if (!['income', 'expense', 'fee', 'refund'].includes(item.type) || typeof item.description !== 'string' || !item.description.trim() || item.description.length > 200) return res.status(400).json({ message: 'Invalid reviewed transaction.' });
      const transaction = { userId: req.user.id, accountId: account._id, type: item.type, amountMinor, currency: account.currency, description: item.description.trim(), category: String(item.category || 'Other').slice(0, 50), date: dateValue(item.date), reference: String(item.reference || '').slice(0, 120), source: 'statement_import' };
      transaction.dedupeKey = transactionDedupeKey(transaction);
      if (seen.has(transaction.dedupeKey) || await Transaction.exists({ userId: req.user.id, dedupeKey: transaction.dedupeKey })) continue;
      seen.add(transaction.dedupeKey); saved.push(transaction);
    }
    const inserted = saved.length ? await Transaction.insertMany(saved, { ordered: false }) : [];
    return res.status(201).json({ imported: inserted.length, skipped: items.length - inserted.length });
  } catch { return res.status(400).json({ message: 'Could not save the reviewed import.' }); }
});

module.exports = { router, accountBalances, serializeAccount };
