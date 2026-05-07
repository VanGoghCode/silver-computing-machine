const fs = require('fs');
const os = require('os');
const path = require('path');
const { MockRuntimeManager, ProcessRuntimeManager } = require('../src/services/runtime_manager');

describe('Project Runtime Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new MockRuntimeManager();
  });

  describe('MockRuntimeManager', () => {
    test('createProjectRuntime initializes runtime', async () => {
      const result = await manager.createProjectRuntime('project-1');
      expect(result.projectId).toBe('project-1');
      expect(result.status).toBe('created');
    });

    test('startProjectRuntime changes status to running', async () => {
      await manager.createProjectRuntime('project-1');
      const result = await manager.startProjectRuntime('project-1');
      expect(result.status).toBe('running');
    });

    test('stopProjectRuntime changes status to stopped', async () => {
      await manager.createProjectRuntime('project-1');
      await manager.startProjectRuntime('project-1');
      const result = await manager.stopProjectRuntime('project-1');
      expect(result.status).toBe('stopped');
    });

    test('getProjectRuntimeStatus returns current status', async () => {
      await manager.createProjectRuntime('project-1');
      const status = await manager.getProjectRuntimeStatus('project-1');
      expect(status.status).toBe('created');
      expect(status.workers).toEqual([]);
    });

    test('spawnWorker creates worker in project runtime', async () => {
      await manager.createProjectRuntime('project-1');
      await manager.startProjectRuntime('project-1');
      const worker = await manager.spawnWorker('project-1', 'agent-1');
      expect(worker.agentId).toBe('agent-1');
      expect(worker.status).toBe('running');

      const status = await manager.getProjectRuntimeStatus('project-1');
      expect(status.workers).toHaveLength(1);
      expect(status.workers[0].agentId).toBe('agent-1');
    });

    test('stopWorker stops a running worker', async () => {
      await manager.createProjectRuntime('project-1');
      await manager.startProjectRuntime('project-1');
      await manager.spawnWorker('project-1', 'agent-1');

      const result = await manager.stopWorker('project-1', 'agent-1');
      expect(result.status).toBe('stopped');

      const status = await manager.getProjectRuntimeStatus('project-1');
      expect(status.workers[0].status).toBe('stopped');
    });

    test('getWorkerLogs returns log entries', async () => {
      await manager.createProjectRuntime('project-1');
      await manager.startProjectRuntime('project-1');
      await manager.spawnWorker('project-1', 'agent-1');

      const logs = await manager.getWorkerLogs('project-1', 'agent-1');
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('cannot spawn worker on stopped runtime', async () => {
      await manager.createProjectRuntime('project-1');
      await expect(manager.spawnWorker('project-1', 'agent-1')).rejects.toThrow(/not running/i);
    });

    test('getProjectRuntimeStatus returns null for unknown project', async () => {
      const status = await manager.getProjectRuntimeStatus('unknown');
      expect(status).toBeNull();
    });

    test('multiple workers in same project runtime', async () => {
      await manager.createProjectRuntime('project-1');
      await manager.startProjectRuntime('project-1');
      await manager.spawnWorker('project-1', 'agent-1');
      await manager.spawnWorker('project-1', 'agent-2');
      await manager.spawnWorker('project-1', 'agent-3');

      const status = await manager.getProjectRuntimeStatus('project-1');
      expect(status.workers).toHaveLength(3);
    });

    test('project isolation — runtime tracks project separately', async () => {
      await manager.createProjectRuntime('project-a');
      await manager.createProjectRuntime('project-b');
      await manager.startProjectRuntime('project-a');
      await manager.startProjectRuntime('project-b');
      await manager.spawnWorker('project-a', 'agent-a1');

      const statusA = await manager.getProjectRuntimeStatus('project-a');
      const statusB = await manager.getProjectRuntimeStatus('project-b');
      expect(statusA.workers).toHaveLength(1);
      expect(statusB.workers).toHaveLength(0);
    });
  });

  describe('ProcessRuntimeManager', () => {
    let projectRoot;
    let otherRoot;

    beforeEach(() => {
      projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-runtime-a-'));
      otherRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-runtime-b-'));
    });

    test('creates one process runtime per project root', async () => {
      const processManager = new ProcessRuntimeManager();
      await processManager.createProjectRuntime('project-a', { projectRoot });
      await processManager.createProjectRuntime('project-b', { projectRoot: otherRoot });

      const statusA = await processManager.getProjectRuntimeStatus('project-a');
      const statusB = await processManager.getProjectRuntimeStatus('project-b');
      expect(statusA.projectRoot).toBe(projectRoot);
      expect(statusB.projectRoot).toBe(otherRoot);
    });

    test('spawnWorker requires an agent token', async () => {
      const processManager = new ProcessRuntimeManager();
      await processManager.createProjectRuntime('project-a', { projectRoot });
      await processManager.startProjectRuntime('project-a');

      await expect(processManager.spawnWorker('project-a', 'agent-a')).rejects.toThrow(/token/i);
    });

    test('worker process receives isolated project root env and cwd', async () => {
      const processManager = new ProcessRuntimeManager({
        args: [
          '-e',
          'console.log(process.cwd()); console.log(process.env.CRISPY_PROJECT_ROOT); setTimeout(() => {}, 2000)',
        ],
      });
      await processManager.createProjectRuntime('project-a', { projectRoot });
      await processManager.startProjectRuntime('project-a');

      const worker = await processManager.spawnWorker('project-a', 'agent-a', {
        token: 'silver_test_token',
      });
      expect(worker.projectRoot).toBe(projectRoot);
      expect(worker.tokenProvided).toBe(true);

      let logs = [];
      for (let attempt = 0; attempt < 20; attempt++) {
        logs = await processManager.getWorkerLogs('project-a', 'agent-a');
        if (logs.join('').includes(projectRoot)) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const joinedLogs = logs.join('');
      expect(joinedLogs).toContain(projectRoot);
      expect(joinedLogs).not.toContain('silver_test_token');

      await processManager.stopWorker('project-a', 'agent-a');
      const status = await processManager.getProjectRuntimeStatus('project-a');
      expect(status.workers[0].status).toBe('stopped');
    });
  });
});
