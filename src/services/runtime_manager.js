const { spawn } = require('child_process');

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

class ProcessRuntimeManager {
  constructor(options = {}) {
    this.command = options.command || process.execPath;
    this.args = options.args || ['-e', 'setInterval(() => {}, 1000)'];
    this.env = options.env || {};
    this.runtimes = new Map();
  }

  async createProjectRuntime(projectId, options = {}) {
    if (!options.projectRoot) {
      throw new Error('projectRoot is required for process runtime');
    }
    this.runtimes.set(projectId, {
      projectId,
      projectRoot: options.projectRoot,
      status: 'created',
      workers: new Map(),
    });
    return { projectId, status: 'created', projectRoot: options.projectRoot };
  }

  async startProjectRuntime(projectId) {
    const runtime = this.#getRuntime(projectId);
    runtime.status = 'running';
    return { projectId, status: 'running', projectRoot: runtime.projectRoot };
  }

  async stopProjectRuntime(projectId) {
    const runtime = this.#getRuntime(projectId);
    for (const [agentId] of runtime.workers.entries()) {
      await this.stopWorker(projectId, agentId);
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
      projectRoot: runtime.projectRoot,
      workers: Array.from(runtime.workers.values()).map((worker) => ({
        agentId: worker.agentId,
        status: worker.status,
        pid: worker.process?.pid || null,
      })),
    };
  }

  async spawnWorker(projectId, agentId, options = {}) {
    const runtime = this.#getRuntime(projectId);
    if (runtime.status !== 'running') {
      throw new Error(
        `Runtime for project ${projectId} is not running (status: ${runtime.status})`,
      );
    }
    if (!options.token) {
      throw new Error('agent token is required to spawn a worker');
    }

    const command = options.command || this.command;
    const args = options.args || this.args;
    const logs = [`[${new Date().toISOString()}] Worker process spawning`];
    const child = spawn(command, args, {
      cwd: runtime.projectRoot,
      env: {
        PATH: process.env.PATH || '',
        SystemRoot: process.env.SystemRoot || '',
        HOME: process.env.HOME || '',
        USERPROFILE: process.env.USERPROFILE || '',
        ...this.env,
        CRISPY_AGENT_TOKEN: options.token,
        CRISPY_PROJECT_ROOT: runtime.projectRoot,
        PROJECT_ROOT: runtime.projectRoot,
        SILVER_PROJECT_ID: projectId,
        SILVER_AGENT_ID: agentId,
        MODEL_PROFILE_JSON: JSON.stringify(options.modelProfile || {}),
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const worker = { agentId, status: 'running', process: child, logs };
    runtime.workers.set(agentId, worker);

    child.stdout.on('data', (chunk) => logs.push(chunk.toString('utf8')));
    child.stderr.on('data', (chunk) => logs.push(chunk.toString('utf8')));
    child.on('exit', (code, signal) => {
      worker.status = 'stopped';
      logs.push(`[${new Date().toISOString()}] Worker exited code=${code} signal=${signal}`);
    });

    return {
      agentId,
      status: 'running',
      pid: child.pid,
      projectRoot: runtime.projectRoot,
      tokenProvided: true,
    };
  }

  async stopWorker(projectId, agentId) {
    const runtime = this.#getRuntime(projectId);
    const worker = runtime.workers.get(agentId);
    if (!worker) {
      throw new Error(`Worker ${agentId} not found in project ${projectId}`);
    }
    if (worker.process && worker.status === 'running') {
      worker.process.kill();
    }
    worker.status = 'stopped';
    worker.logs.push(`[${new Date().toISOString()}] Worker stopped`);
    return { agentId, status: 'stopped' };
  }

  async getWorkerLogs(projectId, agentId) {
    const runtime = this.#getRuntime(projectId);
    const worker = runtime.workers.get(agentId);
    if (!worker) {
      throw new Error(`Worker ${agentId} not found in project ${projectId}`);
    }
    return [...worker.logs];
  }

  #getRuntime(projectId) {
    const runtime = this.runtimes.get(projectId);
    if (!runtime) throw new Error(`Runtime not found for project: ${projectId}`);
    return runtime;
  }
}

module.exports = { MockRuntimeManager, ProcessRuntimeManager };
