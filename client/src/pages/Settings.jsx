import { useState, useEffect } from 'react';
import { api, getAuthToken, setAuthToken } from '../api/client';

export default function Settings() {
  const [modelProfiles, setModelProfiles] = useState([]);
  const [permissionProfiles, setPermissionProfiles] = useState([]);
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [token, setToken] = useState(getAuthToken());
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.listModelProfiles().catch(() => ({ profiles: [] })),
      api.listPermissionProfiles().catch(() => ({ profiles: [] })),
      api.listRoleTemplates().catch(() => ({ templates: [] })),
    ])
      .then(([mp, pp, rt]) => {
        setModelProfiles(mp.profiles || mp.model_profiles || []);
        setPermissionProfiles(pp.profiles || pp.permission_profiles || []);
        setRoleTemplates(rt.templates || rt.role_templates || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  const saveToken = (e) => {
    e.preventDefault();
    setAuthToken(token);
    window.location.reload();
  };

  return (
    <div>
      <h2>Settings / Model Profiles / Role Library</h2>
      {error && <p className="error">{error}</p>}

      <h3>Agent Token</h3>
      <form onSubmit={saveToken} className="form-row">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Bearer token"
          type="password"
        />
        <button type="submit">Save Token</button>
        <button
          type="button"
          onClick={() => {
            setToken('');
            setAuthToken('');
            window.location.reload();
          }}
        >
          Clear
        </button>
      </form>

      <h3>Model Profiles</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Provider</th>
            <th>Model</th>
            <th>Purpose</th>
          </tr>
        </thead>
        <tbody>
          {modelProfiles.map((m) => (
            <tr key={m.id}>
              <td>{m.key}</td>
              <td>{m.provider}</td>
              <td>{m.model}</td>
              <td>{m.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Permission Profiles</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {permissionProfiles.map((p) => (
            <tr key={p.id}>
              <td>{p.key}</td>
              <td>{p.display_name}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Role Templates</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Display Name</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {roleTemplates.map((r) => (
            <tr key={r.id}>
              <td>{r.key}</td>
              <td>{r.display_name}</td>
              <td>{r.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
