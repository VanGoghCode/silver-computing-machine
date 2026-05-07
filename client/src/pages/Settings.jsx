import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Settings() {
  const [modelProfiles, setModelProfiles] = useState([]);
  const [permissionProfiles, setPermissionProfiles] = useState([]);
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.listModelProfiles().catch(() => ({ model_profiles: [] })),
      api.listPermissionProfiles().catch(() => ({ permission_profiles: [] })),
      api.listRoleTemplates().catch(() => ({ role_templates: [] })),
    ])
      .then(([mp, pp, rt]) => {
        setModelProfiles(mp.model_profiles || []);
        setPermissionProfiles(pp.permission_profiles || []);
        setRoleTemplates(rt.role_templates || []);
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>Settings / Model Profiles / Role Library</h2>
      {error && <p className="error">{error}</p>}

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
              <td>{m.model_name}</td>
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
