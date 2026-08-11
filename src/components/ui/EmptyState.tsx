import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-3xl bg-white border border-dashed border-gray-200">
    <div className="w-14 h-14 rounded-2xl bg-purple-50 text-brand flex items-center justify-center mb-4">
      <Icon size={26} />
    </div>
    <h3 className="text-sm font-bold text-gray-900">{title}</h3>
    <p className="text-xs text-gray-500 mt-1.5 max-w-xs">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all"
      >
        <Plus size={14} />
        {actionLabel}
      </button>
    )}
  </div>
);
