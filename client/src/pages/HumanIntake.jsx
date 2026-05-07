import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function HumanIntake() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [statements, setStatements] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadStatements = async (projectId) => {
    setSelectedProject(projectId);
    if (!projectId) return setStatements([]);
    try {
      const d = await api.listProblemStatements(projectId);
      setStatements(d.problem_statements || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.createProblemStatement(selectedProject, {
        title,
        content_md: content,
        human_id: 'local-owner',
      });
      setMessage('Problem statement submitted');
      setTitle('');
      setContent('');
      loadStatements(selectedProject);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Human Intake / Brainstorming</h2>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadStatements(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {selectedProject && (
        <form onSubmit={submit} className="form-block">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Problem title"
            required
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your problem..."
            rows={6}
            required
          />
          <button type="submit">Submit Problem Statement</button>
        </form>
      )}
      <h3>Your Problem Statements</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id}>
              <td>{s.title}</td>
              <td>{s.status}</td>
              <td>{s.created_at}</td>
            </tr>
          ))}
          {statements.length === 0 && (
            <tr>
              <td colSpan="3">No problem statements yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
