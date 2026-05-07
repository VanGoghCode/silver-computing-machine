function createRoleGraphPolicy(db, projectId) {
  const edges = db.prepare(`SELECT * FROM role_edges WHERE project_id = ?`).all(projectId);

  function findEdge(fromId, toId) {
    return edges.find(
      (e) =>
        (e.from_role_instance_id === fromId && e.to_role_instance_id === toId) ||
        (e.from_role_instance_id === toId &&
          e.to_role_instance_id === fromId &&
          e.direction === 'bidirectional'),
    );
  }

  function checkFlag(fromId, toId, flag) {
    const edge = findEdge(fromId, toId);
    return edge ? Boolean(edge[flag]) : false;
  }

  return {
    canRoleMessage(fromId, toId) {
      return checkFlag(fromId, toId, 'can_message');
    },
    canRoleAssignTask(fromId, toId) {
      // Assignment only works in the from→to direction
      const edge = edges.find(
        (e) => e.from_role_instance_id === fromId && e.to_role_instance_id === toId,
      );
      return edge ? Boolean(edge.can_assign_task) : false;
    },
    canRoleShareContext(fromId, toId) {
      return checkFlag(fromId, toId, 'can_share_context');
    },
    canRoleEscalate(fromId, toId) {
      // Escalation only works from→to direction
      const edge = edges.find(
        (e) => e.from_role_instance_id === fromId && e.to_role_instance_id === toId,
      );
      return edge ? Boolean(edge.can_escalate) : false;
    },
    canRoleRequestApproval(fromId, toId) {
      const edge = edges.find(
        (e) => e.from_role_instance_id === fromId && e.to_role_instance_id === toId,
      );
      return edge ? Boolean(edge.can_request_approval) : false;
    },
  };
}

module.exports = { createRoleGraphPolicy };
