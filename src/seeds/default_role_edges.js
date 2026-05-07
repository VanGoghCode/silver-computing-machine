const { generateId } = require('../db/helpers');

/**
 * Seeds default role edges for a project's department.
 * Creates the communication graph described in the architecture.
 *
 * Hierarchy:
 *   CEO <-> CTO <-> Product Manager <-> Human
 *   Product Manager -> Project Manager
 *   CTO -> Architect
 *   Project Manager -> Tech Lead
 *   Architect -> Tech Lead
 *   Tech Lead <-> Engineer
 *   Tech Lead <-> Reviewer
 *   Tech Lead <-> Tester
 *   Reviewer <-> Tester
 *   Reviewer -> Git Manager
 *   Tester -> Git Manager
 *   Weekly Audit Agent -> Tech Lead
 *
 * Human communication only through: CEO, CTO, Product Manager.
 */
module.exports = {
  name: 'default_role_edges',
  run(db, projectId, departmentId) {
    const instances = db
      .prepare(
        `SELECT pri.id, rt.key as role_key
         FROM project_role_instances pri
         JOIN role_templates rt ON rt.id = pri.role_template_id
         WHERE pri.project_id = ? AND pri.department_id = ? AND pri.is_active = 1`,
      )
      .all(projectId, departmentId);

    const byKey = {};
    for (const inst of instances) {
      byKey[inst.role_key] = inst.id;
    }

    const edgeInsert = db.prepare(`
      INSERT INTO role_edges (id, project_id, from_role_instance_id, to_role_instance_id,
        edge_type, direction, can_message, can_assign_task, can_escalate, can_share_context,
        can_request_approval, requires_approval, policy_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    function edge(from, to, opts = {}) {
      if (!byKey[from] || !byKey[to]) return;
      edgeInsert.run(
        generateId(),
        projectId,
        byKey[from],
        byKey[to],
        opts.edge_type || 'hierarchy',
        opts.direction || 'upstream',
        opts.can_message ? 1 : 0,
        opts.can_assign_task ? 1 : 0,
        opts.can_escalate ? 1 : 0,
        opts.can_share_context ? 1 : 0,
        opts.can_request_approval ? 1 : 0,
        opts.requires_approval ? 1 : 0,
        opts.policy_json || '{}',
      );
    }

    // CEO <-> CTO
    edge('ceo', 'cto', {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
      can_request_approval: true,
    });
    // CEO <-> Product Manager
    edge('ceo', 'product_manager', {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
      can_request_approval: true,
    });
    // CTO <-> Product Manager
    edge('cto', 'product_manager', {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
      can_request_approval: true,
    });
    // Product Manager -> Project Manager
    edge('product_manager', 'project_manager', {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // CTO -> Architect
    edge('cto', 'architect', {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // Project Manager -> Tech Lead
    edge('project_manager', 'tech_lead', {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // Architect -> Tech Lead
    edge('architect', 'tech_lead', {
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // Tech Lead <-> Engineer
    edge('tech_lead', 'engineer', {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // Tech Lead <-> Reviewer
    edge('tech_lead', 'reviewer', {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // Tech Lead <-> Tester
    edge('tech_lead', 'tester', {
      direction: 'bidirectional',
      can_message: true,
      can_assign_task: true,
      can_escalate: true,
      can_share_context: true,
    });
    // Reviewer <-> Tester
    edge('reviewer', 'tester', {
      direction: 'bidirectional',
      can_message: true,
      can_share_context: true,
    });
    // Reviewer -> Git Manager
    edge('reviewer', 'git_manager', {
      can_message: true,
      can_share_context: true,
    });
    // Tester -> Git Manager
    edge('tester', 'git_manager', {
      can_message: true,
      can_share_context: true,
    });
    // Weekly Audit Agent -> Tech Lead
    edge('weekly_audit_agent', 'tech_lead', {
      can_message: true,
      can_share_context: true,
    });
  },
};
