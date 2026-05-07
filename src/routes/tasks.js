const express = require('express');
const taskService = require('../services/tasks');

function createTasksRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // GET /api/tasks
  router.get('/api/tasks', (req, res) => {
    const tasks = taskService.listTasks(db, req.agent.project_id);
    res.json({ tasks });
  });

  // GET /api/tasks/:id
  router.get('/api/tasks/:id', (req, res) => {
    const task = taskService.getTask(db, req.params.id, req.agent.project_id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ task });
  });

  // POST /api/tasks
  router.post('/api/tasks', (req, res) => {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }
    try {
      const task = taskService.createTask(db, req.body, req.agent.id);
      res.status(201).json({ task });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/my-tasks
  router.get('/api/my-tasks', (req, res) => {
    const tasks = taskService.getMyTasks(db, req.agent.id);
    res.json({ tasks });
  });

  // POST /api/tasks/:id/claim
  router.post('/api/tasks/:id/claim', (req, res) => {
    try {
      const task = taskService.claimTask(db, req.params.id, req.agent.id);
      res.json({ task });
    } catch (err) {
      if (err.message.includes('not assigned')) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  // GET /api/tasks/:id/execution-context
  router.get('/api/tasks/:id/execution-context', (req, res) => {
    try {
      const ctx = taskService.getExecutionContext(db, req.params.id, req.agent.id);
      res.json(ctx);
    } catch (err) {
      if (err.message === 'Task not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/tasks/:id/events
  router.post('/api/tasks/:id/events', (req, res) => {
    const { event_type } = req.body;
    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }
    try {
      const event = taskService.createTaskEvent(db, req.params.id, req.agent.id, req.body);
      res.status(201).json({ event });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/tasks/:id/todos/:todoId
  router.patch('/api/tasks/:id/todos/:todoId', (req, res) => {
    try {
      const task = taskService.getTask(db, req.params.id, req.agent.project_id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      const todo = taskService.updateTodo(db, req.params.id, req.params.todoId, req.body);
      res.json({ todo });
    } catch (err) {
      if (err.message === 'Todo not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/tasks/:id/move
  router.patch('/api/tasks/:id/move', (req, res) => {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    try {
      const task = taskService.moveTask(db, req.params.id, status, req.agent.id, req.body.reason);
      res.json({ task });
    } catch (err) {
      if (err.message.includes('Invalid transition')) {
        return res.status(400).json({ error: err.message });
      }
      if (err.message.includes('Cannot move to ready') || err.message.includes('Pipeline')) {
        return res.status(400).json({ error: err.message });
      }
      if (err.message === 'Task not found') {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes('Cannot complete task')) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/tasks/:id/complete
  router.post('/api/tasks/:id/complete', (req, res) => {
    try {
      const task = taskService.completeTask(
        db,
        req.params.id,
        req.agent.id,
        req.body.result || req.body,
      );
      res.json({ task });
    } catch (err) {
      if (err.message === 'Task not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  // POST /api/tasks/:id/fail
  router.post('/api/tasks/:id/fail', (req, res) => {
    try {
      const task = taskService.failTask(
        db,
        req.params.id,
        req.agent.id,
        req.body.reason || req.body.error,
        req.body.result || req.body,
      );
      res.json({ task });
    } catch (err) {
      if (err.message === 'Task not found') {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createTasksRouter };
