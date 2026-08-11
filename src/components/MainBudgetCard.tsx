'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Smile, AlertTriangle, AlertCircle, Check, X, DollarSign } from 'lucide-react';
import { formatCurrency, getMonthName } from '@/utils/formatters';
import { FinancialHealth } from '@/types/finance';

interface MainBudgetCardProps {
  currentMonth: number; // 0-11
  currentYear: number;
  availableBudget: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  monthlyBalance: number;
  finalBalance: number;
  totalLimit: number;
  hideValues: boolean;
  health: FinancialHealth;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onOpenCategoriesModal: () => void;
  onQuickSync: () => void;
  isSyncing: boolean;
  onUpdateBaseSalary: (newSalary: number) => void;
}

export const MainBudgetCard: React.FC<MainBudgetCardProps> = ({
  currentMonth,
  currentYear,
  availableBudget,
  totalIncome,
  totalExpense,
  totalInvestment,
  monthlyBalance,
  finalBalance,
  totalLimit,
  hideValues,
  health,
  onPrevMonth,
  onNextMonth,
  onOpenCategoriesModal,
  onQuickSync,
  isSyncing,
  onUpdateBaseSalary,
}) => {
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryInput, setSalaryInput] = useState(totalIncome.toString());

  const percentage = totalLimit > 0 ? Math.min(100, (totalExpense / totalLimit) * 100) : 0;

  const handleOpenSalaryModal = () => {
    setSalaryInput(totalIncome.toString());
    setIsSalaryModalOpen(true);
  };

  const handleSaveSalary = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(salaryInput.replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      onUpdateBaseSalary(val);
    }
    setIsSalaryModalOpen(false);
  };

  const renderHealthBadge = () => {
    if (health.status === 'CRITICAL') {
      return (
        <div className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full text-xs font-semibold">
          <AlertCircle size={14} className="animate-pulse" />
          <span>Alerta de Limite</span>
        </div>
      );
    }
    if (health.status === 'WARNING') {
      return (
        <div className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-xs font-semibold">
          <AlertTriangle size={14} />
          <span>Atenção ao Ritmo</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold">
        <Smile size={14} />
        <span>Tranquilo</span>
      </div>
    );
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-3xl bg-obsidian text-white p-7 md:p-9 shadow-obsidian border border-obsidian-border transition-all duration-300">
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand/20 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        {/* Card Header: Month Selector & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                onClick={onPrevMonth}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Mês Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-extrabold tracking-widest text-gray-200 uppercase px-2">
                {getMonthName(currentMonth)} {currentYear}
              </span>
              <button
                onClick={onNextMonth}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                title="Próximo Mês"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {renderHealthBadge()}
            <button
              onClick={onOpenCategoriesModal}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10"
              title="Ajustar Nichos & Limites"
            >
              <Edit3 size={15} />
            </button>
          </div>
        </div>

        {/* Main Budget Displays (Saldo Mensal & Saldo Final) */}
        <div className="mb-6 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Saldo Restante no Mês (Receita - Despesas)
            </span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-none">
              {formatCurrency(monthlyBalance, hideValues)}
            </h2>

            {/* Clickable Base Salary Edit Pill */}
            <button
              onClick={handleOpenSalaryModal}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-bold cursor-pointer group"
              title="Clique para editar a Receita Base / Salário"
            >
              <span>Receita Base: {formatCurrency(totalIncome, hideValues)}</span>
              <Edit3 size={13} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            </button>
          </div>

          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider block">
                Investimento Guardado
              </span>
              <span className="text-xl font-extrabold text-brand-light block mt-0.5">
                {formatCurrency(totalInvestment, hideValues)}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Saldo Final Livre
              </span>
              <span className="text-base font-extrabold text-emerald-400 block mt-0.5">
                {formatCurrency(finalBalance, hideValues)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer: Usado vs Limite Nichos + Progress Bar */}
        <div className="relative z-10 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <div>
              <span className="text-gray-400 text-[10px] uppercase tracking-widest block font-medium">Gastos Acumulados</span>
              <span className="text-gray-100 text-sm">{formatCurrency(totalExpense, hideValues)}</span>
            </div>
            <div className="text-right">
              <span className="text-gray-400 text-[10px] uppercase tracking-widest block font-medium">Limite dos Seus Nichos</span>
              <span className="text-gray-100 text-sm">{formatCurrency(totalLimit, hideValues)}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-gray-900 rounded-full overflow-hidden p-0.5 border border-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                percentage >= 100
                  ? 'bg-gradient-to-r from-red-600 to-rose-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]'
                  : percentage >= 80
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.7)]'
                  : 'bg-gradient-to-r from-brand via-purple-500 to-emerald-400 shadow-[0_0_12px_rgba(130,87,229,0.7)]'
              }`}
              style={{ width: `${Math.min(100, Math.max(3, percentage))}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Modal Dedicado para Alterar Receita Base / Salário */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 relative text-gray-900">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <DollarSign size={18} />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Editar Receita Base</h3>
              </div>
              <button
                onClick={() => setIsSalaryModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Salário Base Mensal (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                  <input
                    type="text"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm font-bold rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    placeholder="1000,00"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Este valor será usado como receita base para calcular sua sobra mensal.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
