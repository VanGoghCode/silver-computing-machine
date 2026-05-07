import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';

export default function ProjectDetail() {
  const { projectId } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.listArtifacts(projectId).catch(() => ({ artifacts: [] })),
      api.listTasks(projectId).catch(() => ({ tasks: [] })),
      api.listAgents().catch(() => ({ agents: [] })),
      api.getAlignmentStatus(projectId).catch(() => ({ can_create_engineering_tasks: false })),
    ])
      .then(([artifacts, tasks, agents, status]) => {
        setInfo({
          artifacts: artifacts.artifacts || [],
          tasks: tasks.tasks || [],
          agents: (agents.agents || []).filter((a) => a.project_id === projectId),
          status,
        });
      })
      .catch((e) => setError(e.message));
  }, [projectId]);

  if (!info) return <div>Loading...</div>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <h2>Project: {projectId}</h2>
      <div className="grid-3">
        <div className="card">
          <h3>Alignment Status</h3>
          <p>
            Can create engineering tasks:{' '}
            <strong>{info.status.can_create_engineering_tasks ? 'Yes' : 'No'}</strong>
          </p>
        </div>
        <div className="card">
          <h3>Artifacts</h3>
          <p>{info.artifacts.length} artifacts</p>
        </div>
        <div className="card">
          <h3>Tasks</h3>
          <p>{info.tasks.length} tasks</p>
        </div>
      </div>
      <h3>Agents</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Worker Status</th>
          </tr>
        </thead>
        <tbody>
          {info.agents.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.status}</td>
              <td>{a.worker_status || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
