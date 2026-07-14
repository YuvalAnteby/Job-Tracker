import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { MainLayout } from './components/layout/MainLayout';

import { Dashboard } from './pages/Dashboard';
import GapSummary from './pages/GapSummary/GapSummary';
import Settings from './pages/Settings/Settings';
import Pipeline from './pages/Pipeline/Pipeline';
import Skills from './pages/Skills/Skills';
import Roadmap from './pages/Roadmap/Roadmap';
import Analytics from './pages/Analytics/Analytics';

// Placeholder components for routes
const JobDetail = () => <div className="text-2xl font-bold">Job Detail</div>;
const NotFound = () => (
  <div className="text-2xl font-bold">404 - Not Found</div>
);

const router = createBrowserRouter([
  {
    element: (
      <MainLayout>
        <Outlet />
      </MainLayout>
    ),
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/jobs/:id', element: <JobDetail /> },
      { path: '/gap', element: <GapSummary /> },
      { path: '/pipeline', element: <Pipeline /> },
      { path: '/skills', element: <Skills /> },
      { path: '/roadmap', element: <Roadmap /> },
      { path: '/analytics', element: <Analytics /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
