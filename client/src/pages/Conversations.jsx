import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Conversations() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadConversations = async (projectId) => {
    setSelectedProject(projectId);
    setSelectedConv(null);
    if (!projectId) return setConversations([]);
    try {
      const d = await api.listConversations(projectId);
      setConversations(d.conversations || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadMessages = async (convId) => {
    setSelectedConv(convId);
    try {
      const d = await api.getMessages(convId);
      setMessages(d.messages || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    try {
      await api.sendMessage({
        conversation_id: selectedConv,
        content_md: newMsg,
        message_type: 'notification',
      });
      setNewMsg('');
      loadMessages(selectedConv);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Conversations</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadConversations(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ width: '250px' }}>
          <h3>Threads</h3>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => loadMessages(c.id)}
              style={{
                padding: '6px',
                cursor: 'pointer',
                background: selectedConv === c.id ? '#e0e0e0' : '#fff',
                marginBottom: '4px',
                borderRadius: '4px',
              }}
            >
              {c.title}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          {selectedConv ? (
            <>
              <h3>Messages</h3>
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {messages.map((m) => (
                  <div key={m.id} className="card" style={{ marginBottom: '4px' }}>
                    <p style={{ fontSize: '0.75rem', color: '#666' }}>
                      {m.from_agent_id?.substring(0, 8)} → {m.to_agent_id?.substring(0, 8)} |{' '}
                      {m.message_type}
                    </p>
                    <p style={{ margin: 0 }}>{m.content_md}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="form-row" style={{ marginTop: '8px' }}>
                <input
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type message..."
                  required
                />
                <button type="submit">Send</button>
              </form>
            </>
          ) : (
            <p>Select a conversation</p>
          )}
        </div>
      </div>
    </div>
  );
}
