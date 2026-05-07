const fs = require('fs');
const path = require('path');
const { generateId, withTransaction } = require('../db/helpers');
const { generateToken, hashToken } = require('../utils/tokens');

const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

const DEFAULT_DEPARTMENTS = [{ key: 'core', display_name: 'Core' }];

/**
 * Create a full project: row, folder, departments, role instances, edges,
 * optional agents, initial document set.
 */
function createProject(db, config, data) {
  const { name, slug, create_agents } = data;

  if (!name || !slug) {
    throw new Error('name and slug are required');
  }

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      'Invalid slug. Only alphanumeric characters, hyphens, and underscores allowed.',
    );
  }

  // Check for duplicate slug
  const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(slug);
  if (existing) {
    const err = new Error(`Project with slug '${slug}' already exists`);
    err.code = 'DUPLICATE_SLUG';
    throw err;
  }

  const projectId = generateId();
  const projectsDir = config.projectsDir || path.join(config.workspaceDir, 'Projects');
  const rootPath = path.join(projectsDir, slug);

  // Verify path stays within projectsDir
  const resolvedRoot = path.resolve(projectsDir);
  const resolvedPath = path.resolve(rootPath);
  if (!resolvedPath.startsWith(resolvedRoot + path.sep) && resolvedPath !== resolvedRoot) {
    throw new Error('Invalid slug — path escapes projects directory');
  }

  const now = new Date().toISOString();

  // Run all DB operations in a transaction
  const {
    project: createdProject,
    departments,
    instances,
    templates,
  } = withTransaction(db, () => {
    // Create project row
    db.prepare(
      `INSERT INTO projects (id, name, slug, root_path, status, current_phase, runtime_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', 'discovery', 'stopped', ?, ?)`,
    ).run(projectId, name, slug, rootPath, now, now);

    // Create departments
    const depts = [];
    for (const dept of DEFAULT_DEPARTMENTS) {
      const deptId = generateId();
      db.prepare(
        `INSERT INTO departments (id, project_id, key, display_name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(deptId, projectId, dept.key, dept.display_name, now, now);
      depts.push({ id: deptId, ...dept });
    }

    const coreDept = depts[0];

    // Create role instances from templates
    const tmpls = db.prepare('SELECT * FROM role_templates').all();
    const insts = {};

    for (const tmpl of tmpls) {
      const instanceId = generateId();
      db.prepare(
        `INSERT INTO project_role_instances (id, project_id, department_id, role_template_id, display_name, model_profile_id, permission_profile_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        instanceId,
        projectId,
        coreDept.id,
        tmpl.id,
        tmpl.display_name,
        tmpl.default_model_profile_id,
        tmpl.default_permission_profile_id,
        now,
        now,
      );
      insts[tmpl.key] = instanceId;
    }

    // Create default role edges using the default_role_edges seed logic
    const defaultRoleEdges = require('../seeds/default_role_edges');
    defaultRoleEdges.run(db, projectId, coreDept.id);

    // Create initial discovery document set
    const docSetId = generateId();
    db.prepare(
      `INSERT INTO document_sets (id, project_id, name, stage, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(docSetId, projectId, 'Discovery Documents', 'discovery', 'draft', now, now);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    return { project, departments: depts, instances: insts, templates: tmpls };
  });

  // Create project folder only after transaction succeeds
  fs.mkdirSync(rootPath, { recursive: true });

  // Optionally create agents (also in a transaction)
  let tokens = [];
  if (create_agents) {
    tokens = createDefaultAgents(db, projectId, departments[0].id, instances, templates);
  }
  return { project: createdProject, tokens };
}

function createDefaultAgents(db, projectId, departmentId, instances, templates) {
  const tokens = [];
  for (const tmpl of templates) {
    const instanceId = instances[tmpl.key];
    if (!instanceId) continue;

    const plainToken = generateToken();
    const tokenHash = hashToken(plainToken);
    const agentId = generateId();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO agents (id, project_id, department_id, role_instance_id, name, token_hash, status, worker_status, model_profile_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 'idle', ?, ?, ?)`,
    ).run(
      agentId,
      projectId,
      departmentId,
      instanceId,
      tmpl.display_name,
      tokenHash,
      tmpl.default_model_profile_id,
      now,
      now,
    );

    tokens.push({
      agent_id: agentId,
      agent_name: tmpl.display_name,
      role_key: tmpl.key,
      token: plainToken,
    });
  }
  return tokens;
}

module.exports = { createProject, createDefaultAgents, SLUG_PATTERN };
