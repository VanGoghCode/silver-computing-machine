import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function AlignmentSessions() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadSessions = async (projectId) => {
    setSelectedProject(projectId);
    if (!projectId) return setSessions([]);
    try {
      const d = await api.listAlignmentSessions(projectId);
      setSessions(d.alignment_sessions || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const startSession = async () => {
    try {
      const statements = await api.listProblemStatements(selectedProject);
      const ps = (statements.problem_statements || [])[0];
      if (!ps) return setError('Create a problem statement first');
      await api.createAlignmentSession(selectedProject, {
        problem_statement_id: ps.id,
        title: `Alignment for ${ps.title}`,
      });
      loadSessions(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Alignment Sessions</h2>
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
        {selectedProject && <button onClick={startSession}>Start Session</button>}
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Round</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{s.title}</td>
              <td>{s.status}</td>
              <td>{s.current_round}</td>
              <td>{s.alignment_score || 'N/A'}</td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr>
              <td colSpan="4">No sessions</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
