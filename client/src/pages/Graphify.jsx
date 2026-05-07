import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Graphify() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadRuns = async (projectId) => {
    setSelectedProject(projectId);
    if (!projectId) return setRuns([]);
    try {
      const d = await api.listGraphifyRuns(projectId);
      setRuns(d.graphify_runs || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const runGraphify = async () => {
    try {
      await api.runGraphify(selectedProject);
      setMessage('Graphify run completed');
      loadRuns(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Graphify Integration</h2>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadRuns(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProject && <button onClick={runGraphify}>Run Graphify</button>}
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Trigger</th>
            <th>Started</th>
            <th>Finished</th>
            <th>Output</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>{r.status}</td>
              <td>{r.trigger_reason}</td>
              <td>{r.started_at}</td>
              <td>{r.finished_at}</td>
              <td>{r.output_path || r.error_md || 'N/A'}</td>
            </tr>
          ))}
          {runs.length === 0 && (
            <tr>
              <td colSpan="5">No graphify runs</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
