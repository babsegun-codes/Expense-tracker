require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const logger = require('./logger');

async function start(options = {}) {
  const uri = options.uri || process.env.MONGODB_URI;
  const secret = process.env.JWT_SECRET;
  const port = options.port === undefined ? (process.env.PORT || 4500) : options.port;
  const connect = options.connect || mongoose.connect.bind(mongoose);

  if (!uri) throw new Error('MONGODB_URI is not set.');
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');

  try {
    await connect(uri);
  } catch {
    throw new Error('MongoDB connection failed. Check backend configuration and database availability.');
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once('error', reject);
  });
}

if (require.main === module) {
  start()
    .then(() => logger.info('Expense Tracker API is running.'))
    .catch(error => {
      logger.fatal({ err: error }, 'Expense Tracker API failed to start.');
      process.exitCode = 1;
    });
}

module.exports = { app, start };
