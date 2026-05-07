const express = require('express');
const { createHealthRouter } = require('./routes/health');
const { createFilesRouter } = require('./routes/files');
const { createAgentsRouter } = require('./routes/agents');
const { createTasksRouter } = require('./routes/tasks');
const { createRoleTemplatesRouter } = require('./routes/role_templates');
const { createRoleNodesRouter } = require('./routes/role_nodes');
const { createRoleEdgesRouter } = require('./routes/role_edges');
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

  // Role system routes — all authenticated
  app.use(createRoleTemplatesRouter(db, auth));
  app.use(createRoleNodesRouter(db, auth));
  app.use(createRoleEdgesRouter(db, auth));

  return app;
}

module.exports = { createApp };
