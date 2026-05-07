module.exports = {
  name: '020_hardening_snapshots',
  up(db) {
    db.exec(`
      ALTER TABLE document_set_items
      ADD COLUMN artifact_version INTEGER
    `);

    db.exec(`
      ALTER TABLE document_set_items
      ADD COLUMN artifact_revision_id TEXT
    `);

    db.exec(`
      ALTER TABLE document_sets
      ADD COLUMN approved_at TEXT
    `);

    db.exec(`
      ALTER TABLE research_notes
      ADD COLUMN version INTEGER NOT NULL DEFAULT 1
    `);

    db.exec(`
      CREATE TABLE research_note_revisions (
        id TEXT PRIMARY KEY,
        research_note_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        content_md TEXT NOT NULL,
        change_summary_md TEXT,
        created_by_agent_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (research_note_id) REFERENCES research_notes(id),
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id)
      )
    `);
  },
};
