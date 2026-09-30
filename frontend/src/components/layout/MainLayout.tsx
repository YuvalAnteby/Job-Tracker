import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShieldAlert,
  Settings,
  PlusCircle,
  Briefcase,
  Menu,
  X,
  Columns3,
  BookOpen,
  ListChecks,
  ChartNoAxesCombined,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { AddJobModal } from '../dashboard/AddJobModal';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Pipeline', href: '/pipeline', icon: Columns3 },
    { name: 'Skills', href: '/skills', icon: BookOpen },
    { name: 'Roadmap', href: '/roadmap', icon: ListChecks },
    { name: 'Analytics', href: '/analytics', icon: ChartNoAxesCombined },
    { name: 'Gap Summary', href: '/gap', icon: ShieldAlert },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="w-full px-3 sm:px-6 lg:px-12">
          <div className="flex justify-between h-16 items-center">
            {/* Logo and Mobile Menu Button */}
            <div className="flex min-w-0 items-center space-x-2 sm:space-x-4">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-controls="main-navigation"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:hover:bg-slate-800 xl:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="block h-6 w-6" aria-hidden="true" />
                ) : (
                  <Menu className="block h-6 w-6" aria-hidden="true" />
                )}
              </button>
              <div className="flex min-w-0 items-center space-x-2">
                <Briefcase className="h-8 w-8 text-blue-600 dark:text-blue-500" />
                <span className="hidden truncate text-xl font-bold text-gray-900 dark:text-white sm:block">
                  Job Tracker
                </span>
              </div>
            </div>

            <nav className="hidden min-w-0 items-center space-x-3 xl:flex">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center whitespace-nowrap border-b-2 px-1 pt-1 text-sm font-medium transition-colors',
                      isActive
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700 hover:text-gray-700 dark:hover:text-slate-200',
                    )}
                  >
                    <item.icon className="mr-1.5 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center space-x-2 sm:space-x-4">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-transparent bg-blue-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 sm:px-4"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add Job</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          id="main-navigation"
          hidden={!isMobileMenuOpen}
          className="border-t border-gray-200 dark:border-slate-800 xl:hidden"
        >
            <nav className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      'flex min-h-11 items-center rounded-md px-3 py-2 text-base font-medium',
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-slate-800',
                    )}
                  >
                    <item.icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
        </div>
      </header>

      <main className="min-w-0 flex-1 w-full px-3 py-5 text-gray-900 dark:text-slate-200 sm:px-6 sm:py-8 lg:px-12">
        {children}
      </main>

      <AddJobModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      <footer className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Job Tracker &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
};
