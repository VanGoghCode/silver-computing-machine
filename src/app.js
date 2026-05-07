const express = require('express');
const { createHealthRouter } = require('./routes/health');
const { createFilesRouter } = require('./routes/files');
const { createAgentsRouter } = require('./routes/agents');
const { createTasksRouter } = require('./routes/tasks');
const { bearerAuth } = require('./middleware/auth');

function createApp(db, config) {
  const app = express();
  app.use(express.json());

  // Public routes
  app.use(createHealthRouter(config));
  app.use(createFilesRouter(config));

  // Protected routes
  const auth = bearerAuth(db);
  app.use('/api/agents', auth);
  app.use('/api/my-tasks', auth);
  app.use(createAgentsRouter(db));
  app.use(createTasksRouter());

  return app;
}

module.exports = { createApp };
