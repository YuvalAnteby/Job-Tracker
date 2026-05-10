import React from 'react';
import { cn } from '../../utils/cn';
import { Domain, JobStatus } from '../../types';
import { Pencil } from 'lucide-react';

interface ScoreBadgeProps {
  score: number;
  hasOverride?: boolean;
  size?: 'sm' | 'lg';
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, hasOverride, size = 'sm' }) => {
  const bgColor = score >= 70 
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
    : score >= 50 
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' 
      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';

  return (
    <span className={cn(
      "inline-flex items-center rounded-full font-bold",
      size === 'sm' ? "px-2.5 py-0.5 text-xs" : "px-4 py-2 text-xl",
      bgColor
    )}>
      {score}
      {hasOverride && <Pencil className={cn("ml-1", size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />}
    </span>
  );
};

export const DomainTag: React.FC<{ domain: Domain }> = ({ domain }) => {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      {domain}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => {
  const colors = {
    [JobStatus.ACTIVE]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    [JobStatus.INACTIVE]: 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-400',
    [JobStatus.APPLIED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    [JobStatus.DELETED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
      colors[status]
    )}>
      {status}
    </span>
  );
};
