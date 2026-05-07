const { generateId } = require('../db/helpers');
const { canMergePr } = require('./permissions');

function createLocalPr(db, data, agentId) {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId);
  if (!agent) throw new Error('Agent not found');
  const projectId = agent.project_id;
  let departmentId = data.department_id || agent.department_id || null;

  if (data.task_id) {
    const task = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?')
      .get(data.task_id, projectId);
    if (!task) throw new Error('Task not found in this project');
    departmentId = task.department_id || departmentId;
  }

  const changedFiles = data.changed_files_json
    ? data.changed_files_json
    : typeof data.changed_files === 'string'
      ? data.changed_files
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const id = generateId();
  db.prepare(
    `INSERT INTO local_prs (id, project_id, department_id, task_id, created_by_agent_id,
     title, summary_md, branch_name, base_branch, changed_files_json, self_review_md, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    projectId,
    departmentId,
    data.task_id || null,
    agentId,
    data.title,
    data.summary_md || null,
    data.branch_name || null,
    data.base_branch || null,
    JSON.stringify(changedFiles),
    data.self_review_md || null,
    'draft',
  );

  return db.prepare('SELECT * FROM local_prs WHERE id = ?').get(id);
}

function listLocalPrs(db, projectId) {
  return db
    .prepare('SELECT * FROM local_prs WHERE project_id = ? ORDER BY created_at DESC')
    .all(projectId);
}

function getLocalPr(db, prId, projectId) {
  return projectId
    ? db.prepare('SELECT * FROM local_prs WHERE id = ? AND project_id = ?').get(prId, projectId)
    : db.prepare('SELECT * FROM local_prs WHERE id = ?').get(prId);
}

function updateLocalPr(db, prId, data, agent) {
  const pr = db
    .prepare('SELECT * FROM local_prs WHERE id = ? AND project_id = ?')
    .get(prId, agent.project_id);
  if (!pr) throw new Error('PR not found');

  if ((data.status === 'merged' || data.merge_status === 'merged') && !canMergePr(db, agent.id)) {
    throw new Error('Agent is not allowed to merge local PRs');
  }

  const allowed = [
    'title',
    'summary_md',
    'branch_name',
    'base_branch',
    'changed_files_json',
    'self_review_md',
    'status',
    'review_status',
    'test_status',
    'merge_status',
  ];
  const updates = [];
  const values = [];

  for (const field of allowed) {
    if (data[field] !== undefined) {
      if (field === 'changed_files_json') {
        updates.push(`${field} = ?`);
        values.push(JSON.stringify(data[field]));
      } else {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    values.push(prId);
    db.prepare(`UPDATE local_prs SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  return db.prepare('SELECT * FROM local_prs WHERE id = ?').get(prId);
}

module.exports = { createLocalPr, listLocalPrs, getLocalPr, updateLocalPr };
