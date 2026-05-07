/**
 * Project runtime manager interface.
 * One runtime per project, many workers inside.
 * Project runtime mounts only that project folder.
 * Agents receive only their own token and model env config.
 */

class MockRuntimeManager {
  constructor() {
    /** @type {Map<string, { status: string, workers: Map<string, { agentId: string, status: string, logs: string[] }> }>} */
    this.runtimes = new Map();
  }

  async createProjectRuntime(projectId) {
    this.runtimes.set(projectId, {
      status: 'created',
      workers: new Map(),
    });
    return { projectId, status: 'created' };
  }

  async startProjectRuntime(projectId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) {
      throw new Error(`Runtime not found for project: ${projectId}`);
    }
    runtime.status = 'running';
    return { projectId, status: 'running' };
  }

  async stopProjectRuntime(projectId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) {
      throw new Error(`Runtime not found for project: ${projectId}`);
    }
    // Stop all workers
    for (const worker of runtime.workers.values()) {
      worker.status = 'stopped';
      worker.logs.push(`[${new Date().toISOString()}] Worker stopped (runtime shutdown)`);
    }
    runtime.status = 'stopped';
    return { projectId, status: 'stopped' };
  }

  async getProjectRuntimeStatus(projectId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) return null;
    return {
      projectId,
      status: runtime.status,
      workers: Array.from(runtime.workers.values()).map((w) => ({
        agentId: w.agentId,
        status: w.status,
      })),
    };
  }

  async spawnWorker(projectId, agentId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) {
      throw new Error(`Runtime not found for project: ${projectId}`);
    }
    if (runtime.status !== 'running') {
      throw new Error(
        `Runtime for project ${projectId} is not running (status: ${runtime.status})`,
      );
    }
    const worker = {
      agentId,
      status: 'running',
      logs: [`[${new Date().toISOString()}] Worker started`],
    };
    runtime.workers.set(agentId, worker);
    return { agentId, status: 'running' };
  }

  async stopWorker(projectId, agentId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) {
      throw new Error(`Runtime not found for project: ${projectId}`);
    }
    const worker = runtime.workers.get(agentId);
    if (!worker) {
      throw new Error(`Worker ${agentId} not found in project ${projectId}`);
    }
    worker.status = 'stopped';
    worker.logs.push(`[${new Date().toISOString()}] Worker stopped`);
    return { agentId, status: 'stopped' };
  }

  async getWorkerLogs(projectId, agentId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) {
      throw new Error(`Runtime not found for project: ${projectId}`);
    }
    const worker = runtime.workers.get(agentId);
    if (!worker) {
      throw new Error(`Worker ${agentId} not found in project ${projectId}`);
    }
    return [...worker.logs];
  }
}

module.exports = { MockRuntimeManager };
