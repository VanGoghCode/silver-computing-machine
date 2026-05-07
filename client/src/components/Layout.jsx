import { NavLink, Outlet } from 'react-router-dom';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/', label: 'Projects' },
  { to: '/intake', label: 'Human Intake' },
  { to: '/alignment', label: 'Alignment Sessions' },
  { to: '/questions', label: 'Questions & Answers' },
  { to: '/documents', label: 'Documents' },
  { to: '/document-sets', label: 'Document Sets' },
  { to: '/agents', label: 'Agents' },
  { to: '/kanban', label: 'Kanban' },
  { to: '/role-canvas', label: 'Role Canvas' },
  { to: '/conversations', label: 'Conversations' },
  { to: '/local-prs', label: 'Local PRs' },
  { to: '/reports', label: 'Reports' },
  { to: '/graphify', label: 'Graphify' },
  { to: '/settings', label: 'Settings' },
];

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1 className="sidebar-title">Silver v1</h1>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
