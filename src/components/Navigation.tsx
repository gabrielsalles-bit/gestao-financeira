// src/components/Navigation.tsx
'use client';

import React from 'react';
import {
  LayoutDashboard, Receipt, PieChart, Settings, Eye, EyeOff, Bell, Plus, Heart,
  Cloud, CloudOff, RefreshCw,
} from 'lucide-react';
import { SyncState } from '@/services/storage';

export type TabType = 'dashboard' | 'extract' | 'analysis' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onOpenNewTransaction: () => void;
  hideValues: boolean;
  onToggleHideValues: () => void;
  hasAlerts: boolean;
  onOpenAlerts: () => void;
  syncState: SyncState;
}

const SYNC_LABEL: Record<SyncState, string> = {
  synced: 'Sincronizado',
  syncing: 'Sincronizando...',
  offline: 'Offline — dados salvos localmente',
};

const SyncIndicator: React.FC<{ syncState: SyncState }> = ({ syncState }) => {
  const Icon = syncState === 'offline' ? CloudOff : syncState === 'syncing' ? RefreshCw : Cloud;
  const colorClass =
    syncState === 'offline'
      ? 'bg-amber-50 text-amber-700 border-amber-200/60'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
  return (
    <div
      className={`hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold ${colorClass}`}
      title={SYNC_LABEL[syncState]}
    >
      <Icon size={12} className={syncState === 'syncing' ? 'animate-spin' : ''} />
      <span className="whitespace-nowrap">{SYNC_LABEL[syncState]}</span>
    </div>
  );
};

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onOpenNewTransaction,
  hideValues,
  onToggleHideValues,
  hasAlerts,
  onOpenAlerts,
  syncState,
}) => {
  const navItems: { id: TabType; label: string; shortLabel: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Início', shortLabel: 'Início', icon: LayoutDashboard },
    { id: 'extract', label: 'Extrato', shortLabel: 'Extrato', icon: Receipt },
    { id: 'analysis', label: 'Análise', shortLabel: 'Análise', icon: PieChart },
    { id: 'settings', label: 'Ajustes', shortLabel: 'Ajustes', icon: Settings },
  ];

  return (
    <>
      {/* Top Header Bar (Desktop & Tablet) */}
      <header className="bg-white border-b border-gray-100 py-3.5 px-6 sticky top-0 z-40 shadow-sm/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
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

            <SyncIndicator syncState={syncState} />
          </div>

          <nav className="hidden md:flex items-center gap-1 bg-gray-50/80 p-1 rounded-2xl border border-gray-200/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive ? 'bg-obsidian text-white shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-brand-light' : 'text-gray-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleHideValues}
              className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 transition-all border border-gray-200/60"
              title={hideValues ? 'Mostrar Valores' : 'Ocultar Valores'}
            >
              {hideValues ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

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

            {/* Ação primária: sem automação, este é o único jeito de lançar um gasto */}
            <button
              onClick={onOpenNewTransaction}
              className="flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Novo Lançamento</span>
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
