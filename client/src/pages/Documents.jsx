import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Documents() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadArtifacts = async (projectId) => {
    setSelectedProject(projectId);
    setSelectedArtifact(null);
    if (!projectId) return setArtifacts([]);
    try {
      let params = '';
      if (filter) params = `?artifact_type=${filter}`;
      const d = await api.listArtifacts(projectId, params);
      setArtifacts(d.artifacts || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const viewArtifact = async (id) => {
    try {
      const d = await api.getArtifact(id);
      setSelectedArtifact(d.artifact);
    } catch (e) {
      setError(e.message);
    }
  };

  const approve = async (id) => {
    try {
      await api.approveArtifact(id);
      loadArtifacts(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const reject = async (id) => {
    try {
      await api.rejectArtifact(id);
      loadArtifacts(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const archive = async (id) => {
    try {
      await api.archiveArtifact(id);
      loadArtifacts(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Context Artifacts / Documents</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadArtifacts(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            if (selectedProject) loadArtifacts(selectedProject);
          }}
        >
          <option value="">All types</option>
          {[
            'customer_brief',
            'product_requirements',
            'acceptance_criteria',
            'architecture_spec',
            'audit_report',
            'daily_report',
          ].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {selectedArtifact ? (
        <div className="card">
          <h3>{selectedArtifact.title}</h3>
          <p>
            Type: {selectedArtifact.artifact_type} | Status: {selectedArtifact.status} | Version:{' '}
            {selectedArtifact.version}
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflow: 'auto' }}>
            {selectedArtifact.content_md}
          </pre>
          <div className="form-row">
            <button onClick={() => approve(selectedArtifact.id)}>Approve</button>
            <button onClick={() => reject(selectedArtifact.id)}>Reject</button>
            <button onClick={() => archive(selectedArtifact.id)}>Archive</button>
            <button onClick={() => setSelectedArtifact(null)}>Back</button>
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
              <th>Version</th>
              <th>Lifecycle</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{a.artifact_type}</td>
                <td>{a.status}</td>
                <td>v{a.version}</td>
                <td>{a.lifecycle_stage}</td>
                <td>
                  <button onClick={() => viewArtifact(a.id)}>View</button>
                </td>
              </tr>
            ))}
            {artifacts.length === 0 && (
              <tr>
                <td colSpan="6">No artifacts</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
