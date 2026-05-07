const crypto = require('crypto');

function findAgentByTokenHash(db, tokenHash) {
  const agent = db
    .prepare(
      `SELECT a.*, p.root_path as project_root_path, p.slug as project_slug,
              d.key as department_key, rt.key as role_key, rt.display_name as role_display_name
       FROM agents a
       JOIN projects p ON p.id = a.project_id
       JOIN departments d ON d.id = a.department_id
       JOIN project_role_instances pri ON pri.id = a.role_instance_id
       JOIN role_templates rt ON rt.id = pri.role_template_id
       WHERE a.token_hash = ?`,
    )
    .get(tokenHash);

  return agent || null;
}

function updateHeartbeat(db, agentId, status, currentTaskId, payloadJson) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO agent_heartbeats (id, agent_id, status, current_task_id, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(crypto.randomUUID(), agentId, status, currentTaskId || null, payloadJson || '{}', now);

  db.prepare(
    `UPDATE agents SET last_heartbeat_at = ?, worker_status = ?, updated_at = ? WHERE id = ?`,
  ).run(now, status, now, agentId);
}

module.exports = { findAgentByTokenHash, updateHeartbeat };
