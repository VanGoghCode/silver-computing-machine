const express = require('express');
const path = require('path');
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
const { createMessagesRouter } = require('./routes/messages');
const { createLocalPrsRouter } = require('./routes/local_prs');
const { createModelProfilesRouter } = require('./routes/model_profiles');
const { createPermissionProfilesRouter } = require('./routes/permission_profiles');
const { createProjectsRouter } = require('./routes/projects');
const { createGraphifyRouter } = require('./routes/graphify');
const { createAuditsRouter } = require('./routes/audits');
const { createReportsRouter } = require('./routes/reports');
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
  app.use(createAgentsRouter(db));

  // Task, messaging, and local PR routes — all authenticated
  app.use(createTasksRouter(db, auth));
  app.use(createMessagesRouter(db, auth));
  app.use(createLocalPrsRouter(db, auth));

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

  // Model profiles — all authenticated
  app.use('/api/model-profiles', auth);
  app.use(createModelProfilesRouter(db));

  // Permission profiles — all authenticated
  app.use('/api/permission-profiles', auth);
  app.use(createPermissionProfilesRouter(db));

  // Project management routes — all authenticated
  app.use(createProjectsRouter(db, config, auth));

  // Graphify integration — authenticated
  app.use(createGraphifyRouter(db, config, auth));

  // Audit routes — authenticated
  app.use(createAuditsRouter(db, auth));

  // Report routes — authenticated
  app.use(createReportsRouter(db, auth));

  // Serve frontend dashboard (production)
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  return app;
}

module.exports = { createApp };
