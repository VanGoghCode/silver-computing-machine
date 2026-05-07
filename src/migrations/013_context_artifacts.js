module.exports = {
  name: '013_context_artifacts',
  up(db) {
    db.exec(`
      CREATE TABLE context_artifacts (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        department_id TEXT,
        alignment_session_id TEXT,
        artifact_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content_md TEXT NOT NULL DEFAULT '',
        author_agent_id TEXT,
        author_human_id TEXT,
        source_task_id TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        lifecycle_stage TEXT NOT NULL DEFAULT 'discovery',
        visibility_scope TEXT NOT NULL DEFAULT 'project',
        supersedes_artifact_id TEXT,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id),
        FOREIGN KEY (author_agent_id) REFERENCES agents(id),
        FOREIGN KEY (author_human_id) REFERENCES humans(id),
        FOREIGN KEY (supersedes_artifact_id) REFERENCES context_artifacts(id)
      )
    `);

    db.exec(`
      CREATE TABLE context_revisions (
        id TEXT PRIMARY KEY,
        artifact_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        content_md TEXT NOT NULL,
        change_summary_md TEXT,
        created_by_agent_id TEXT,
        created_by_human_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (artifact_id) REFERENCES context_artifacts(id),
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id),
        FOREIGN KEY (created_by_human_id) REFERENCES humans(id)
      )
    `);

    db.exec(`
      CREATE TABLE context_links (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        from_artifact_id TEXT NOT NULL,
        to_artifact_id TEXT NOT NULL,
        link_type TEXT NOT NULL DEFAULT 'references',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (from_artifact_id) REFERENCES context_artifacts(id),
        FOREIGN KEY (to_artifact_id) REFERENCES context_artifacts(id)
      )
    `);

    db.exec(`
      CREATE TABLE document_sets (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        alignment_session_id TEXT,
        name TEXT NOT NULL,
        stage TEXT NOT NULL DEFAULT 'discovery',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (alignment_session_id) REFERENCES alignment_sessions(id)
      )
    `);

    db.exec(`
      CREATE TABLE document_set_items (
        id TEXT PRIMARY KEY,
        document_set_id TEXT NOT NULL,
        artifact_id TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (document_set_id) REFERENCES document_sets(id),
        FOREIGN KEY (artifact_id) REFERENCES context_artifacts(id)
      )
    `);
  },
};
