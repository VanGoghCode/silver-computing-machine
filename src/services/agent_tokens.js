const { generateId } = require('../db/helpers');
const { generateToken, hashToken } = require('../utils/tokens');

/**
 * Create a new agent with a generated token.
 * Returns { agent, token } — plain token shown only once.
 */
function createAgent(db, data) {
  // Validate FK references exist
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(data.project_id);
  if (!project) {
    const err = new Error(`Project not found: ${data.project_id}`);
    err.code = 'INVALID_REF';
    throw err;
  }

  const dept = db
    .prepare('SELECT id FROM departments WHERE id = ? AND project_id = ?')
    .get(data.department_id, data.project_id);
  if (!dept) {
    const err = new Error(
      `Department not found or does not belong to project: ${data.department_id}`,
    );
    err.code = 'INVALID_REF';
    throw err;
  }

  const roleInstance = db
    .prepare('SELECT id FROM project_role_instances WHERE id = ? AND project_id = ?')
    .get(data.role_instance_id, data.project_id);
  if (!roleInstance) {
    const err = new Error(
      `Role instance not found or does not belong to project: ${data.role_instance_id}`,
    );
    err.code = 'INVALID_REF';
    throw err;
  }

  const id = generateId();
  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO agents (id, project_id, department_id, role_instance_id, name, token_hash, status, worker_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 'idle', ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.department_id,
    data.role_instance_id,
    data.name,
    tokenHash,
    now,
    now,
  );

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  return { agent, token: plainToken };
}

/**
 * Rotate an agent's token. Invalidates the old token immediately.
 */
function rotateAgentToken(db, agentId) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return null;
  if (agent.status === 'revoked') {
    const err = new Error('Cannot rotate token for a revoked agent');
    err.code = 'AGENT_REVOKED';
    throw err;
  }

  const plainToken = generateToken();
  const tokenHash = hashToken(plainToken);
  const now = new Date().toISOString();

  db.prepare('UPDATE agents SET token_hash = ?, updated_at = ? WHERE id = ?').run(
    tokenHash,
    now,
    agentId,
  );

  return plainToken;
}

/**
 * Revoke an agent — sets status to revoked, token no longer valid.
 */
function revokeAgent(db, agentId) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) return null;

  const now = new Date().toISOString();
  db.prepare("UPDATE agents SET status = 'revoked', updated_at = ? WHERE id = ?").run(now, agentId);

  return true;
}

/**
 * List agents for a project (or all). Never returns token_hash.
 */
function listAgents(db, projectId) {
  const query = projectId
    ? `SELECT id, project_id, department_id, role_instance_id, name, status, worker_status, model_profile_id, last_heartbeat_at, created_at, updated_at
       FROM agents WHERE project_id = ?`
    : `SELECT id, project_id, department_id, role_instance_id, name, status, worker_status, model_profile_id, last_heartbeat_at, created_at, updated_at
       FROM agents`;

  const agents = projectId ? db.prepare(query).all(projectId) : db.prepare(query).all();
  return agents;
}

/**
 * Get a single agent by ID. Never returns token_hash.
 */
function getAgent(db, agentId) {
  return db
    .prepare(
      `SELECT id, project_id, department_id, role_instance_id, name, status, worker_status, model_profile_id, last_heartbeat_at, created_at, updated_at
       FROM agents WHERE id = ?`,
    )
    .get(agentId);
}

module.exports = { createAgent, rotateAgentToken, revokeAgent, listAgents, getAgent };
