import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Questions() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadSessions = async (projectId) => {
    setSelectedProject(projectId);
    setSelectedSession('');
    setQuestions([]);
    if (!projectId) return setSessions([]);
    try {
      const d = await api.listAlignmentSessions(projectId);
      setSessions(d.alignment_sessions || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const loadQuestions = async (sessionId) => {
    setSelectedSession(sessionId);
    if (!sessionId) return setQuestions([]);
    try {
      const d = await api.listQuestions(sessionId);
      setQuestions(d.questions || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const answerQ = async (questionId) => {
    const answerMd = answers[questionId];
    if (!answerMd) return;
    try {
      await api.answerQuestion(questionId, {
        answer_md: answerMd,
        answered_by_human_id: 'human_local_owner',
      });
      if (selectedSession) loadQuestions(selectedSession);
      setAnswers((prev) => {
        const n = { ...prev };
        delete n[questionId];
        return n;
      });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Questions & Answers</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadSessions(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select value={selectedSession} onChange={(e) => loadQuestions(e.target.value)}>
          <option value="">Select session...</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.status})
            </option>
          ))}
        </select>
      </div>
      {questions.map((q) => (
        <div key={q.id} className="card" style={{ marginTop: '0.5rem' }}>
          <p>
            <strong>{q.question_type}</strong> — {q.question_md}
          </p>
          <p>
            Status: {q.status} | Priority: {q.priority}
          </p>
          {q.status === 'open' && (
            <div className="form-row">
              <input
                value={answers[q.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Your answer..."
              />
              <button onClick={() => answerQ(q.id)}>Answer</button>
            </div>
          )}
        </div>
      ))}
      {selectedSession && questions.length === 0 && <p>No questions yet</p>}
    </div>
  );
}
