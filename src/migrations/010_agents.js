module.exports = {
  name: '010_agents',
  up(db) {
    db.exec(`
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        role_instance_id TEXT NOT NULL,
        name TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'inactive',
        worker_status TEXT DEFAULT 'idle',
        last_heartbeat_at TEXT,
        model_profile_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (role_instance_id) REFERENCES project_role_instances(id),
        FOREIGN KEY (model_profile_id) REFERENCES model_profiles(id)
      )
    `);
  },
};
