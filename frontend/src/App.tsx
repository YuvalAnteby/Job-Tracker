import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { MainLayout } from './components/layout/MainLayout';

import { Dashboard } from './pages/Dashboard';

// Placeholder components for routes
const JobDetail = () => <div className="text-2xl font-bold">Job Detail</div>;
const GapSummary = () => <div className="text-2xl font-bold">Skill Gap Summary</div>;
const Settings = () => <div className="text-2xl font-bold">Settings</div>;
const NotFound = () => <div className="text-2xl font-bold">404 - Not Found</div>;

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
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs/:id" element={<JobDetail />} />
            <Route path="/gap" element={<GapSummary />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
        <Toaster position="bottom-right" />
      </BrowserRouter>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
