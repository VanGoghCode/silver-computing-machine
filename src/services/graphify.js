const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateId } = require('../db/helpers');

const SAFE_CMD_PATTERN = /^[a-zA-Z0-9_.-]+$/;

function createGraphifyRun(db, projectId, agentId, triggerReason, config) {
  const id = generateId();
  const commandStr = config.graphifyCommand || 'graphify';
  const parts = commandStr.split(' ');
  const cmd = parts[0];
  const cmdArgs = parts.slice(1);

  // Validate command is a simple executable name (no path separators, pipes, etc.)
  if (!SAFE_CMD_PATTERN.test(cmd)) {
    db.prepare(
      `INSERT INTO graphify_runs (id, project_id, triggered_by_agent_id, trigger_reason, status, error_md, finished_at)
       VALUES (?, ?, ?, ?, 'error', 'Invalid graphify command', datetime('now'))`,
    ).run(id, projectId, agentId || null, triggerReason || 'manual');
    return db.prepare('SELECT * FROM graphify_runs WHERE id = ?').get(id);
  }

  db.prepare(
    `INSERT INTO graphify_runs (id, project_id, triggered_by_agent_id, trigger_reason, status)
     VALUES (?, ?, ?, ?, 'running')`,
  ).run(id, projectId, agentId || null, triggerReason || 'manual');

  try {
    // Run command synchronously so we can return the final status
    execFileSync(cmd, cmdArgs, { timeout: 120000, stdio: 'pipe' });

    // Check for output files
    const project = db.prepare('SELECT root_path FROM projects WHERE id = ?').get(projectId);
    let outputPath = null;
    let summaryMd = null;

    if (project) {
      const graphifyDir = path.join(project.root_path, 'graphify-out');
      if (fs.existsSync(graphifyDir)) {
        outputPath = graphifyDir;
        const reportPath = path.join(graphifyDir, 'GRAPH_REPORT.md');
        if (fs.existsSync(reportPath)) {
          summaryMd = fs.readFileSync(reportPath, 'utf-8').substring(0, 5000);
        }
      }
    }

    db.prepare(
      `UPDATE graphify_runs SET status = 'completed', output_path = ?, summary_md = ?, finished_at = datetime('now') WHERE id = ?`,
    ).run(outputPath, summaryMd, id);
  } catch (err) {
    db.prepare(
      `UPDATE graphify_runs SET status = 'error', error_md = ?, finished_at = datetime('now') WHERE id = ?`,
    ).run(err.message || 'Graphify command not available', id);
  }

  return db.prepare('SELECT * FROM graphify_runs WHERE id = ?').get(id);
}

function listGraphifyRuns(db, projectId) {
  return db
    .prepare('SELECT * FROM graphify_runs WHERE project_id = ? ORDER BY started_at DESC')
    .all(projectId);
}

function queryGraphify(db, query) {
  if (!query) return [];

  const runs = db
    .prepare(
      `SELECT * FROM graphify_runs WHERE status = 'completed' AND summary_md LIKE ? ORDER BY started_at DESC`,
    )
    .all(`%${query}%`);

  return runs.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    summary: r.summary_md ? r.summary_md.substring(0, 500) : null,
    started_at: r.started_at,
  }));
}

module.exports = { createGraphifyRun, listGraphifyRuns, queryGraphify };
