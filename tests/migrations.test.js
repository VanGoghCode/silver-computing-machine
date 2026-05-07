const { createTestDb } = require('./helpers');

const EXPECTED_TABLES = [
  'projects',
  'humans',
  'departments',
  'model_profiles',
  'permission_profiles',
  'role_templates',
  'role_prompt_files',
  'project_role_instances',
  'role_edges',
  'agents',
  'agent_heartbeats',
];

describe('Migrations', () => {
  let db;

  beforeEach(() => {
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('All expected tables exist', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r) => r.name)
      .filter((n) => !n.startsWith('_'));

    for (const table of EXPECTED_TABLES) {
      expect(tables).toContain(table);
    }
  });

  test('Foreign keys are enforced', () => {
    expect(() => {
      db.prepare(
        'INSERT INTO departments (id, project_id, key, display_name) VALUES (?, ?, ?, ?)',
      ).run('d1', 'nonexistent_project', 'backend', 'Backend');
    }).toThrow();
  });

  test('_migrations table tracks applied migrations', () => {
    const applied = db.prepare('SELECT name FROM _migrations ORDER BY name').all();
    expect(applied.length).toBe(19);
    expect(applied[0].name).toBe('001_projects');
    expect(applied[10].name).toBe('011_agent_heartbeats');
    expect(applied[11].name).toBe('012_alignment_intake');
    expect(applied[12].name).toBe('013_context_artifacts');
    expect(applied[13].name).toBe('014_tasks');
    expect(applied[14].name).toBe('015_conversations');
    expect(applied[15].name).toBe('016_local_prs');
    expect(applied[16].name).toBe('017_runtime_status');
    expect(applied[17].name).toBe('018_graphify_runs');
    expect(applied[18].name).toBe('019_audit_runs');
  });

  test('projects table has correct columns', () => {
    const info = db.pragma('table_info(projects)');
    const columns = info.map((c) => c.name);
    expect(columns).toContain('id');
    expect(columns).toContain('name');
    expect(columns).toContain('slug');
    expect(columns).toContain('root_path');
    expect(columns).toContain('status');
    expect(columns).toContain('current_phase');
    expect(columns).toContain('created_at');
    expect(columns).toContain('updated_at');
  });

  test('role_edges has all edge policy columns', () => {
    const info = db.pragma('table_info(role_edges)');
    const columns = info.map((c) => c.name);
    expect(columns).toContain('can_message');
    expect(columns).toContain('can_assign_task');
    expect(columns).toContain('can_escalate');
    expect(columns).toContain('can_share_context');
    expect(columns).toContain('can_request_approval');
    expect(columns).toContain('requires_approval');
    expect(columns).toContain('policy_json');
  });
});
