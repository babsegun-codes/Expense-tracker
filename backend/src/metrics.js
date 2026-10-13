const {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics
} = require('@prometheus-io/client');

const registry = new Registry();

registry.setDefaultLabels({
  service: 'expense-tracker-backend',
  environment: process.env.NODE_ENV || 'development'
});

collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests handled by the backend.',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry]
});

const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests handled by the backend in seconds.',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry]
});

module.exports = {
  registry,
  httpRequestsTotal,
  httpRequestDurationSeconds
};
