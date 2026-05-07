module.exports = {
  name: '007_role_prompt_files',
  up(db) {
    db.exec(`
      CREATE TABLE role_prompt_files (
        id TEXT PRIMARY KEY,
        role_template_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        section_key TEXT NOT NULL,
        content_md TEXT NOT NULL DEFAULT '',
        content_hash TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (role_template_id) REFERENCES role_templates(id)
      )
    `);
  },
};
