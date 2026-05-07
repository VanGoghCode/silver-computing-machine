module.exports = {
  name: '019_audit_runs',
  up(db) {
    db.exec(`
      CREATE TABLE audit_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        department_id TEXT,
        audit_agent_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        report_artifact_id TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        finished_at TEXT,
        error_md TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (audit_agent_id) REFERENCES agents(id),
        FOREIGN KEY (report_artifact_id) REFERENCES context_artifacts(id)
      )
    `);
  },
};
