// src/components/AnalysisView.tsx
'use client';

import React from 'react';
import { PieChart, BarChart3, TrendingUp, TrendingDown, DollarSign, Award, Flame, Sparkles, Heart, Minus, Wallet, Target } from 'lucide-react';
import { Category, FinancialHealth, Transaction } from '@/types/finance';
import { formatCurrency, getMonthName, getSemaphoreColor } from '@/utils/formatters';
import { groupTransactionsByMonth, getCategoryTrend, projectMonthEndTotal, getCumulativeBalanceSeries } from '@/utils/insights';
import { EmptyState } from '@/components/ui/EmptyState';

interface AnalysisViewProps {
  transactions: Transaction[];
  categories: Category[];
  currentDate: Date;
  baseSalary: number;
  health: FinancialHealth;
  hideValues: boolean;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ transactions, categories, currentDate, baseSalary, health, hideValues }) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  if (transactions.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <EmptyState
          icon={PieChart}
          title="Ainda não há dados para analisar"
          description="Assim que você registrar seus primeiros lançamentos, esta tela mostra tendências, projeção de fechamento do mês e comparação com meses anteriores."
        />
      </div>
    );
  }

  const monthTransactions = transactions.filter((t) => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const expenseTxs = monthTransactions.filter((t) => t.type === 'EXPENSE');
  const totalExpense = expenseTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = baseSalary + monthTransactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
  const totalInvestment = monthTransactions.filter((t) => t.type === 'INVESTMENT').reduce((sum, t) => sum + t.amount, 0);

  const categoryStats = categories
    .map((cat) => {
      const spent = expenseTxs.filter((t) => t.categoryId === cat.id).reduce((sum, t) => sum + t.amount, 0);
      const shareOfTotal = totalExpense > 0 ? (spent / totalExpense) * 100 : 0;
      const shareOfLimit = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
      return { ...cat, spent, shareOfTotal, shareOfLimit };
    })
    .sort((a, b) => b.spent - a.spent);

  const topCategory = categoryStats.find((c) => c.spent > 0) || null;

  const projection = projectMonthEndTotal(totalExpense, currentDate);
  const totalLimit = categories.reduce((sum, c) => sum + c.monthlyLimit, 0);
  const projectionOverLimit = totalLimit > 0 ? projection.projectedTotal - totalLimit : null;

  const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense - totalInvestment) / totalIncome : 0;

  const monthlyHistory = groupTransactionsByMonth(transactions);
  const previousMonths = monthlyHistory.filter((m) => m.year !== year || m.month !== month).slice(-3);
  const previousExpenseAvg = previousMonths.length > 0 ? previousMonths.reduce((sum, m) => sum + m.expense, 0) / previousMonths.length : null;
  const expenseTrendPercent = previousExpenseAvg && previousExpenseAvg > 0 ? ((totalExpense - previousExpenseAvg) / previousExpenseAvg) * 100 : null;

  const cumulativeSeries = getCumulativeBalanceSeries(transactions, baseSalary);
  const maxAbsCumulative = Math.max(...cumulativeSeries.map((p) => Math.abs(p.cumulative)), 1);

  const categoryTrends = categories
    .map((cat) => getCategoryTrend(transactions, cat.id, year, month))
    .filter((t) => t.percentChange !== null && (t.currentAmount > 0 || t.averagePrevious > 0));

  const topExpenses = [...expenseTxs].sort((a, b) => b.amount - a.amount).slice(0, 4);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-brand px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-100">
            ANÁLISE & SAÚDE FINANCEIRA
          </span>
          <h2 className="text-2xl font-black text-gray-900 mt-2 flex items-center gap-2">
            <PieChart className="text-brand" size={26} />
            {getMonthName(month)} {year}
          </h2>
          <p className="text-xs text-gray-500 mt-1 max-w-xl">
            Para onde seu dinheiro está indo, como isso se compara aos meses anteriores, e o que esperar até o fim do mês.
          </p>
        </div>
        <div
          className={`px-4 py-2.5 rounded-2xl border text-xs font-bold shrink-0 ${
            health.status === 'CRITICAL'
              ? 'bg-red-50 text-red-700 border-red-200'
              : health.status === 'WARNING'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}
        >
          {health.status === 'CRITICAL' ? '🔴 Em Alerta' : health.status === 'WARNING' ? '🟡 Atenção' : '🟢 Tranquilo'}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Total Gasto no Mês</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-brand flex items-center justify-center"><DollarSign size={16} /></div>
          </div>
          <h3 className="text-xl md:text-2xl font-black text-gray-900">{formatCurrency(totalExpense, hideValues)}</h3>
          {expenseTrendPercent === null ? (
            <span className="text-[11px] font-semibold text-gray-400 block mt-1">Sem meses anteriores para comparar</span>
          ) : (
            <span className={`text-[11px] font-semibold flex items-center gap-1 mt-1 ${expenseTrendPercent > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
              {expenseTrendPercent > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {expenseTrendPercent > 0 ? '+' : ''}
              {expenseTrendPercent.toFixed(0)}% vs média dos últimos meses
            </span>
          )}
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Maior Nicho</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Flame size={16} /></div>
          </div>
          <h3 className="text-base font-black text-gray-900 truncate">{topCategory ? topCategory.name : 'Nenhum'}</h3>
          <span className="text-[11px] font-bold text-amber-600 block mt-1">
            {topCategory ? `${topCategory.shareOfTotal.toFixed(0)}% do gasto do mês` : '-'}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Projeção de Fechamento</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Target size={16} /></div>
          </div>
          <h3 className="text-xl font-black text-gray-900">{formatCurrency(projection.projectedTotal, hideValues)}</h3>
          <span className={`text-[11px] font-semibold block mt-1 ${projectionOverLimit !== null && projectionOverLimit > 0 ? 'text-red-500' : 'text-gray-500'}`}>
            {projectionOverLimit !== null
              ? projectionOverLimit > 0
                ? `${formatCurrency(Math.abs(projectionOverLimit), hideValues)} acima do limite dos nichos`
                : 'Dentro do limite dos nichos, no ritmo atual'
              : `No ritmo do dia ${projection.daysElapsed} de ${projection.daysInMonth}`}
          </span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest">Taxa de Poupança</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Wallet size={16} /></div>
          </div>
          <h3 className="text-xl font-black text-gray-900">{(savingsRate * 100).toFixed(0)}%</h3>
          <span className="text-[11px] font-semibold text-gray-500 block mt-1">da receita guardada ou não gasta este mês</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 mb-1">
            <BarChart3 size={16} className="text-brand" />
            SALDO ACUMULADO AO LONGO DO TEMPO
          </h3>
          <p className="text-[11px] text-gray-400 mb-6">Soma do saldo de todos os meses registrados, mês a mês</p>

          <div className="flex items-end justify-between gap-2 h-52 pt-4 pb-2 border-b border-gray-100 px-1">
            {cumulativeSeries.map((point, idx) => {
              const heightPct = (Math.abs(point.cumulative) / maxAbsCumulative) * 100;
              const isCurrent = idx === cumulativeSeries.length - 1;
              const isNegative = point.cumulative < 0;
              return (
                <div key={`${point.year}-${point.month}`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end min-w-0">
                  <span className="text-[9px] font-extrabold text-gray-700 truncate max-w-full">{formatCurrency(point.cumulative, hideValues)}</span>
                  <div className="w-full bg-gray-100 rounded-2xl h-full flex items-end overflow-hidden p-1 max-w-[40px]">
                    <div
                      className={`w-full rounded-xl transition-all duration-500 ${
                        isNegative ? 'bg-gradient-to-t from-red-500 to-rose-400' : isCurrent ? 'bg-gradient-to-t from-brand to-purple-400' : 'bg-gray-300'
                      }`}
                      style={{ height: `${Math.min(100, Math.max(6, heightPct))}%` }}
                    ></div>
                  </div>
                  <span className={`text-[9px] font-bold ${isCurrent ? 'text-brand' : 'text-gray-500'}`}>{getMonthName(point.month).slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2 mb-1">
            <PieChart size={16} className="text-brand" />
            DISTRIBUIÇÃO DE GASTOS POR NICHO
          </h3>
          <p className="text-[11px] text-gray-400 mb-4">Participação de cada nicho no gasto deste mês</p>

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

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {categoryStats.map((cat) => {
              const semaph = getSemaphoreColor(cat.shareOfLimit);
              return (
                <div key={cat.id} className="p-3 rounded-2xl bg-gray-50/70 border border-gray-100/80">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-bold text-gray-900">{cat.name}</span>
                    <div className="text-right font-extrabold text-gray-900">
                      {formatCurrency(cat.spent, hideValues)}{' '}
                      <span className="text-[10px] text-gray-400 font-semibold">({cat.shareOfTotal.toFixed(0)}%)</span>
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

      {categoryTrends.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-brand" />
            COMPARAÇÃO COM A MÉDIA DOS ÚLTIMOS MESES
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {categoryTrends.map((trend) => {
              const cat = categories.find((c) => c.id === trend.categoryId);
              if (!cat) return null;
              const Icon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
              const colorClass = trend.direction === 'up' ? 'text-red-500' : trend.direction === 'down' ? 'text-emerald-600' : 'text-gray-500';
              return (
                <div key={trend.categoryId} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-gray-900 truncate block">{cat.name}</span>
                    <span className="text-[10px] text-gray-400">
                      {formatCurrency(trend.currentAmount, hideValues)} vs média de {formatCurrency(trend.averagePrevious, hideValues)}
                    </span>
                  </div>
                  <span className={`font-black flex items-center gap-1 shrink-0 ml-2 ${colorClass}`}>
                    <Icon size={14} />
                    {trend.percentChange !== null ? `${trend.percentChange > 0 ? '+' : ''}${trend.percentChange.toFixed(0)}%` : '-'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {topExpenses.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
            <Award size={16} className="text-brand" />
            MAIORES LANÇAMENTOS DO MÊS
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
                  <span className="font-black text-gray-900 shrink-0 ml-2">{formatCurrency(tx.amount, hideValues)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          DIAGNÓSTICO E DICAS
        </h3>
        <div className="space-y-3">
          {categoryStats
            .filter((c) => c.spent > 0)
            .slice(0, 3)
            .map((cat) => (
              <div key={cat.id} className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-purple-100 text-brand shrink-0 mt-0.5"><TrendingUp size={18} /></div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">
                    Seus gastos com <span className="text-brand font-extrabold">{cat.name}</span> representam{' '}
                    <span className="text-brand font-extrabold">{cat.shareOfTotal.toFixed(0)}%</span> do seu gasto total.
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Já foram usados {formatCurrency(cat.spent, hideValues)} de um limite de {formatCurrency(cat.monthlyLimit, hideValues)}.
                    {cat.shareOfLimit >= 80
                      ? ' Vale segurar novas compras neste nicho até o fim do mês.'
                      : ' Bom controle — dentro do esperado para este nicho.'}
                  </p>
                </div>
              </div>
            ))}

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5"><Heart size={18} /></div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Diagnóstico Geral do Ritmo</h4>
              <p className="text-xs text-gray-600 mt-1">{health.tip}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
