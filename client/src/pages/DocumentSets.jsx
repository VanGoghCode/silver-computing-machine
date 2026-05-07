import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function DocumentSets() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [docSets, setDocSets] = useState([]);
  const [selectedSet, setSelectedSet] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadSets = async (projectId) => {
    setSelectedProject(projectId);
    setSelectedSet(null);
    if (!projectId) return setDocSets([]);
    try {
      const d = await api.listDocumentSets(projectId);
      setDocSets(d.document_sets || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const createSet = async (stage) => {
    try {
      await api.createDocumentSet(selectedProject, {
        name: `${stage.toUpperCase()} Document Set`,
        stage,
      });
      loadSets(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const viewSet = async (id) => {
    try {
      const d = await api.getDocumentSet(id);
      setSelectedSet(d.document_set);
    } catch (e) {
      setError(e.message);
    }
  };

  const approveSet = async (id) => {
    try {
      await api.approveDocumentSet(id);
      viewSet(id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Document Sets</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadSets(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProject && (
          <>
            <button onClick={() => createSet('mvp')}>Create MVP Set</button>
            <button onClick={() => createSet('v1')}>Create v1 Set</button>
          </>
        )}
      </div>

      {selectedSet ? (
        <div className="card">
          <h3>{selectedSet.name}</h3>
          <p>
            Stage: {selectedSet.stage} | Status: {selectedSet.status}
          </p>
          {selectedSet.items && (
            <ul>
              {selectedSet.items.map((item) => (
                <li key={item.id}>
                  {item.artifact_id} (required: {item.required ? 'yes' : 'no'})
                </li>
              ))}
            </ul>
          )}
          <div className="form-row">
            {selectedSet.status !== 'approved' && (
              <button onClick={() => approveSet(selectedSet.id)}>Approve Set</button>
            )}
            <button onClick={() => setSelectedSet(null)}>Back</button>
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Stage</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docSets.map((ds) => (
              <tr key={ds.id}>
                <td>{ds.name}</td>
                <td>{ds.stage}</td>
                <td>{ds.status}</td>
                <td>
                  <button onClick={() => viewSet(ds.id)}>View</button>
                </td>
              </tr>
            ))}
            {docSets.length === 0 && (
              <tr>
                <td colSpan="4">No document sets</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
