import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function LocalPrs() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [prs, setPrs] = useState([]);
  const [selectedPr, setSelectedPr] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadPrs = async (projectId) => {
    setSelectedProject(projectId);
    setSelectedPr(null);
    if (!projectId) return setPrs([]);
    try {
      const d = await api.listLocalPrs(projectId);
      setPrs(d.local_prs || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const viewPr = async (id) => {
    try {
      const d = await api.getLocalPr(id);
      setSelectedPr(d.local_pr);
    } catch (e) {
      setError(e.message);
    }
  };

  const updateStatus = async (id, field, value) => {
    try {
      await api.updateLocalPr(id, { [field]: value });
      viewPr(id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Local PRs</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadPrs(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {selectedPr ? (
        <div className="card">
          <h3>{selectedPr.title}</h3>
          <p>
            Status: {selectedPr.status} | Review: {selectedPr.review_status || 'N/A'} | Test:{' '}
            {selectedPr.test_status || 'N/A'} | Merge: {selectedPr.merge_status || 'N/A'}
          </p>
          <p>
            Branch: {selectedPr.branch_name} → {selectedPr.base_branch}
          </p>
          {selectedPr.summary_md && (
            <pre style={{ whiteSpace: 'pre-wrap' }}>{selectedPr.summary_md}</pre>
          )}
          {selectedPr.self_review_md && (
            <div>
              <h4>Self Review</h4>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{selectedPr.self_review_md}</pre>
            </div>
          )}
          {selectedPr.changed_files_json && (
            <div>
              <h4>Changed Files</h4>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{selectedPr.changed_files_json}</pre>
            </div>
          )}
          <div className="form-row">
            <button onClick={() => updateStatus(selectedPr.id, 'review_status', 'approved')}>
              Approve Review
            </button>
            <button onClick={() => updateStatus(selectedPr.id, 'test_status', 'passed')}>
              Pass Tests
            </button>
            <button onClick={() => updateStatus(selectedPr.id, 'status', 'merged')}>
              Mark Merged
            </button>
            <button onClick={() => setSelectedPr(null)}>Back</button>
          </div>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Review</th>
              <th>Test</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {prs.map((p) => (
              <tr key={p.id}>
                <td>{p.title}</td>
                <td>{p.branch_name}</td>
                <td>{p.status}</td>
                <td>{p.review_status || 'N/A'}</td>
                <td>{p.test_status || 'N/A'}</td>
                <td>
                  <button onClick={() => viewPr(p.id)}>View</button>
                </td>
              </tr>
            ))}
            {prs.length === 0 && (
              <tr>
                <td colSpan="6">No PRs</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
