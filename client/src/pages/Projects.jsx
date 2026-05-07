import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch((e) => setError(e.message));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.createProject({ name, slug: slug || name.toLowerCase().replace(/\s+/g, '-') });
      const d = await api.listProjects();
      setProjects(d.projects || []);
      setName('');
      setSlug('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Projects</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={create} className="form-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project name"
          required
        />
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Slug (optional)"
        />
        <button type="submit">Create Project</button>
      </form>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.slug}</td>
              <td>{p.status}</td>
              <td>
                <button onClick={() => navigate(`/project/${p.id}`)}>Open</button>
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan="4">No projects yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
