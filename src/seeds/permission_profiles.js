const { generateId } = require('../db/helpers');

const PROFILES = [
  {
    key: 'ceo_default',
    display_name: 'CEO Default',
    permissions: { can_message_human: true, can_escalate: true, can_approve_docs: true },
  },
  {
    key: 'cto_default',
    display_name: 'CTO Default',
    permissions: { can_message_human: true, can_escalate: true, can_approve_tech: true },
  },
  {
    key: 'product_manager_default',
    display_name: 'Product Manager Default',
    permissions: { can_message_human: true, can_create_requirements: true },
  },
  {
    key: 'project_manager_default',
    display_name: 'Project Manager Default',
    permissions: { can_manage_tasks: true, can_view_progress: true },
  },
  {
    key: 'architect_default',
    display_name: 'Architect Default',
    permissions: { can_design_architecture: true, can_run_graphify: true },
  },
  {
    key: 'tech_lead_default',
    display_name: 'Tech Lead Default',
    permissions: { can_assign_tickets: true, can_review_prs: true, can_approve_merge: true },
  },
  {
    key: 'engineer_default',
    display_name: 'Engineer Default',
    permissions: { can_write_code: true, can_open_pr: true, can_self_review: true },
  },
  {
    key: 'reviewer_default',
    display_name: 'Reviewer Default',
    permissions: { can_review_prs: true, can_request_changes: true, can_small_fix: true },
  },
  {
    key: 'tester_default',
    display_name: 'Tester Default',
    permissions: { can_run_tests: true, can_write_tests: true, can_small_fix: true },
  },
  {
    key: 'git_manager_default',
    display_name: 'Git Manager Default',
    permissions: { can_merge: true, can_manage_branches: true, can_run_graphify: true },
  },
  {
    key: 'weekly_audit_default',
    display_name: 'Weekly Audit Default',
    permissions: { can_read_codebase: true, can_create_audit_report: true },
  },
];

module.exports = {
  name: 'permission_profiles',
  run(db) {
    const insert = db.prepare(`
      INSERT OR IGNORE INTO permission_profiles (id, key, display_name, permissions_json)
      VALUES (?, ?, ?, ?)
    `);

    for (const p of PROFILES) {
      insert.run(generateId(), p.key, p.display_name, JSON.stringify(p.permissions));
    }
  },
};
