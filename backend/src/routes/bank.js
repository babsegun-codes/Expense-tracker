const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const authenticate = require('../middleware/auth');
const Account = require('../models/FinancialAccount');
const Transaction = require('../models/FinancialTransaction');
const transactionDedupeKey = require('../utils/transaction-dedupe');

const router = express.Router();
const API = 'https://api.withmono.com';
const key = () => process.env.MONO_SECRET_KEY;
const monoEnvironment = () => {
  const prefixEnvironment = key()?.startsWith('test_sk_') ? 'sandbox' : key()?.startsWith('live_sk_') ? 'production' : null;
  if (!prefixEnvironment || (process.env.MONO_ENVIRONMENT && process.env.MONO_ENVIRONMENT !== prefixEnvironment)) return null;
  return prefixEnvironment;
};
const configured = () => Boolean(key() && monoEnvironment());
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || '')); const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

async function mono(path, options = {}) {
  const response = await fetch(API + path, { ...options, headers: { accept: 'application/json', 'content-type': 'application/json', 'mono-sec-key': key(), ...(options.headers || {}) }, signal: AbortSignal.timeout(20000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(`Mono request failed (${response.status}).`), { status: response.status, retryable: response.status === 429 || response.status >= 500 });
  return data;
}

async function syncAccount(account, { realTime = false } = {}) {
  const id = account.providerAccountId;
  account.connectionStatus = 'syncing'; account.lastSyncError = ''; await account.save();
  try {
    let page = 1; let imported = 0; let hasNext = true; let attempts = 0;
    while (hasNext && page <= 100) {
      let result;
      for (attempts = 0; ; attempts++) {
        try { result = await mono(`/v2/accounts/${encodeURIComponent(id)}/transactions?page=${page}`, { headers: realTime ? { 'x-real-time': 'true' } : {} }); break; }
        catch (error) {
          if (error.status === 429 && attempts < 3) { await new Promise(resolve => setTimeout(resolve, 500 * (2 ** attempts))); continue; }
          throw error;
        }
      }
      const list = Array.isArray(result.data) ? result.data : (Array.isArray(result.transactions) ? result.transactions : []);
      for (const raw of list) {
        const providerId = String(raw.id || raw._id || '');
        const amountMinor = Math.round(Math.abs(Number(raw.amount)));
        const date = new Date(raw.date || raw.created_at);
        if (!providerId || !Number.isSafeInteger(amountMinor) || amountMinor < 1 || Number.isNaN(date.getTime())) continue;
        const debit = String(raw.type || '').toLowerCase() === 'debit';
        const narration = String(raw.narration || raw.description || 'Bank transaction').slice(0, 200);
        const rawCategory = String(raw.category || 'Other');
        const isFee = /fee|charge/i.test(rawCategory) || String(raw.type || '').toLowerCase() === 'fee';
        const isRefund = !debit && /refund|reversal/i.test(rawCategory);
        const category = (isFee ? 'Bank fees' : rawCategory).slice(0, 50);
        try {
          const transaction = { userId: account.userId, accountId: account._id, type: isFee ? 'fee' : isRefund ? 'refund' : debit ? 'expense' : 'income', amountMinor, currency: account.currency, description: narration, category, date, reference: providerId, source: 'bank_import', provider: 'mono', providerTransactionId: providerId, providerMetadata: { balance: raw.balance, rawType: raw.type, syncReview: /transfer|nip|own account/i.test(narration) ? 'Possible own-account transfer; review before categorising.' : '' } };
          transaction.dedupeKey = transactionDedupeKey(transaction);
          await Transaction.create(transaction);
          imported++;
        } catch (error) { if (error.code !== 11000) throw error; }
      }
      const next = result.meta?.next;
      hasNext = Boolean(next) || (result.meta?.total && page * list.length < result.meta.total);
      page++;
    }
    account.connectionStatus = 'connected'; account.lastSyncedAt = new Date(); account.lastSyncError = ''; await account.save();
    return { imported, lastSyncedAt: account.lastSyncedAt };
  } catch (error) {
    account.connectionStatus = 'error'; account.lastSyncError = error.retryable ? 'Temporary provider issue. Retry sync.' : 'Provider could not retrieve transactions. Check account data access.'; await account.save();
    throw error;
  }
}

router.post('/connect', authenticate, async (req, res) => {
  if (!configured()) return res.status(503).json({ message: 'Bank syncing is not configured. Add the Mono server credentials to the backend environment.' });
  const ref = crypto.randomUUID();
  let account;
  try {
    account = await Account.create({ userId: req.user.id, name: 'New bank connection', type: 'bank', currency: 'NGN', provider: 'mono', connectionStatus: 'pending', connectionRef: ref });
    const result = await mono('/v2/accounts/initiate', { method: 'POST', body: JSON.stringify({ customer: { name: String(req.user.email).split('@')[0], email: req.user.email }, meta: { ref }, scope: 'auth', redirect_url: process.env.MONO_REDIRECT_URL || `${req.get('origin') || ''}/?bank=mono&ref=${encodeURIComponent(ref)}` }) });
    const data = result.data || result;
    if (!data.mono_url) throw new Error('Mono did not return an account-linking URL.');
    return res.json({ url: data.mono_url, environment: monoEnvironment() });
  } catch (error) {
    if (account) await Account.deleteOne({ _id: account._id, userId: req.user.id });
    return res.status(502).json({ message: 'Could not start the Mono account-linking flow. Check provider configuration and try again.' });
  }
});

router.post('/sync/:accountId', authenticate, async (req, res) => {
  if (!configured()) return res.status(503).json({ message: 'Bank syncing is not configured.' });
  try {
    const account = await Account.findOne({ _id: req.params.accountId, userId: req.user.id, provider: 'mono', active: true }).select('+providerAccountId');
    if (!account || !account.providerAccountId) return res.status(404).json({ message: 'Connected bank account not found.' });
    const result = await syncAccount(account, { realTime: true });
    return res.json({ ...result, message: `${result.imported} new transactions synchronised.` });
  } catch (error) { return res.status(error.status === 429 ? 429 : 502).json({ message: 'Synchronisation failed. You can retry shortly.' }); }
});

router.delete('/disconnect/:accountId', authenticate, async (req, res) => {
  try {
    const account = await Account.findOne({ _id: req.params.accountId, userId: req.user.id, provider: 'mono', active: true }).select('+providerAccountId');
    if (!account) return res.status(404).json({ message: 'Connected account not found.' });
    if (account.providerAccountId && !configured()) return res.status(503).json({ message: 'Provider credentials are unavailable, so access could not be revoked.' });
    if (account.providerAccountId) {
      await mono(`/v2/accounts/${encodeURIComponent(account.providerAccountId)}/unlink`, { method: 'POST', body: '{}' });
    }
    account.connectionStatus = 'disconnected'; account.active = false; account.providerAccountId = null; account.providerCustomerId = null; await account.save();
    return res.json({ message: 'Provider access was disconnected. Imported history is retained.' });
  } catch { return res.status(502).json({ message: 'The provider could not revoke access. Retry before removing the connection.' }); }
});

router.get('/callback', authenticate, async (req, res) => {
  if (!req.query.code) return res.status(400).json({ message: 'No authorisation code was returned. You can try connecting again.' });
  if (!configured()) return res.status(503).json({ message: 'Mono connection is not configured.' });
  try {
    const result = await mono('/v2/accounts/auth', { method: 'POST', body: JSON.stringify({ code: String(req.query.code) }) });
    const id = result.data?.id || result.id;
    if (!id) return res.status(502).json({ message: 'Mono did not return a connected account.' });
    const detailsResult = await mono(`/v2/accounts/${encodeURIComponent(id)}`);
    const details = detailsResult.data || detailsResult;
    const ref = String(req.query.ref || '');
    const account = await Account.findOne({ userId: req.user.id, connectionRef: ref, provider: 'mono' }).select('+connectionRef');
    if (!account) return res.status(404).json({ message: 'This linking session is no longer available.' });
    await applyMonoAccount(account, id, details.account ? { ...details.account, customer: details.customer?.id, meta: details.meta } : details);
    const sync = account.dataStatus === 'AVAILABLE' || account.dataStatus === 'PARTIAL' ? await syncAccount(account) : null;
    return res.json({ accountId: account.id, dataStatus: account.dataStatus, sync, environment: account.providerEnvironment });
  } catch { return res.status(502).json({ message: 'Mono authorisation could not be completed.' }); }
});

async function applyMonoAccount(account, id, data) {
  account.providerAccountId = id;
  account.providerEnvironment = monoEnvironment() || 'unknown';
  account.providerCustomerId = data.customer || account.providerCustomerId;
  account.name = String(data.institution?.name || data.name || 'Connected bank account').slice(0, 80);
  account.institution = String(data.institution?.name || '').slice(0, 80);
  const accountNumber = data.accountNumber || data.account_number;
  account.accountNumberMasked = accountNumber ? `••••${String(accountNumber).slice(-4)}` : '';
  account.currency = data.currency || 'NGN';
  account.dataStatus = data.meta?.data_status || data.meta?.dataStatus || '';
  account.retrievedData = data.meta?.retrieved_data || data.meta?.retrievedData || [];
  if (data.balance !== undefined && Number.isFinite(Number(data.balance))) { account.providerBalanceMinor = Math.round(Number(data.balance)); account.providerBalanceAt = new Date(); }
  account.connectionStatus = ['AVAILABLE', 'PARTIAL'].includes(account.dataStatus) ? 'connected' : ['FAILED', 'UNAVAILABLE'].includes(account.dataStatus) ? 'error' : 'pending';
  if (account.connectionStatus === 'error') account.lastSyncError = `Provider data status: ${account.dataStatus}.`;
  await account.save();
}

async function webhook(req, res) {
  const secret = process.env.MONO_WEBHOOK_SECRET;
  const received = req.get('mono-webhook-secret');
  if (!secret || !safeEqual(received, secret)) return res.status(401).json({ message: 'Invalid webhook credentials.' });
  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); } catch { return res.status(400).json({ message: 'Invalid webhook payload.' }); }
  try {
    const data = payload.data || {};
    const ref = data.meta?.ref || data.account?.meta?.ref;
    const accountId = data.id || data.account?._id || data.account?.id;
    if (payload.event === 'mono.events.account_connected' && ref && accountId) {
      const account = await Account.findOne({ connectionRef: ref, provider: 'mono' }).select('+connectionRef');
      if (account) {
        account.providerAccountId = accountId; account.providerCustomerId = data.customer || null; account.connectionStatus = 'pending'; await account.save();
      }
    }
    if (payload.event === 'mono.events.account_updated' && accountId) {
      const account = await Account.findOne({ provider: 'mono', providerAccountId: accountId }).select('+providerAccountId');
      if (account) { await applyMonoAccount(account, accountId, data.account ? { ...data.account, customer: data.customer, meta: data.meta } : data); if (['AVAILABLE', 'PARTIAL'].includes(account.dataStatus)) await syncAccount(account); }
    }
    if (payload.event === 'mono.events.account_unlinked' && accountId) {
      await Account.updateOne({ provider: 'mono', providerAccountId: accountId }, { $set: { connectionStatus: 'disconnected', active: false, providerAccountId: null } });
    }
    return res.status(200).json({ received: true });
  } catch { return res.status(500).json({ message: 'Webhook processing failed; provider may retry.' }); }
}

module.exports = { router, webhook, syncAccount };
