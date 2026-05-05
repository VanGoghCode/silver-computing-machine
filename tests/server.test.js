const request = require('supertest');
const express = require('express');

// Create a minimal app for testing (avoids binding to a port)
function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  return app;
}

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
  });
});
