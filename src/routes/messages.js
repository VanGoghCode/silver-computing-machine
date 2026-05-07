const express = require('express');
const messageService = require('../services/messages');

function createMessagesRouter(db, auth) {
  const router = express.Router();
  router.use(auth);

  // POST /api/messages
  router.post('/api/messages', (req, res) => {
    const { content_md } = req.body;
    if (!content_md) {
      return res.status(400).json({ error: 'content_md is required' });
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
    const conversations = messageService.listConversations(db, req.agent.project_id);
    res.json({ conversations });
  });

  // GET /api/conversations/:id/messages
  router.get('/api/conversations/:id/messages', (req, res) => {
    const messages = messageService.getConversationMessages(
      db,
      req.params.id,
      req.agent.project_id,
    );
    res.json({ messages });
  });

  return router;
}

module.exports = { createMessagesRouter };
