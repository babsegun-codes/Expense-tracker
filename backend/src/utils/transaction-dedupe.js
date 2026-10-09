const crypto = require('crypto');
module.exports = function transactionDedupeKey({ accountId, type, amountMinor, date, description }) {
  const day = new Date(date).toISOString().slice(0, 10);
  const direction = ['income', 'refund'].includes(type) ? 'credit' : 'debit';
  const normalized = String(description || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(`${accountId}|${day}|${direction}|${amountMinor}|${normalized}`).digest('hex');
};
