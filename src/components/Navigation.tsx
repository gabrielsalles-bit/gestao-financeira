'use client';

import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  PieChart,
  Landmark,
  Sparkles,
  Settings,
  Eye,
  EyeOff,
  Bell,
  CheckCircle2,
  RefreshCw,
  Plus,
  Heart
} from 'lucide-react';

export type TabType = 'dashboard' | 'extract' | 'reports' | 'openfinance' | 'tips' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenNewTransaction: () => void;
  userName: string;
  hideValues: boolean;
  onToggleHideValues: () => void;
  hasAlerts: boolean;
  onOpenAlerts: () => void;
  onQuickSync: () => void;
  isSyncing: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onOpenNewTransaction,
  userName,
  hideValues,
  onToggleHideValues,
  hasAlerts,
  onOpenAlerts,
  onQuickSync,
  isSyncing,
}) => {
  const navItems: { id: TabType; label: string; shortLabel: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Início', shortLabel: 'Início', icon: LayoutDashboard },
    { id: 'extract', label: 'Extrato', shortLabel: 'Extrato', icon: Receipt },
    { id: 'reports', label: 'Análise', shortLabel: 'Análise', icon: PieChart },
    { id: 'openfinance', label: 'Nubank Sync', shortLabel: 'Nubank', icon: Landmark },
    { id: 'tips', label: 'Saúde & Dicas', shortLabel: 'Saúde', icon: Sparkles },
    { id: 'settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings },
  ];

  return (
    <>
      {/* Top Header Bar (Desktop & Tablet) */}
      <header className="bg-white border-b border-gray-100 py-3.5 px-6 sticky top-0 z-40 shadow-sm/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          
          {/* Left Brand: Gestão da Livinha - Feito por Mozão */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand to-purple-400 text-white flex items-center justify-center font-extrabold text-base shadow-md">
                L
              </div>
              <div>
                <span className="text-[11px] font-black tracking-wider text-gray-900 uppercase block leading-none">
                  GESTÃO DA LIVINHA
                </span>
                <span className="text-[11px] font-bold text-brand flex items-center gap-1 mt-1 leading-tight">
                  Feito por Mozão <Heart size={12} className="fill-brand text-brand inline" />
                </span>
              </div>
            </div>

            {/* Live Auto-Sync Status Badge */}
            <button
              onClick={onQuickSync}
              disabled={isSyncing}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-semibold hover:bg-emerald-100 transition-all cursor-pointer"
              title="Clique para sincronizar lançamentos do Nubank agora"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="whitespace-nowrap">
                {isSyncing ? 'Sincronizando Nubank...' : 'Nubank Conectado (100% Automático)'}
              </span>
              <RefreshCw size={12} className={`ml-1 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Center Tabs Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-gray-50/80 p-1 rounded-2xl border border-gray-200/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-obsidian text-white shadow-sm font-bold'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-brand-light' : 'text-gray-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Utilities */}
          <div className="flex items-center gap-2">
            {/* Toggle Privacy */}
            <button
              onClick={onToggleHideValues}
              className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-all border border-gray-200/60"
              title={hideValues ? 'Mostrar Valores' : 'Ocultar Valores'}
            >
              {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            {/* Notifications */}
            <button
              onClick={onOpenAlerts}
              className="relative p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-all border border-gray-200/60"
              title="Central de Avisos"
            >
              <Bell size={16} />
              {hasAlerts && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-traffic-red rounded-full ring-2 ring-white animate-pulse"></span>
              )}
            </button>

            {/* Optional Manual Add */}
            <button
              onClick={onOpenNewTransaction}
              className="p-2 rounded-xl bg-gray-50 hover:bg-purple-50 text-gray-600 hover:text-brand transition-all border border-gray-200/60"
              title="Adicionar Lançamento Manual (Opcional)"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Floating Navigation for Mobile */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 md:hidden bg-obsidian/95 backdrop-blur-md border border-obsidian-border rounded-2xl py-2 px-2 shadow-obsidian max-w-[95vw] w-full flex items-center justify-around gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all min-w-0 flex-1 ${
                isActive ? 'text-brand-light font-bold scale-105' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={17} />
              <span className="text-[10px] leading-tight whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}
        {/* Quick Add Button in Mobile Nav */}
        <button
          onClick={onOpenNewTransaction}
          className="flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all text-brand-light hover:text-brand"
          title="Adicionar Lançamento"
        >
          <div className="w-8 h-8 rounded-xl bg-brand flex items-center justify-center shadow-sm">
            <Plus size={16} className="text-white" />
          </div>
          <span className="text-[10px] leading-tight">Add</span>
        </button>
      </nav>
    </>
  );
};
