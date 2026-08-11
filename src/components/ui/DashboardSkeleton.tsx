import React from 'react';

export const DashboardSkeleton: React.FC = () => (
  <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 pt-6 space-y-8 animate-pulse">
    <div className="h-56 rounded-3xl bg-gray-200/70" />
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-gray-200/70" />
      ))}
    </div>
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl bg-gray-200/70" />
      ))}
    </div>
  </div>
);
