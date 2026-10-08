const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-32-chars';
const { start } = require('../src/server');
const User = require('../src/models/User');
const Expense = require('../src/models/Expense');

const users = new Map();
const expenses = new Map();
let server;
let baseUrl;

function makeId() {
  return new mongoose.Types.ObjectId().toString();
}

function installModelFakes() {
  User.create = async ({ email, passwordHash }) => {
    if ([...users.values()].some(user => user.email === email)) {
      const error = new Error('duplicate key');
      error.code = 11000;
      throw error;
    }
    const user = { _id: makeId(), email, passwordHash };
    users.set(user._id, user);
    return user;
  };
  User.findOne = filter => ({
    select: async () => [...users.values()].find(user => user.email === filter.email) || null
  });
  User.findById = async id => users.get(String(id)) || null;

  Expense.create = async fields => {
    const expense = { _id: makeId(), ...fields, createdAt: new Date(), updatedAt: new Date() };
    expenses.set(expense._id, expense);
    return expense;
  };
  Expense.find = filter => ({
    sort: async () => [...expenses.values()]
      .filter(expense => expense.userId === String(filter.userId))
      .sort((a, b) => b.date - a.date || b.createdAt - a.createdAt)
  });
  Expense.findOneAndUpdate = async (filter, update) => {
    const expense = expenses.get(String(filter._id));
    if (!expense || expense.userId !== String(filter.userId)) return null;
    Object.assign(expense, update.$set, { updatedAt: new Date() });
    return expense;
  };
  Expense.findOneAndDelete = async filter => {
    const expense = expenses.get(String(filter._id));
    if (!expense || expense.userId !== String(filter.userId)) return null;
    expenses.delete(expense._id);
    return expense;
  };
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, body: await response.json() };
}

test('multi-user authentication and expense ownership', async t => {
  process.env.MONGODB_URI = 'mongodb://test.invalid/expense-tracker';
  server = await start({ uri: process.env.MONGODB_URI, port: 0, connect: async () => {} });
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  t.after(async () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  installModelFakes();

  await t.test('backend starts and responds over HTTP', async () => {
    assert.equal(server.listening, true);
    const result = await request('/health');
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'ok');
  });

  let aliceToken;
  let aliceId;
  let expenseId;

  await t.test('registration hashes the password and returns no password fields', async () => {
    const result = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'alice@example.test', password: 'correct-horse-battery-1' }
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.user.email, 'alice@example.test');
    assert.equal(Object.hasOwn(result.body, 'password'), false);
    assert.equal(Object.hasOwn(result.body.user, 'password'), false);
    assert.equal(Object.hasOwn(result.body.user, 'passwordHash'), false);

    const storedUser = [...users.values()].find(user => user.email === 'alice@example.test');
    assert.ok(storedUser.passwordHash);
    assert.notEqual(storedUser.passwordHash, 'correct-horse-battery-1');
    assert.equal(await bcrypt.compare('correct-horse-battery-1', storedUser.passwordHash), true);

    aliceToken = result.body.token;
    const payload = jwt.verify(aliceToken, process.env.JWT_SECRET);
    aliceId = payload.sub;
    assert.equal(aliceId, storedUser._id);
  });

  await t.test('duplicate registration and invalid login are rejected', async () => {
    const duplicate = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'alice@example.test', password: 'another-correct-password' }
    });
    assert.equal(duplicate.status, 409);

    const tooLong = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'long@example.test', password: 'x'.repeat(73) }
    });
    assert.equal(tooLong.status, 400);

    const invalid = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'alice@example.test', password: 'incorrect-password' }
    });
    assert.equal(invalid.status, 401);
  });

  await t.test('login returns a valid JWT and /me accepts it', async () => {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'alice@example.test', password: 'correct-horse-battery-1' }
    });
    assert.equal(result.status, 200);
    assert.equal(jwt.verify(result.body.token, process.env.JWT_SECRET).sub, aliceId);
    assert.equal(Object.hasOwn(result.body.user, 'passwordHash'), false);

    const me = await request('/api/auth/me', { token: result.body.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.id, aliceId);
    assert.equal(Object.hasOwn(me.body.user, 'passwordHash'), false);
    aliceToken = result.body.token;
  });

  await t.test('expense routes reject unauthenticated requests', async () => {
    assert.equal((await request('/api/expenses')).status, 401);
    assert.equal((await request('/api/expenses', { method: 'POST', body: {} })).status, 401);
    assert.equal((await request('/api/expenses/000000000000000000000001', { method: 'PUT', body: {} })).status, 401);
    assert.equal((await request('/api/expenses/000000000000000000000001', { method: 'DELETE' })).status, 401);
  });

  await t.test('owner can create and retrieve expenses; client cannot spoof ownership', async () => {
    const created = await request('/api/expenses', {
      method: 'POST',
      token: aliceToken,
      body: {
        title: 'Groceries', amount: 25, category: 'Food', date: '2026-10-08',
        description: 'Weekly shop', userId: makeId()
      }
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.userId, aliceId);
    expenseId = created.body._id;

    const listing = await request('/api/expenses', { token: aliceToken });
    assert.equal(listing.status, 200);
    assert.equal(listing.body.length, 1);
    assert.equal(listing.body[0]._id, expenseId);
  });

  let bobToken;
  await t.test('another user cannot read, update, or delete the owner’s expense', async () => {
    const registered = await request('/api/auth/register', {
      method: 'POST',
      body: { email: 'bob@example.test', password: 'another-correct-password' }
    });
    assert.equal(registered.status, 201);
    bobToken = registered.body.token;

    const bobListing = await request('/api/expenses', { token: bobToken });
    assert.equal(bobListing.status, 200);
    assert.deepEqual(bobListing.body, []);

    const update = await request('/api/expenses/' + expenseId, {
      method: 'PUT',
      token: bobToken,
      body: { title: 'Stolen', amount: 1, category: 'Other', date: '2026-10-08' }
    });
    assert.equal(update.status, 404);

    const deletion = await request('/api/expenses/' + expenseId, {
      method: 'DELETE',
      token: bobToken
    });
    assert.equal(deletion.status, 404);
    assert.ok(expenses.has(expenseId));
  });

  await t.test('owner can update and delete their expense', async () => {
    const update = await request('/api/expenses/' + expenseId, {
      method: 'PUT',
      token: aliceToken,
      body: { title: 'Updated groceries', amount: 31.5, category: 'Food', date: '2026-10-08' }
    });
    assert.equal(update.status, 200);
    assert.equal(update.body.title, 'Updated groceries');
    assert.equal(update.body.amount, 31.5);

    const deletion = await request('/api/expenses/' + expenseId, {
      method: 'DELETE',
      token: aliceToken
    });
    assert.equal(deletion.status, 200);
    assert.equal(expenses.has(expenseId), false);
  });
});
