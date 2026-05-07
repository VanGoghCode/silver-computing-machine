const { generateId } = require('../db/helpers');

function createLocalPr(db, data, agentId) {
  const id = generateId();
  db.prepare(
    `INSERT INTO local_prs (id, project_id, department_id, task_id, created_by_agent_id,
     title, summary_md, branch_name, base_branch, changed_files_json, self_review_md, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    data.project_id,
    data.department_id || null,
    data.task_id || null,
    agentId,
    data.title,
    data.summary_md || null,
    data.branch_name || null,
    data.base_branch || null,
    JSON.stringify(data.changed_files_json || []),
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

function getLocalPr(db, prId) {
  return db.prepare('SELECT * FROM local_prs WHERE id = ?').get(prId);
}

function updateLocalPr(db, prId, data) {
  const pr = db.prepare('SELECT * FROM local_prs WHERE id = ?').get(prId);
  if (!pr) throw new Error('PR not found');

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
