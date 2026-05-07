const VALID_WORKER_STATUSES = ['idle', 'busy', 'error', 'offline', 'starting', 'stopped'];

/**
 * Detect agents whose last heartbeat is older than the stale threshold.
 * Marks them as offline. Returns count of updated agents.
 */
function detectStaleAgents(db, staleMs) {
  const cutoff = new Date(Date.now() - staleMs).toISOString();

  const result = db
    .prepare(
      `UPDATE agents
     SET worker_status = 'offline', updated_at = ?
     WHERE last_heartbeat_at IS NOT NULL
       AND last_heartbeat_at < ?
       AND worker_status != 'offline'
       AND worker_status != 'stopped'
       AND status != 'revoked'`,
    )
    .run(new Date().toISOString(), cutoff);

  return result.changes;
}

module.exports = { detectStaleAgents, VALID_WORKER_STATUSES };
