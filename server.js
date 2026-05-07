require('dotenv').config();

const { loadConfig } = require('./src/config');
const { createDatabase, closeDatabase } = require('./src/db');
const { runMigrations } = require('./src/db/migrate');
const { runSeeds } = require('./src/db/seed');
const { createApp } = require('./src/app');

// Collect all migrations
const migrations = [
  require('./src/migrations/001_projects'),
  require('./src/migrations/002_humans'),
  require('./src/migrations/003_departments'),
  require('./src/migrations/004_model_profiles'),
  require('./src/migrations/005_permission_profiles'),
  require('./src/migrations/006_role_templates'),
  require('./src/migrations/007_role_prompt_files'),
  require('./src/migrations/008_project_role_instances'),
  require('./src/migrations/009_role_edges'),
  require('./src/migrations/010_agents'),
  require('./src/migrations/011_agent_heartbeats'),
  require('./src/migrations/012_alignment_intake'),
];

// Collect all seeds
const seeds = [
  require('./src/seeds/model_profiles'),
  require('./src/seeds/permission_profiles'),
  require('./src/seeds/role_templates'),
  require('./src/seeds/human_local_owner'),
];

const config = loadConfig();
const db = createDatabase(config.dbPath);

runMigrations(db, migrations);
runSeeds(db, seeds);

const app = createApp(db, config);

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`Silver Gatekeeper running at http://localhost:${config.port}`);
  console.log(`Workspace dir: ${config.workspaceDir}`);
  console.log(`Projects dir: ${config.projectsDir}`);
  console.log(`Database: ${config.dbPath}`);
});

process.on('SIGTERM', () => {
  server.close(() => closeDatabase());
});

process.on('SIGINT', () => {
  server.close(() => closeDatabase());
});

module.exports = { app, db, config };
