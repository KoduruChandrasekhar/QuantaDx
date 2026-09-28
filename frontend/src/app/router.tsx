import { lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { usePipeline } from '@/store';
import { AppShell } from './AppShell';

const Home = lazy(() => import('@/pages/Home'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Data = lazy(() => import('@/pages/Data'));
const Preprocess = lazy(() => import('@/pages/Preprocess'));
const Architecture = lazy(() => import('@/pages/Architecture'));
const Models = lazy(() => import('@/pages/Models'));
const Train = lazy(() => import('@/pages/Train'));
const Results = lazy(() => import('@/pages/Results'));
const Explain = lazy(() => import('@/pages/Explain'));
const Predict = lazy(() => import('@/pages/Predict'));
const Experiments = lazy(() => import('@/pages/Experiments'));
const ApiConsole = lazy(() => import('@/pages/ApiConsole'));
const Deliverables = lazy(() => import('@/pages/Deliverables'));
const Lab = lazy(() => import('@/pages/Lab'));
const Docs = lazy(() => import('@/pages/Docs'));
const Settings = lazy(() => import('@/pages/Settings'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function ActiveRedirect({ to }: { to: 'train' | 'results' | 'explain' }) {
  const id = usePipeline((s) => s.activeExperimentId);
  return <Navigate to={`/experiments/${id}/${to}`} replace />;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/data', element: <Data /> },
      { path: '/preprocess', element: <Preprocess /> },
      { path: '/architecture', element: <Architecture /> },
      { path: '/models', element: <Models /> },
      { path: '/train', element: <ActiveRedirect to="train" /> },
      { path: '/results', element: <ActiveRedirect to="results" /> },
      { path: '/explain', element: <ActiveRedirect to="explain" /> },
      { path: '/experiments', element: <Experiments /> },
      { path: '/experiments/:id/train', element: <Train /> },
      { path: '/experiments/:id/results', element: <Results /> },
      { path: '/experiments/:id/explain', element: <Explain /> },
      { path: '/predict', element: <Predict /> },
      { path: '/api', element: <ApiConsole /> },
      { path: '/deliverables', element: <Deliverables /> },
      { path: '/lab', element: <Lab /> },
      { path: '/docs', element: <Docs /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
