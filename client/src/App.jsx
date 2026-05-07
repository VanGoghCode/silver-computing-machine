import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import HumanIntake from './pages/HumanIntake';
import AlignmentSessions from './pages/AlignmentSessions';
import Questions from './pages/Questions';
import Documents from './pages/Documents';
import DocumentSets from './pages/DocumentSets';
import Agents from './pages/Agents';
import Kanban from './pages/Kanban';
import RoleCanvas from './pages/RoleCanvas';
import Conversations from './pages/Conversations';
import LocalPrs from './pages/LocalPrs';
import Reports from './pages/Reports';
import Graphify from './pages/Graphify';
import Settings from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Projects />} />
          <Route path="project/:projectId" element={<ProjectDetail />} />
          <Route path="intake" element={<HumanIntake />} />
          <Route path="alignment" element={<AlignmentSessions />} />
          <Route path="questions" element={<Questions />} />
          <Route path="documents" element={<Documents />} />
          <Route path="document-sets" element={<DocumentSets />} />
          <Route path="agents" element={<Agents />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="role-canvas" element={<RoleCanvas />} />
          <Route path="conversations" element={<Conversations />} />
          <Route path="local-prs" element={<LocalPrs />} />
          <Route path="reports" element={<Reports />} />
          <Route path="graphify" element={<Graphify />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
