module.exports = {
  name: '016_local_prs',
  up(db) {
    db.exec(`
      CREATE TABLE local_prs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        department_id TEXT,
        task_id TEXT,
        created_by_agent_id TEXT,
        title TEXT NOT NULL,
        summary_md TEXT,
        branch_name TEXT,
        base_branch TEXT,
        changed_files_json TEXT DEFAULT '[]',
        self_review_md TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        review_status TEXT,
        test_status TEXT,
        merge_status TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id)
      )
    `);
  },
};
