import { useState, useEffect } from 'react';
import { api } from '../api/client';

const COLUMNS = ['backlog', 'ready', 'assigned', 'in_progress', 'review', 'testing', 'done'];

export default function Kanban() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const loadTasks = async (projectId) => {
    setSelectedProject(projectId);
    if (!projectId) return setTasks([]);
    try {
      const d = await api.listTasks(projectId);
      setTasks(d.tasks || []);
    } catch (e) {
      setError(e.message);
    }
  };

  const createTask = async (e) => {
    e.preventDefault();
    try {
      await api.createTask({
        project_id: selectedProject,
        title: newTitle,
        lifecycle_stage: 'mvp',
        priority: 'medium',
      });
      setNewTitle('');
      loadTasks(selectedProject);
    } catch (err) {
      setError(err.message);
    }
  };

  const moveTask = async (taskId, toStatus) => {
    try {
      await api.moveTask(taskId, { status: toStatus });
      loadTasks(selectedProject);
    } catch (err) {
      setError(err.message);
    }
  };

  const tasksByStatus = (status) => tasks.filter((t) => t.status === status);

  return (
    <div>
      <h2>Kanban Board</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadTasks(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      {selectedProject && (
        <form onSubmit={createTask} className="form-row">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New task title"
            required
          />
          <button type="submit">Add Task</button>
        </form>
      )}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
        {COLUMNS.map((col) => (
          <div
            key={col}
            style={{
              minWidth: '180px',
              flex: 1,
              background: '#fff',
              borderRadius: '6px',
              padding: '8px',
            }}
          >
            <h4 style={{ margin: '0 0 8px', textTransform: 'capitalize' }}>
              {col.replace('_', ' ')} ({tasksByStatus(col).length})
            </h4>
            {tasksByStatus(col).map((t) => (
              <div key={t.id} className="kanban-card">
                <p style={{ margin: '0 0 4px', fontWeight: 'bold' }}>{t.title}</p>
                <p style={{ margin: 0, fontSize: '0.75rem' }}>{t.priority}</p>
                <select
                  value={t.status}
                  onChange={(e) => moveTask(t.id, e.target.value)}
                  style={{ marginTop: '4px', fontSize: '0.7rem' }}
                >
                  {COLUMNS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
