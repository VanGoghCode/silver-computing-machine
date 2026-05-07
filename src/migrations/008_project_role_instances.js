module.exports = {
  name: '008_project_role_instances',
  up(db) {
    db.exec(`
      CREATE TABLE project_role_instances (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        department_id TEXT NOT NULL,
        role_template_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        canvas_x REAL DEFAULT 0,
        canvas_y REAL DEFAULT 0,
        model_profile_id TEXT,
        permission_profile_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (role_template_id) REFERENCES role_templates(id),
        FOREIGN KEY (model_profile_id) REFERENCES model_profiles(id),
        FOREIGN KEY (permission_profile_id) REFERENCES permission_profiles(id)
      )
    `);
  },
};
