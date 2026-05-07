module.exports = {
  name: '018_graphify_runs',
  up(db) {
    db.exec(`
      CREATE TABLE graphify_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        triggered_by_agent_id TEXT,
        trigger_reason TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'pending',
        output_path TEXT,
        summary_md TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        finished_at TEXT,
        error_md TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (triggered_by_agent_id) REFERENCES agents(id)
      )
    `);
  },
};
