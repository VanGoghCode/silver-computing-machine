const { generateId } = require('../db/helpers');

const PROFILES = [
  {
    key: 'strong_reasoning',
    display_name: 'Strong Reasoning',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    purpose: 'Complex reasoning, strategy, architecture decisions',
  },
  {
    key: 'coding',
    display_name: 'Coding',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    purpose: 'Code implementation, debugging, refactoring',
  },
  {
    key: 'economy',
    display_name: 'Economy',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    purpose: 'Lightweight tasks, quick checks, simple operations',
  },
  {
    key: 'audit_strong',
    display_name: 'Audit Strong',
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    purpose: 'Weekly audits, security reviews, deep analysis',
  },
];

module.exports = {
  name: 'model_profiles',
  run(db) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO model_profiles (id, key, display_name, provider, model, purpose, config_json)
      VALUES (?, ?, ?, ?, ?, ?, '{}')
    `);

    for (const p of PROFILES) {
      insert.run(generateId(), p.key, p.display_name, p.provider, p.model, p.purpose);
    }
  },
};
