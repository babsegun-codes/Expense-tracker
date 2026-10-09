function transactionEffects(transaction) {
  if (transaction.status && transaction.status !== 'posted') return [];
  const type = transaction.type;
  const amount = transaction.amountMinor;
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new TypeError('Transactions use positive integer minor units.');
  if (type === 'income' || type === 'refund') return [[String(transaction.accountId), amount]];
  if (type === 'transfer') return [[String(transaction.accountId), -amount], [String(transaction.transferToAccountId), amount]];
  if (type === 'expense' || type === 'fee') return [[String(transaction.accountId), -amount]];
  throw new TypeError('Unknown transaction type.');
}

function summarizeTransactions(transactions) {
  const totals = { incomeMinor: 0, spendingMinor: 0, transfersMinor: 0, feesMinor: 0, refundsMinor: 0 };
  for (const tx of transactions) {
    if (tx.status && tx.status !== 'posted') continue;
    if (!Number.isSafeInteger(tx.amountMinor) || tx.amountMinor < 1) throw new TypeError('Transactions use positive integer minor units.');
    if (tx.type === 'income') totals.incomeMinor += tx.amountMinor;
    if (tx.type === 'expense') totals.spendingMinor += tx.amountMinor;
    if (tx.type === 'fee') { totals.spendingMinor += tx.amountMinor; totals.feesMinor += tx.amountMinor; }
    if (tx.type === 'refund') totals.refundsMinor += tx.amountMinor;
    if (tx.type === 'transfer') totals.transfersMinor += tx.amountMinor;
  }
  return { ...totals, netMinor: totals.incomeMinor + totals.refundsMinor - totals.spendingMinor };
}

module.exports = { transactionEffects, summarizeTransactions };
