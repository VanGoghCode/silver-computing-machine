const Database = require('better-sqlite3');
const { runMigrations } = require('../src/db/migrate');
const { runSeeds } = require('../src/db/seed');
const { createApp } = require('../src/app');
const { loadConfig } = require('../src/config');
const { generateToken, hashToken } = require('../src/utils/tokens');
const { generateId } = require('../src/db/helpers');

const migrations = [
  require('../src/migrations/001_projects'),
  require('../src/migrations/002_humans'),
  require('../src/migrations/003_departments'),
  require('../src/migrations/004_model_profiles'),
  require('../src/migrations/005_permission_profiles'),
  require('../src/migrations/006_role_templates'),
  require('../src/migrations/007_role_prompt_files'),
  require('../src/migrations/008_project_role_instances'),
  require('../src/migrations/009_role_edges'),
  require('../src/migrations/010_agents'),
  require('../src/migrations/011_agent_heartbeats'),
  require('../src/migrations/012_alignment_intake'),
  require('../src/migrations/013_context_artifacts'),
  require('../src/migrations/014_tasks'),
  require('../src/migrations/015_conversations'),
  require('../src/migrations/016_local_prs'),
  require('../src/migrations/017_runtime_status'),
  require('../src/migrations/018_graphify_runs'),
  require('../src/migrations/019_audit_runs'),
];

const seeds = [
  require('../src/seeds/model_profiles'),
  require('../src/seeds/permission_profiles'),
  require('../src/seeds/role_templates'),
  require('../src/seeds/human_local_owner'),
];

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, migrations);
  return db;
}

function createSeededTestDb() {
  const db = createTestDb();
  runSeeds(db, seeds);
  return db;
}

function createTestApp(db, overrides = {}) {
  const config = { ...loadConfig(), ...overrides };
  return createApp(db, config);
}

/**
 * Insert a minimal agent record and return { token, agent }.
 * Creates project, department, role instance, and agent.
 */
function insertTestAgent(db, overrides = {}) {
  const projectId = overrides.project_id || generateId();
  const departmentId = overrides.department_id || generateId();
  const roleInstanceId = overrides.role_instance_id || generateId();
  const agentId = overrides.agent_id || generateId();

  db.prepare(
    `INSERT OR IGNORE INTO projects (id, name, slug, root_path, status) VALUES (?, ?, ?, ?, ?)`,
  ).run(
    projectId,
    overrides.project_name || 'Test Project',
    overrides.project_slug || 'test-project',
    overrides.project_root || '/workspace/Projects/test-project',
    'active',
  );

  // Get a role template id (use engineer by default), or create one if none exist
  let roleTemplate = db
    .prepare(`SELECT id FROM role_templates WHERE key = ?`)
    .get(overrides.role_key || 'engineer');

  if (!roleTemplate) {
    const rtId = generateId();
    db.prepare(
      `INSERT INTO role_templates (id, key, display_name, description) VALUES (?, ?, ?, ?)`,
    ).run(rtId, overrides.role_key || 'engineer', 'Engineer', 'Test engineer role');
    roleTemplate = { id: rtId };
  }

  db.prepare(
    `INSERT OR IGNORE INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)`,
  ).run(departmentId, projectId, overrides.dept_key || 'backend', 'Backend');

  db.prepare(
    `INSERT OR IGNORE INTO project_role_instances (id, project_id, department_id, role_template_id, display_name) VALUES (?, ?, ?, ?, ?)`,
  ).run(roleInstanceId, projectId, departmentId, roleTemplate.id, 'Test Engineer');

  const token = generateToken();
  const tokenHash = hashToken(token);

  db.prepare(
    `INSERT INTO agents (id, project_id, department_id, role_instance_id, name, token_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    agentId,
    projectId,
    departmentId,
    roleInstanceId,
    overrides.agent_name || 'Test Agent',
    tokenHash,
    'active',
  );

  return { token, agentId, projectId, departmentId };
}

module.exports = { createTestDb, createSeededTestDb, createTestApp, insertTestAgent };
