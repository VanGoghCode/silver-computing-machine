import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Agents() {
  const [agents, setAgents] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .listAgents()
      .then((d) => setAgents(d.agents || []))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Agents</h2>
      {error && <p className="error">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Project</th>
            <th>Status</th>
            <th>Worker Status</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.project_id}</td>
              <td>{a.status}</td>
              <td>{a.worker_status || 'N/A'}</td>
            </tr>
          ))}
          {agents.length === 0 && (
            <tr>
              <td colSpan="4">No agents</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
