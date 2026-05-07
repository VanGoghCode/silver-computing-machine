const { generateId } = require('../db/helpers');

function createDailyReport(db, projectId, agentId) {
  const content = generateDailyReportContent(db, projectId);

  const id = generateId();
  const today = new Date().toISOString().split('T')[0];

  db.prepare(
    `INSERT INTO context_artifacts
     (id, project_id, artifact_type, title, content_md, author_agent_id, version, status, lifecycle_stage, visibility_scope, is_archived)
     VALUES (?, ?, 'daily_report', ?, ?, ?, 1, 'draft', 'mvp', 'project', 0)`,
  ).run(id, projectId, `Daily Report - ${today}`, content, agentId || null);

  // Store initial revision
  const revisionId = generateId();
  db.prepare(
    `INSERT INTO context_revisions (id, artifact_id, version, content_md, change_summary_md, created_by_agent_id)
     VALUES (?, ?, 1, ?, 'Initial daily report', ?)`,
  ).run(revisionId, id, content, agentId || null);

  return db.prepare('SELECT * FROM context_artifacts WHERE id = ?').get(id);
}

function generateDailyReportContent(db, projectId) {
  const sections = [];
  const today = new Date().toISOString().split('T')[0];

  sections.push(`# Daily Report - ${today}\n`);

  // Yesterday completed
  sections.push(`## Yesterday Completed`);
  const completedTasks = db
    .prepare(`SELECT title, status FROM tasks WHERE project_id = ? AND status = 'done'`)
    .all(projectId);
  if (completedTasks.length === 0) {
    sections.push('- No tasks completed.');
  } else {
    for (const t of completedTasks) {
      sections.push(`- ${t.title}`);
    }
  }

  // Today planned
  sections.push(`\n## Today Planned`);
  const plannedTasks = db
    .prepare(
      `SELECT title, status FROM tasks WHERE project_id = ? AND status IN ('ready', 'assigned', 'backlog')`,
    )
    .all(projectId);
  if (plannedTasks.length === 0) {
    sections.push('- No tasks planned.');
  } else {
    for (const t of plannedTasks) {
      sections.push(`- [${t.status}] ${t.title}`);
    }
  }

  // Blockers
  sections.push(`\n## Blockers`);
  const blockers = db
    .prepare(`SELECT content_md FROM messages WHERE project_id = ? AND message_type = 'blocker'`)
    .all(projectId);
  if (blockers.length === 0) {
    sections.push('- No blockers reported.');
  } else {
    for (const b of blockers) {
      sections.push(`- ${b.content_md}`);
    }
  }

  // Risks
  sections.push(`\n## Risks`);
  sections.push('- No risks identified (placeholder).');

  // Questions for Customer
  sections.push(`\n## Questions for Customer`);
  const openQuestions = db
    .prepare(
      `SELECT question_md FROM clarification_questions cq
       JOIN alignment_sessions als ON cq.alignment_session_id = als.id
       WHERE als.project_id = ? AND cq.status = 'open'`,
    )
    .all(projectId);
  if (openQuestions.length === 0) {
    sections.push('- No open questions for customer.');
  } else {
    for (const q of openQuestions) {
      sections.push(`- ${q.question_md}`);
    }
  }

  // Dopamine/scores placeholder
  sections.push(`\n## Team Morale`);
  sections.push('- Score: N/A (placeholder)');

  // Budget/cost placeholder
  sections.push(`\n## Budget / Cost`);
  sections.push('- Not tracked yet (placeholder).');

  // Security concerns
  sections.push(`\n## Security Concerns`);
  sections.push('- None reported.');

  // Documentation/version changes
  sections.push(`\n## Documentation / Version Changes`);
  const recentArtifacts = db
    .prepare(
      `SELECT title, status, version FROM context_artifacts WHERE project_id = ? ORDER BY updated_at DESC LIMIT 5`,
    )
    .all(projectId);
  if (recentArtifacts.length === 0) {
    sections.push('- No recent documentation changes.');
  } else {
    for (const a of recentArtifacts) {
      sections.push(`- ${a.title} (v${a.version}, ${a.status})`);
    }
  }

  // Open alignment issues
  sections.push(`\n## Open Alignment Issues`);
  const activeSessions = db
    .prepare(
      `SELECT id, status FROM alignment_sessions WHERE project_id = ? AND status NOT IN ('closed', 'approved')`,
    )
    .all(projectId);
  if (activeSessions.length === 0) {
    sections.push('- No open alignment sessions.');
  } else {
    for (const s of activeSessions) {
      sections.push(`- Session ${s.id}: ${s.status}`);
    }
  }

  // Task statistics
  sections.push(`\n## Task Statistics`);
  const taskStats = db
    .prepare(`SELECT status, COUNT(*) as count FROM tasks WHERE project_id = ? GROUP BY status`)
    .all(projectId);
  if (taskStats.length === 0) {
    sections.push('- No tasks.');
  } else {
    for (const t of taskStats) {
      sections.push(`- ${t.status}: ${t.count}`);
    }
  }

  sections.push(`\n---\n*Generated automatically by Silver.*`);
  return sections.join('\n');
}

function listReports(db, projectId) {
  return db
    .prepare(
      `SELECT * FROM context_artifacts WHERE project_id = ? AND artifact_type = 'daily_report' ORDER BY created_at DESC`,
    )
    .all(projectId);
}

module.exports = { createDailyReport, listReports };
