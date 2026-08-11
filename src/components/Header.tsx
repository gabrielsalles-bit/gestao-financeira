'use client';

import React from 'react';
import { Bell, Eye, EyeOff, Sparkles, UploadCloud } from 'lucide-react';
import { UserPreferences } from '@/types/finance';

interface HeaderProps {
  userPrefs: UserPreferences;
  onToggleHideValues: () => void;
  onOpenImporter: () => void;
  hasAlerts: boolean;
  onOpenAlerts: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  userPrefs,
  onToggleHideValues,
  onOpenImporter,
  hasAlerts,
  onOpenAlerts,
}) => {
  return (
    <header className="flex items-center justify-between py-4 px-1">
      {/* User Info & Greeting */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-brand to-purple-400 p-0.5 shadow-sm">
            <div className="w-full h-full rounded-full bg-white flex items-center justify-center font-bold text-brand text-base uppercase">
              {userPrefs.userName.slice(0, 2)}
            </div>
          </div>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
        </div>
        <div>
          <h1 className="text-xs uppercase tracking-wider font-semibold text-gray-500 flex items-center gap-1">
            OLÁ, {userPrefs.userName.toUpperCase()}!
            <Sparkles size={12} className="text-amber-400 fill-amber-400 inline" />
          </h1>
          <p className="text-sm font-medium text-gray-800">Vamos organizar suas finanças?</p>
        </div>
      </div>

      {/* Action Icons */}
      <div className="flex items-center gap-2">
        {/* Toggle Privacy */}
        <button
          onClick={onToggleHideValues}
          title={userPrefs.hideValues ? 'Mostrar Valores' : 'Ocultar Valores'}
          className="p-2.5 rounded-full bg-white text-gray-600 hover:text-brand hover:bg-purple-50 transition-all border border-gray-100 shadow-sm"
        >
          {userPrefs.hideValues ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>

        {/* CSV Import */}
        <button
          onClick={onOpenImporter}
          title="Importar Transações (CSV/Excel)"
          className="p-2.5 rounded-full bg-white text-gray-600 hover:text-brand hover:bg-purple-50 transition-all border border-gray-100 shadow-sm"
        >
          <UploadCloud size={18} />
        </button>

        {/* Notifications / Alerts */}
        <button
          onClick={onOpenAlerts}
          title="Central de Avisos"
          className="relative p-2.5 rounded-full bg-white text-gray-600 hover:text-brand hover:bg-purple-50 transition-all border border-gray-100 shadow-sm"
        >
          <Bell size={18} />
          {hasAlerts && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-traffic-red rounded-full ring-2 ring-white animate-pulse"></span>
          )}
        </button>
      </div>
    </header>
  );
};
