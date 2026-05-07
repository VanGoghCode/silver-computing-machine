const express = require('express');
const { createHealthRouter } = require('./routes/health');
const { createFilesRouter } = require('./routes/files');
const { createAgentsRouter } = require('./routes/agents');
const { createTasksRouter } = require('./routes/tasks');
const { createRoleTemplatesRouter } = require('./routes/role_templates');
const { createRoleNodesRouter } = require('./routes/role_nodes');
const { createRoleEdgesRouter } = require('./routes/role_edges');
const { createProblemStatementsRouter } = require('./routes/problem_statements');
const { createAlignmentSessionsRouter } = require('./routes/alignment_sessions');
const { createClarificationRouter } = require('./routes/clarification');
const { createResearchNotesRouter } = require('./routes/research_notes');
const { createAlignmentReviewsRouter } = require('./routes/alignment_reviews');
const { createHumanApprovalsRouter } = require('./routes/human_approvals');
const { createContextArtifactsRouter } = require('./routes/context_artifacts');
const { createDocumentSetsRouter } = require('./routes/document_sets');
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

  // Intake and alignment routes — all authenticated
  app.use(createProblemStatementsRouter(db, auth));
  app.use(createAlignmentSessionsRouter(db, auth));
  app.use(createClarificationRouter(db, auth));
  app.use(createResearchNotesRouter(db, auth));
  app.use(createAlignmentReviewsRouter(db, auth));
  app.use(createHumanApprovalsRouter(db, auth));

  // Context engine routes — all authenticated
  app.use(createContextArtifactsRouter(db, auth));
  app.use(createDocumentSetsRouter(db, auth));

  return app;
}

module.exports = { createApp };
