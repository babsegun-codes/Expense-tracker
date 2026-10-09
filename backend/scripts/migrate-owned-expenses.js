require('dotenv').config();
const mongoose = require('mongoose');
const Expense = require('../src/models/Expense');
const Account = require('../src/models/FinancialAccount');
const Transaction = require('../src/models/FinancialTransaction');

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  await mongoose.connect(process.env.MONGODB_URI);
  const owned = await Expense.find({ userId: { $exists: true, $ne: null } }).lean();
  const owners = new Set(owned.map(expense => String(expense.userId)));
  console.log(`Found ${owned.length} already-owned expense records across ${owners.size} users.`);
  console.log('Ownerless records are intentionally left untouched.');
  if (!process.argv.includes('--apply')) {
    console.log('Dry run only. Re-run with --apply to copy them into finance transactions.');
    await mongoose.disconnect(); return;
  }
  let copied = 0;
  for (const expense of owned) {
    const account = await Account.findOneAndUpdate({ userId: expense.userId, name: 'Personal account', type: 'cash', active: true }, { $setOnInsert: { userId: expense.userId, name: 'Personal account', type: 'cash', currency: 'NGN', openingBalanceMinor: 0 } }, { upsert: true, new: true });
    const amountMinor = Math.round(Number(expense.amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 1) continue;
    const result = await Transaction.updateOne({ userId: expense.userId, legacyExpenseId: expense._id }, { $setOnInsert: { userId: expense.userId, accountId: account._id, type: 'expense', amountMinor, currency: 'NGN', category: expense.category || 'Other', description: expense.title || 'Imported expense', date: expense.date, source: 'legacy_migration', legacyExpenseId: expense._id } }, { upsert: true });
    if (result.upsertedCount) copied++;
  }
  console.log(`Copied ${copied} expense records; existing copies were skipped.`);
  await mongoose.disconnect();
}

run().catch(async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
