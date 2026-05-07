const express = require('express');
const messageService = require('../services/messages');

function createMessagesRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/messages
  router.post('/api/messages', (req, res) => {
    const { project_id, content_md } = req.body;
    if (!project_id || !content_md) {
      return res.status(400).json({ error: 'project_id and content_md are required' });
    }
    try {
      const message = messageService.sendMessage(db, req.body, req.agent.id);
      res.status(201).json({ message });
    } catch (err) {
      if (err.message.includes('not allowed')) {
        return res.status(403).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
  });

  // GET /api/conversations
  router.get('/api/conversations', (req, res) => {
    const projectId = req.query.project_id;
    if (!projectId) {
      return res.status(400).json({ error: 'project_id query parameter required' });
    }
    const conversations = messageService.listConversations(db, projectId);
    res.json({ conversations });
  });

  // GET /api/conversations/:id/messages
  router.get('/api/conversations/:id/messages', (req, res) => {
    const messages = messageService.getConversationMessages(db, req.params.id);
    res.json({ messages });
  });

  return router;
}

module.exports = { createMessagesRouter };
