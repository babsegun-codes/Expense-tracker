const test = require('node:test');
const assert = require('node:assert/strict');
const { transactionEffects, summarizeTransactions } = require('../src/utils/finance-math');
const Account = require('../src/models/FinancialAccount');
const Transaction = require('../src/models/FinancialTransaction');

test('integer-minor-unit accounting applies both sides of a transfer without income or expense', () => {
  assert.deepEqual(transactionEffects({ type: 'transfer', accountId: 'a', transferToAccountId: 'b', amountMinor: 5000000 }), [['a', -5000000], ['b', 5000000]]);
  assert.deepEqual(summarizeTransactions([
    { type: 'income', amountMinor: 150000, status: 'posted' },
    { type: 'expense', amountMinor: 25000, status: 'posted' },
    { type: 'fee', amountMinor: 500, status: 'posted' },
    { type: 'refund', amountMinor: 1000, status: 'posted' },
    { type: 'transfer', amountMinor: 5000000, status: 'posted' },
    { type: 'expense', amountMinor: 90000, status: 'cancelled' }
  ]), { incomeMinor: 150000, spendingMinor: 25500, transfersMinor: 5000000, feesMinor: 500, refundsMinor: 1000, netMinor: 125500 });
});

test('financial models reject fractional minor units and invalid transfer pairs', async () => {
  const account = new Account({ userId: '507f1f77bcf86cd799439011', name: 'Cash', type: 'cash', currency: 'NGN', openingBalanceMinor: 10.5 });
  assert.ok(account.validateSync().errors.openingBalanceMinor);
  const transaction = new Transaction({ userId: '507f1f77bcf86cd799439011', accountId: '507f1f77bcf86cd799439012', transferToAccountId: '507f1f77bcf86cd799439012', type: 'transfer', amountMinor: 10.2, description: 'Bad transfer', date: new Date() });
  const errors = await transaction.validate().catch(error => error.errors);
  assert.ok(errors.amountMinor);
  assert.ok(errors.transferToAccountId);
});
