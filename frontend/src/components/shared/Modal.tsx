import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const requestClose = (): void => {
    onClose();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    }

    if (!isOpen && dialog.open) {
      dialog.close();
    }

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      hidden={!isOpen}
      aria-labelledby={titleId}
      className={cn(
        'm-auto flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col overflow-hidden rounded-xl border-0 bg-white p-0 text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.1)] backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:bg-slate-950 dark:text-slate-200 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)]',
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-slate-800 sm:px-6 sm:py-4">
        <h3
          id={titleId}
          className="min-w-0 pr-3 text-lg font-bold text-gray-900 dark:text-white sm:text-xl"
        >
          {title}
        </h3>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={requestClose}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {children}
      </div>
    </dialog>
  );
};
