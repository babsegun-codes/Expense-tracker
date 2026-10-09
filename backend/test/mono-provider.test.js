const test = require('node:test');
const assert = require('node:assert/strict');
const Transaction = require('../src/models/FinancialTransaction');
const { syncAccount, webhook } = require('../src/routes/bank');
const transactionDedupeKey = require('../src/utils/transaction-dedupe');

test('Mono API contract pagination ignores duplicate provider transaction IDs', async t => {
  const originalFetch = global.fetch;
  const originalCreate = Transaction.create;
  const oldKey = process.env.MONO_SECRET_KEY;
  process.env.MONO_SECRET_KEY = 'test_sandbox_key';
  let pages = 0; const imported = new Map();
  global.fetch = async url => {
    pages++;
    const page = new URL(url).searchParams.get('page');
    const data = page === '1'
      ? [{ id: 'mono-tx-1', amount: 12500, type: 'debit', date: '2026-10-01', narration: 'Market' }]
      : [{ id: 'mono-tx-1', amount: 12500, type: 'debit', date: '2026-10-01', narration: 'Market' }, { id: 'mono-tx-2', amount: 50000, type: 'credit', date: '2026-10-02', narration: 'Salary' }];
    return { ok: true, json: async () => ({ data, meta: { total: 2, next: page === '1' ? 'next' : null } }) };
  };
  Transaction.create = async fields => {
    if (imported.has(fields.providerTransactionId)) { const error = new Error('duplicate'); error.code = 11000; throw error; }
    imported.set(fields.providerTransactionId, fields); return fields;
  };
  const account = { _id: '507f1f77bcf86cd799439011', userId: '507f1f77bcf86cd799439012', providerAccountId: 'mono-account', currency: 'NGN', save: async () => {} };
  t.after(() => { global.fetch = originalFetch; Transaction.create = originalCreate; if (oldKey === undefined) delete process.env.MONO_SECRET_KEY; else process.env.MONO_SECRET_KEY = oldKey; });
  const result = await syncAccount(account);
  assert.equal(pages, 2);
  assert.equal(result.imported, 2);
  assert.equal(imported.size, 2);
  assert.equal(imported.get('mono-tx-1').amountMinor, 12500);
  assert.equal(imported.get('mono-tx-2').type, 'income');
});

test('Mono webhook rejects an invalid secret and accepts a verified event', async () => {
  const oldSecret = process.env.MONO_WEBHOOK_SECRET;
  process.env.MONO_WEBHOOK_SECRET = 'sandbox-webhook-test-secret';
  const invoke = async secret => {
    const req = { body: Buffer.from(JSON.stringify({ event: 'mono.events.unknown', event_id: 'evt-test', data: {} })), get: name => name === 'mono-webhook-secret' ? secret : undefined };
    const res = { code: 200, status(value) { this.code = value; return this; }, json(value) { this.value = value; return this; } };
    await webhook(req, res); return res;
  };
  try {
    assert.equal((await invoke('wrong')).code, 401);
    const accepted = await invoke('sandbox-webhook-test-secret');
    assert.equal(accepted.code, 200);
    assert.equal(accepted.value.received, true);
  } finally { if (oldSecret === undefined) delete process.env.MONO_WEBHOOK_SECRET; else process.env.MONO_WEBHOOK_SECRET = oldSecret; }
});

test('Mono sync backs off on a provider rate limit and surfaces recoverable status', async t => {
  const originalFetch = global.fetch; const oldKey = process.env.MONO_SECRET_KEY;
  process.env.MONO_SECRET_KEY = 'test_sk_sandbox';
  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, json: async () => ({ data: [], meta: { total: 0, next: null } }) };
  };
  t.after(() => { global.fetch = originalFetch; if (oldKey === undefined) delete process.env.MONO_SECRET_KEY; else process.env.MONO_SECRET_KEY = oldKey; });
  const account = { _id: '507f1f77bcf86cd799439013', userId: '507f1f77bcf86cd799439014', providerAccountId: 'mono-rate-limited', currency: 'NGN', save: async () => {} };
  const result = await syncAccount(account);
  assert.equal(calls, 2);
  assert.equal(result.imported, 0);
  assert.equal(account.connectionStatus, 'connected');
});

test('statement duplicate fingerprints are stable across harmless case and whitespace changes', () => {
  const base = { accountId: 'a', type: 'expense', amountMinor: 15000, date: '2026-10-04', description: '  Grocery   Shop ' };
  assert.equal(transactionDedupeKey(base), transactionDedupeKey({ ...base, description: 'grocery shop' }));
  assert.notEqual(transactionDedupeKey(base), transactionDedupeKey({ ...base, accountId: 'b' }));
});
