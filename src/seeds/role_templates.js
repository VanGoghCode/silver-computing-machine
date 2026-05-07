const { generateId } = require('../db/helpers');

const ROLES = [
  {
    key: 'ceo',
    display_name: 'CEO',
    description: 'Owns customer alignment, business goal, priority, and high-level report quality.',
  },
  {
    key: 'cto',
    display_name: 'CTO',
    description:
      'Owns technical strategy, feasibility, technology decisions, risks, and technical alignment.',
  },
  {
    key: 'product_manager',
    display_name: 'Product Manager',
    description:
      'Owns product requirements, user behavior, acceptance criteria, and customer-facing clarity.',
  },
  {
    key: 'project_manager',
    display_name: 'Project Manager',
    description:
      'Owns Kanban structure, task lifecycle, timelines, dependencies, blockers, and progress reporting.',
  },
  {
    key: 'architect',
    display_name: 'Architect',
    description:
      'Owns architecture spec, module boundaries, system design, and infrastructure design.',
  },
  {
    key: 'tech_lead',
    display_name: 'Tech Lead',
    description:
      'Owns ticket breakdown, branch names, todo lists, developer assignment, and technical execution quality.',
  },
  {
    key: 'engineer',
    display_name: 'Engineer',
    description:
      'Implements assigned tickets on assigned branches, follows todo list, self-reviews, opens PRs.',
  },
  {
    key: 'reviewer',
    display_name: 'Reviewer',
    description: 'Reviews PRs, catches bugs, improves quality, may make small safe fixes.',
  },
  {
    key: 'tester',
    display_name: 'Tester',
    description: 'Runs tests, writes/updates tests, checks edge cases, may make small safe fixes.',
  },
  {
    key: 'git_manager',
    display_name: 'Git Manager',
    description: 'Owns branch hygiene, local PR state, merge safety, and Graphify post-merge runs.',
  },
  {
    key: 'weekly_audit_agent',
    display_name: 'Weekly Audit Agent',
    description: 'Runs scheduled audits, writes markdown findings, shares with Tech Lead.',
  },
];

module.exports = {
  name: 'role_templates',
  run(db) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO role_templates (id, key, display_name, description, default_model_profile_id, default_permission_profile_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const role of ROLES) {
      insert.run(generateId(), role.key, role.display_name, role.description, null, null);
    }
  },
};
