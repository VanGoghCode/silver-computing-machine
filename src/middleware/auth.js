const { hashToken } = require('../utils/tokens');
const { findAgentByTokenHash } = require('../services/agents');

function bearerAuth(db) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);
    if (!token) {
      return res.status(401).json({ error: 'Empty bearer token' });
    }

    const tokenHash = hashToken(token);
    const agent = findAgentByTokenHash(db, tokenHash);

    if (!agent) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.agent = agent;
    next();
  };
}

module.exports = { bearerAuth };
