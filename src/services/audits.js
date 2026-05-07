const { generateId, withTransaction } = require('../db/helpers');

function createAuditRun(db, projectId, agentId, departmentId) {
  const id = generateId();
  const reportContent = generateAuditReportContent(db, projectId);

  const artifactId = withTransaction(db, () => {
    db.prepare(
      `INSERT INTO audit_runs (id, project_id, department_id, audit_agent_id, status)
       VALUES (?, ?, ?, ?, 'running')`,
    ).run(id, projectId, departmentId || null, agentId || null);

    // Create the audit report as a context artifact
    const aId = generateId();
    db.prepare(
      `INSERT INTO context_artifacts
       (id, project_id, department_id, artifact_type, title, content_md, author_agent_id, version, status, lifecycle_stage, visibility_scope, is_archived)
       VALUES (?, ?, ?, 'audit_report', ?, ?, ?, 1, 'draft', 'mvp', 'project', 0)`,
    ).run(
      aId,
      projectId,
      departmentId || null,
      `Weekly Audit Report - ${new Date().toISOString().split('T')[0]}`,
      reportContent,
      agentId || null,
    );

    // Store initial revision
    const revisionId = generateId();
    db.prepare(
      `INSERT INTO context_revisions (id, artifact_id, version, content_md, change_summary_md, created_by_agent_id)
       VALUES (?, ?, 1, ?, 'Initial audit report', ?)`,
    ).run(revisionId, aId, reportContent, agentId || null);

    // Update audit run with artifact id and mark completed
    db.prepare(
      `UPDATE audit_runs SET status = 'completed', report_artifact_id = ?, finished_at = datetime('now') WHERE id = ?`,
    ).run(aId, id);

    return aId;
  });

  // Try to notify Tech Lead (outside transaction - non-critical)
  notifyTechLead(db, projectId, agentId, artifactId);

  return db.prepare('SELECT * FROM audit_runs WHERE id = ?').get(id);
}

function generateAuditReportContent(db, projectId) {
  const sections = [];

  // Count tasks by status
  const tasks = db
    .prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status`)
    .all(projectId);

  sections.push(`## Task Summary`);
  if (tasks.length === 0) {
    sections.push('No tasks found for this project.');
  } else {
    for (const t of tasks) {
      sections.push(`- ${t.status}: ${t.count}`);
    }
  }

  // Count agents
  const agents = db
    .prepare('SELECT COUNT(*) as count FROM agents WHERE project_id = ?')
    .get(projectId);
  sections.push(`\n## Agent Count: ${agents.count}`);

  // Count context artifacts
  const artifacts = db
    .prepare('SELECT COUNT(*) as count FROM context_artifacts WHERE project_id = ?')
    .get(projectId);
  sections.push(`\n## Context Artifacts: ${artifacts.count}`);

  sections.push(`\n## Generated: ${new Date().toISOString()}`);
  sections.push(`\n*This is an automated weekly audit report.*`);

  return sections.join('\n');
}

function notifyTechLead(db, projectId, fromAgentId, artifactId) {
  // Find tech-lead role instance in the project
  const techLead = db
    .prepare(
      `SELECT pri.id, a.id as agent_id
       FROM project_role_instances pri
       JOIN role_templates rt ON pri.role_template_id = rt.id
       LEFT JOIN agents a ON a.role_instance_id = pri.id AND a.project_id = ?
       WHERE pri.project_id = ? AND rt.key = 'tech-lead'
       LIMIT 1`,
    )
    .get(projectId, projectId);

  if (!techLead) return;

  // Find or create a conversation
  const conversationId = generateId();
  db.prepare(
    `INSERT INTO conversations (id, project_id, title) VALUES (?, ?, 'Weekly Audit Notification')`,
  ).run(conversationId, projectId);

  // Send message to tech lead
  const messageId = generateId();
  db.prepare(
    `INSERT INTO messages (id, conversation_id, project_id, from_agent_id, to_agent_id, content_md, message_type)
     VALUES (?, ?, ?, ?, ?, ?, 'notification')`,
  ).run(
    messageId,
    conversationId,
    projectId,
    fromAgentId || null,
    techLead.agent_id || null,
    `Weekly audit report has been generated. Artifact ID: ${artifactId}`,
  );
}

function listAuditRuns(db, projectId) {
  return db
    .prepare('SELECT * FROM audit_runs WHERE project_id = ? ORDER BY started_at DESC')
    .all(projectId);
}

module.exports = { createAuditRun, listAuditRuns };
