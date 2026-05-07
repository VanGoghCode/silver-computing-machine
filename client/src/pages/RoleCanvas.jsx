import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function RoleCanvas() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [error, setError] = useState('');
  const [editNode, setEditNode] = useState(null);
  const [editEdge, setEditEdge] = useState(null);

  useEffect(() => {
    api
      .listProjects()
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
    api
      .listRoleTemplates()
      .then((d) => setTemplates(d.role_templates || []))
      .catch(() => {});
  }, []);

  const loadCanvas = async (projectId) => {
    setSelectedProject(projectId);
    if (!projectId) {
      setNodes([]);
      setEdges([]);
      return;
    }
    try {
      const [n, e] = await Promise.all([
        api.listRoleNodes(projectId),
        api.listRoleEdges(projectId),
      ]);
      setNodes(n.role_nodes || []);
      setEdges(e.role_edges || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const addNode = async () => {
    const tmpl = templates[0];
    if (!tmpl) return;
    try {
      await api.createRoleNode(selectedProject, {
        role_template_id: tmpl.id,
        display_name: tmpl.display_name,
        department_id: nodes[0]?.department_id,
        canvas_x: Math.random() * 400,
        canvas_y: Math.random() * 400,
      });
      loadCanvas(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const saveNode = async (nodeId, data) => {
    try {
      await api.updateRoleNode(selectedProject, nodeId, data);
      loadCanvas(selectedProject);
      setEditNode(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeNode = async (nodeId) => {
    try {
      await api.deleteRoleNode(selectedProject, nodeId);
      loadCanvas(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const addEdge = async () => {
    if (nodes.length < 2) return;
    try {
      await api.createRoleEdge(selectedProject, {
        from_node_id: nodes[0].id,
        to_node_id: nodes[1].id,
        direction: 'bidirectional',
        can_message: 1,
        can_assign_task: 0,
        can_escalate: 0,
        can_share_context: 1,
        can_request_approval: 0,
        requires_approval: 0,
      });
      loadCanvas(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  const saveEdge = async (edgeId, data) => {
    try {
      await api.updateRoleEdge(selectedProject, edgeId, data);
      loadCanvas(selectedProject);
      setEditEdge(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeEdge = async (edgeId) => {
    try {
      await api.deleteRoleEdge(selectedProject, edgeId);
      loadCanvas(selectedProject);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Role Canvas</h2>
      {error && <p className="error">{error}</p>}
      <div className="form-row">
        <select value={selectedProject} onChange={(e) => loadCanvas(e.target.value)}>
          <option value="">Select project...</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedProject && (
          <>
            <button onClick={addNode}>Add Role Node</button>
            <button onClick={addEdge}>Add Edge</button>
          </>
        )}
      </div>

      <h3>Nodes ({nodes.length})</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {nodes.map((n) => (
          <div key={n.id} className="card" style={{ width: '200px' }}>
            <strong>{n.display_name}</strong>
            <p style={{ fontSize: '0.75rem' }}>
              x: {n.canvas_x} y: {n.canvas_y}
            </p>
            {editNode === n.id ? (
              <div>
                <input
                  placeholder="Display name"
                  defaultValue={n.display_name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNode(n.id, { display_name: e.target.value });
                  }}
                />
                <input
                  placeholder="canvas_x"
                  type="number"
                  defaultValue={n.canvas_x}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNode(n.id, { canvas_x: parseInt(e.target.value) });
                  }}
                />
                <input
                  placeholder="canvas_y"
                  type="number"
                  defaultValue={n.canvas_y}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveNode(n.id, { canvas_y: parseInt(e.target.value) });
                  }}
                />
                <button onClick={() => setEditNode(null)}>Cancel</button>
              </div>
            ) : (
              <div className="form-row">
                <button onClick={() => setEditNode(n.id)}>Edit</button>
                <button onClick={() => removeNode(n.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <h3>Edges ({edges.length})</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>From</th>
            <th>To</th>
            <th>Direction</th>
            <th>Permissions</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {edges.map((e) => (
            <tr key={e.id}>
              <td>{e.from_node_id?.substring(0, 8)}</td>
              <td>{e.to_node_id?.substring(0, 8)}</td>
              <td>{e.direction}</td>
              <td>
                {editEdge === e.id ? (
                  <div>
                    {[
                      'can_message',
                      'can_assign_task',
                      'can_escalate',
                      'can_share_context',
                      'can_request_approval',
                      'requires_approval',
                    ].map((p) => (
                      <label key={p} style={{ fontSize: '0.7rem', marginRight: '4px' }}>
                        <input
                          type="checkbox"
                          defaultChecked={e[p]}
                          onChange={(ev) => {
                            const updates = { [p]: ev.target.checked ? 1 : 0 };
                            saveEdge(e.id, updates);
                          }}
                        />
                        {p.replace('can_', '').replace(/_/g, ' ')}
                      </label>
                    ))}
                    <button onClick={() => setEditEdge(null)}>Done</button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.7rem' }}>
                    {e.can_message ? 'msg ' : ''}
                    {e.can_assign_task ? 'assign ' : ''}
                    {e.can_escalate ? 'esc ' : ''}
                    {e.can_share_context ? 'ctx ' : ''}
                    {e.can_request_approval ? 'appr ' : ''}
                    {e.requires_approval ? 'reqappr ' : ''}
                  </span>
                )}
              </td>
              <td>
                <button onClick={() => setEditEdge(editEdge === e.id ? null : e.id)}>Edit</button>
                <button onClick={() => removeEdge(e.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {edges.length === 0 && (
            <tr>
              <td colSpan="5">No edges</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
