'use client';

import React from 'react';
import {
  ShoppingBag,
  Home,
  Zap,
  Gift,
  Car,
  HeartPulse,
  Utensils,
  Tag,
  Plus,
  SlidersHorizontal,
  LucideIcon
} from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, getSemaphoreColor } from '@/utils/formatters';

interface CategoryNicheGridProps {
  categories: Category[];
  transactions: Transaction[];
  selectedCategoryId: string | null;
  hideValues: boolean;
  onSelectCategory: (id: string | null) => void;
  onOpenManageCategories: () => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  ShoppingBag,
  Home,
  Zap,
  Gift,
  Car,
  HeartPulse,
  Utensils,
  Tag,
};

export const CategoryNicheGrid: React.FC<CategoryNicheGridProps> = ({
  categories,
  transactions,
  selectedCategoryId,
  hideValues,
  onSelectCategory,
  onOpenManageCategories,
}) => {
  const getCategorySpent = (categoryId: string): number => {
    return transactions
      .filter((t) => t.categoryId === categoryId && t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  return (
    <section className="my-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-brand" />
            NICHOS DE GASTOS (ENVELOPES DA PLANILHA)
          </h3>
        </div>
        <button
          onClick={onOpenManageCategories}
          className="text-xs font-bold text-brand hover:text-brand-dark flex items-center gap-1 transition-colors bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100"
        >
          <Plus size={14} />
          Gerenciar Nichos
        </button>
      </div>

      {/* Grid of Envelope Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
        {/* All items selector card */}
        <button
          onClick={() => onSelectCategory(null)}
          className={`p-4 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between ${
            selectedCategoryId === null
              ? 'bg-obsidian text-white border-obsidian shadow-md ring-2 ring-purple-500/30'
              : 'bg-white text-gray-700 border-gray-100 hover:border-gray-200 shadow-sm'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold">Todos os Gastos</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 font-semibold">
              {transactions.filter((t) => t.type === 'EXPENSE').length} itens
            </span>
          </div>
          <p className="text-[11px] opacity-70">Visualizar extrato consolidado</p>
        </button>

        {/* Niche Envelope Cards */}
        {categories.map((cat) => {
          const spent = getCategorySpent(cat.id);
          const percentage = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
          const semaph = getSemaphoreColor(percentage);
          const IconComponent = ICON_MAP[cat.icon] || Tag;
          const isSelected = selectedCategoryId === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(isSelected ? null : cat.id)}
              className={`p-4 rounded-2xl text-left border transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                isSelected
                  ? 'bg-obsidian text-white border-obsidian shadow-md ring-2 ring-purple-500/30'
                  : 'bg-white text-gray-800 border-gray-100 hover:border-purple-200 shadow-sm'
              }`}
            >
              {/* Header: Icon & Category Name */}
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'bg-white/10 text-white'
                      : 'bg-purple-50 text-brand border border-purple-100'
                  }`}
                >
                  <IconComponent size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate leading-tight">{cat.name}</h4>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                      isSelected
                        ? 'bg-white/10 text-purple-200'
                        : `${semaph.colorBg} ${semaph.colorText}`
                    }`}
                  >
                    {semaph.label}
                  </span>
                </div>
              </div>

              {/* AmountSpent vs Limit */}
              <div className="mt-auto">
                <div className="flex items-baseline justify-between text-xs font-bold mb-1.5">
                  <span className={isSelected ? 'text-white' : 'text-gray-900'}>
                    {formatCurrency(spent, hideValues)}
                  </span>
                  <span className={isSelected ? 'text-gray-400 text-[10px]' : 'text-gray-400 text-[10px]'}>
                    / {formatCurrency(cat.monthlyLimit, hideValues)}
                  </span>
                </div>

                {/* Semaphore Progress Bar */}
                <div
                  className={`w-full h-1.5 rounded-full overflow-hidden ${
                    isSelected ? 'bg-white/10' : 'bg-gray-100'
                  }`}
                >
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSelected ? 'bg-brand-light' : semaph.colorBar
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, percentage))}%` }}
                  ></div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
