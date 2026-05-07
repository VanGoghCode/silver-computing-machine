const { createSeededTestDb } = require('./helpers');

describe('Seeds', () => {
  let db;

  beforeEach(() => {
    db = createSeededTestDb();
  });

  afterEach(() => {
    db.close();
  });

  test('11 role templates seeded', () => {
    const rows = db.prepare('SELECT * FROM role_templates').all();
    expect(rows.length).toBe(11);
    const keys = rows.map((r) => r.key);
    expect(keys).toContain('ceo');
    expect(keys).toContain('cto');
    expect(keys).toContain('product_manager');
    expect(keys).toContain('project_manager');
    expect(keys).toContain('architect');
    expect(keys).toContain('tech_lead');
    expect(keys).toContain('engineer');
    expect(keys).toContain('reviewer');
    expect(keys).toContain('tester');
    expect(keys).toContain('git_manager');
    expect(keys).toContain('weekly_audit_agent');
  });

  test('4 model profiles seeded', () => {
    const rows = db.prepare('SELECT * FROM model_profiles').all();
    expect(rows.length).toBe(4);
    const keys = rows.map((r) => r.key);
    expect(keys).toContain('strong_reasoning');
    expect(keys).toContain('coding');
    expect(keys).toContain('economy');
    expect(keys).toContain('audit_strong');
  });

  test('11 permission profiles seeded', () => {
    const rows = db.prepare('SELECT * FROM permission_profiles').all();
    expect(rows.length).toBe(11);
  });

  test('Human local-owner record exists', () => {
    const human = db.prepare("SELECT * FROM humans WHERE id = 'human_local_owner'").get();
    expect(human).toBeTruthy();
    expect(human.display_name).toBe('Local Owner');
    expect(human.role).toBe('local_owner');
  });

  test('Seeds are idempotent', () => {
    // Run seeds again
    const seeds = [
      require('../src/seeds/model_profiles'),
      require('../src/seeds/permission_profiles'),
      require('../src/seeds/role_templates'),
      require('../src/seeds/human_local_owner'),
    ];
    const { runSeeds } = require('../src/db/seed');
    runSeeds(db, seeds);

    const models = db.prepare('SELECT * FROM model_profiles').all();
    expect(models.length).toBe(4);
  });
});
