const { MockRuntimeManager } = require('../src/services/runtime_manager');

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
});
