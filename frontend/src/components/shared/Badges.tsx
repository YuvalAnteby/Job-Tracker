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
  const color = score >= 70
    ? 'text-green-600 dark:text-green-400'
    : score >= 50 
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-500 dark:text-red-500';

  return (
    <span className={cn(
      "inline-flex items-center font-bold tracking-tight",
      size === 'sm' ? "text-sm" : "text-2xl",
      color
    )}>
      {score}
      {hasOverride && <Pencil className={cn("ml-1 opacity-50", size === 'sm' ? "h-3 w-3" : "h-5 w-5")} />}
    </span>
  );
};

export const DomainTag: React.FC<{ domain: Domain }> = ({ domain }) => {
  return (
    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
      {domain}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: JobStatus }> = ({ status }) => {
  return (
    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
      {status}
    </span>
  );
};
