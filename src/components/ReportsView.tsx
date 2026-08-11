'use client';

import React from 'react';
import {
  PieChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Award,
  Flame,
  ShieldCheck,
  Tag,
  ArrowDownRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, getMonthName, getSemaphoreColor } from '@/utils/formatters';

interface ReportsViewProps {
  transactions: Transaction[];
  categories: Category[];
  hideValues: boolean;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  categories,
  hideValues,
}) => {
  // Expenses only
  const expenseTxs = transactions.filter((t) => t.type === 'EXPENSE');
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown calculation
  const categoryStats = categories.map((cat) => {
    const spent = expenseTxs
      .filter((t) => t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const shareOfTotal = totalExpense > 0 ? (spent / totalExpense) * 100 : 0;
    const shareOfLimit = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
    return { ...cat, spent, shareOfTotal, shareOfLimit };
  }).sort((a, b) => b.spent - a.spent);

  // Top spending category
  const topCategory = categoryStats[0] || null;

  // Daily average calculation
  const daysInCurrentMonth = new Date().getDate();
  const dailyAverage = totalExpense / Math.max(1, daysInCurrentMonth);

  // Monthly mock evolution data
  const monthlyData = [
    { month: 'MAIO', amount: 2943.02, change: '-2%' },
    { month: 'JUNHO', amount: 2810.50, change: '-4%' },
    { month: 'JULHO', amount: 3120.00, change: '+11%' },
    { month: 'AGOSTO (ATUAL)', amount: totalExpense || 3052.79, change: '-2%' },
  ];

  const maxMonthly = Math.max(...monthlyData.map((m) => m.amount), 1);

  // Top 4 Largest Expense Transactions
  const topExpenses = [...expenseTxs].sort((a, b) => b.amount - a.amount).slice(0, 4);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Title & Explanation Banner */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-100">
              DASHBOARD ANALÍTICO COMPLETO
            </span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mt-2 flex items-center gap-2">
            <PieChart className="text-brand" size={26} />
            Análise Financeira & Diagnóstico de Gastos
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Entenda exatamente para onde seu dinheiro está indo, acompanhe a evolução mensal dos seus nichos e identifique oportunidades de economia.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-purple-50/60 p-3 rounded-2xl border border-purple-100 shrink-0 text-xs font-bold text-brand">
          <Calendar size={16} />
          <span>Visão Consolidada de Agosto 2026</span>
        </div>
      </div>

      {/* KPI Metrics Row (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Gasto */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Total Gasto Mês</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-brand flex items-center justify-center font-bold">
              <DollarSign size={16} />
            </div>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-gray-900">
            {formatCurrency(totalExpense, hideValues)}
          </h3>
          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mt-1">
            <TrendingDown size={12} /> -2% vs mês anterior
          </span>
        </div>

        {/* Metric 2: Maior Nicho */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Maior Nicho</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Flame size={16} />
            </div>
          </div>
          <h3 className="text-base font-black text-gray-900 truncate">
            {topCategory ? topCategory.name : 'Nenhum'}
          </h3>
          <span className="text-[11px] font-bold text-amber-600 block mt-1">
            {topCategory ? `${topCategory.shareOfTotal.toFixed(0)}% do orçamento total` : '-'}
          </span>
        </div>

        {/* Metric 3: Média Diária */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Média Diária</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Calendar size={16} />
            </div>
          </div>
          <h3 className="text-xl font-black text-gray-900">
            {formatCurrency(dailyAverage, hideValues)}
          </h3>
          <span className="text-[11px] font-semibold text-gray-500 block mt-1">
            Média por dia em {daysInCurrentMonth} dias
          </span>
        </div>

        {/* Metric 4: Status do Semáforo */}
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Saúde dos Nichos</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck size={16} />
            </div>
          </div>
          <h3 className="text-base font-black text-emerald-600">
            Dentro do Limite
          </h3>
          <span className="text-[11px] font-semibold text-gray-500 block mt-1">
            {categoryStats.filter((c) => c.shareOfLimit < 80).length} de {categories.length} nichos protegidos
          </span>
        </div>
      </div>

      {/* Main Analysis Section: Monthly Evolution Chart + Category Share */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 1. Evolução Histórica (Gráfico de Barras Verticais) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                  <BarChart3 size={16} className="text-brand" />
                  EVOLUÇÃO DOS ÚLTIMOS 4 MESES
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Comparativo dos totais gastos acumulados</p>
              </div>
            </div>

            {/* Vertical Bar Visual Chart */}
            <div className="flex items-end justify-between gap-3 h-52 pt-8 pb-2 border-b border-gray-100 px-2">
              {monthlyData.map((item, idx) => {
                const heightPct = (item.amount / maxMonthly) * 100;
                const isCurrent = idx === monthlyData.length - 1;

                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    {/* Amount Label on top */}
                    <span className="text-[10px] font-extrabold text-gray-700 opacity-80 group-hover:opacity-100 transition-opacity">
                      {formatCurrency(item.amount, hideValues)}
                    </span>

                    {/* Bar */}
                    <div className="w-full bg-gray-100 rounded-2xl h-full flex items-end overflow-hidden p-1 max-w-[56px]">
                      <div
                        className={`w-full rounded-xl transition-all duration-500 ${
                          isCurrent
                            ? 'bg-gradient-to-t from-brand to-purple-400 shadow-md'
                            : 'bg-gray-300 group-hover:bg-purple-300'
                        }`}
                        style={{ height: `${Math.min(100, Math.max(10, heightPct))}%` }}
                      ></div>
                    </div>

                    {/* Month Label */}
                    <span className={`text-[10px] font-bold ${isCurrent ? 'text-brand' : 'text-gray-500'}`}>
                      {item.month.split(' ')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-2 text-[11px] text-gray-500 flex items-center justify-between">
            <span>Média dos 4 meses: <strong className="text-gray-900 font-bold">R$ 2.981,57</strong></span>
            <span className="text-emerald-600 font-bold">Estabilidade de Gastos ✅</span>
          </div>
        </div>

        {/* 2. Distribuição por Nicho Criado pela Usuária */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
                  <PieChart size={16} className="text-brand" />
                  DISTRIBUIÇÃO DE GASTOS POR NICHO
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Participação de cada nicho no gasto do mês</p>
              </div>
            </div>

            {/* Proportional Segmented Progress Bar */}
            <div className="w-full h-4 rounded-full overflow-hidden flex gap-0.5 bg-gray-100 p-0.5 mb-6">
              {categoryStats.map((cat, idx) => {
                if (cat.spent <= 0) return null;
                const colors = ['bg-brand', 'bg-purple-400', 'bg-purple-300', 'bg-purple-200', 'bg-gray-300'];
                return (
                  <div
                    key={cat.id}
                    className={`h-full rounded-full ${colors[idx % colors.length]}`}
                    style={{ width: `${Math.max(3, cat.shareOfTotal)}%` }}
                    title={`${cat.name}: ${cat.shareOfTotal.toFixed(0)}%`}
                  ></div>
                );
              })}
            </div>

            {/* List of Nichos Breakdown */}
            <div className="space-y-3">
              {categoryStats.map((cat) => {
                const semaph = getSemaphoreColor(cat.shareOfLimit);
                return (
                  <div key={cat.id} className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100/80">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-gray-900">{cat.name}</span>
                      <div className="text-right font-extrabold text-gray-900">
                        {formatCurrency(cat.spent, hideValues)}{' '}
                        <span className="text-[10px] text-gray-400 font-semibold">
                          ({cat.shareOfTotal.toFixed(0)}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>Limite: {formatCurrency(cat.monthlyLimit, hideValues)}</span>
                      <span className={`font-bold ${semaph.colorText}`}>{semaph.label} ({cat.shareOfLimit.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top 4 Maior Lançamentos Puxados do Banco */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
          <Award size={16} className="text-brand" />
          MAIORES LANÇAMENTOS DO MÊS (DESPESAS MAIS SIGNIFICATIVAS)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {topExpenses.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            return (
              <div key={tx.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-gray-900 truncate block">{tx.description}</span>
                  <span className="text-[10px] text-gray-400 font-medium">Nicho: {cat?.name || 'Geral'}</span>
                </div>
                <span className="font-black text-gray-900 shrink-0 ml-2">
                  {formatCurrency(tx.amount, hideValues)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
