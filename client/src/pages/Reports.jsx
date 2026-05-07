import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Reports() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [reports, setReports] = useState([]);
  const [auditRuns, setAuditRuns] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadReports = async (projectId) => {
    setSelectedProject(projectId);
    if (!projectId) {
      setReports([]);
      setAuditRuns([]);
      return;
    }
    try {
      const [r, a] = await Promise.all([
        api.listReports(projectId).catch(() => ({ reports: [] })),
        api.listAuditRuns(projectId).catch(() => ({ audit_runs: [] })),
      ]);
      setReports(r.reports || []);
      setAuditRuns(a.audit_runs || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const genDaily = async () => {
    try {
      await api.createDailyReport(selectedProject);
      setMessage('Daily report generated');
      loadReports(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const runAudit = async () => {
    try {
      await api.runAudit(selectedProject);
      setMessage('Audit run completed');
      loadReports(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Reports</h2>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadReports(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProject && (
          <>
            <button onClick={genDaily}>Generate Daily Report</button>
            <button onClick={runAudit}>Run Weekly Audit</button>
          </>
        )}
      </div>

      <h3>Daily Reports</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td>{r.title}</td>
              <td>{r.status}</td>
              <td>{r.created_at}</td>
            </tr>
          ))}
          {reports.length === 0 && (
            <tr>
              <td colSpan="3">No daily reports</td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Audit Runs</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Started</th>
            <th>Finished</th>
          </tr>
        </thead>
        <tbody>
          {auditRuns.map((a) => (
            <tr key={a.id}>
              <td>{a.status}</td>
              <td>{a.started_at}</td>
              <td>{a.finished_at}</td>
            </tr>
          ))}
          {auditRuns.length === 0 && (
            <tr>
              <td colSpan="3">No audit runs</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
