// src/utils/insights.ts
// Relative import (not the @/ alias) so this file resolves identically under
// Next.js and under `node --import tsx --test` when insights.test.ts loads it.
import { Transaction } from '../types/finance';

export interface MonthTotals {
  year: number;
  month: number; // 0-11
  income: number;
  expense: number;
  investment: number;
  balance: number; // income - expense
}

export interface CategoryTrend {
  categoryId: string;
  currentAmount: number;
  averagePrevious: number;
  percentChange: number | null; // null when no prior month has any data at all
  direction: 'up' | 'down' | 'stable';
}

export interface MonthProjection {
  totalSoFar: number;
  projectedTotal: number;
  daysElapsed: number;
  daysInMonth: number;
}

export interface SavingsRatePoint {
  year: number;
  month: number;
  rate: number; // fraction, e.g. 0.24 = 24%
}

export interface CumulativeBalancePoint {
  year: number;
  month: number;
  cumulative: number;
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function getTransactionMonth(tx: Transaction): { year: number; month: number } {
  const d = new Date(tx.date + 'T00:00:00');
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function groupTransactionsByMonth(transactions: Transaction[]): MonthTotals[] {
  const map = new Map<string, MonthTotals>();
  for (const t of transactions) {
    const { year, month } = getTransactionMonth(t);
    const key = monthKey(year, month);
    if (!map.has(key)) {
      map.set(key, { year, month, income: 0, expense: 0, investment: 0, balance: 0 });
    }
    const entry = map.get(key)!;
    if (t.type === 'INCOME') entry.income += t.amount;
    else if (t.type === 'EXPENSE') entry.expense += t.amount;
    else if (t.type === 'INVESTMENT') entry.investment += t.amount;
  }
  for (const entry of map.values()) {
    entry.balance = entry.income - entry.expense;
  }
  return Array.from(map.values()).sort((a, b) => a.year - b.year || a.month - b.month);
}

export function getCategoryTrend(
  transactions: Transaction[],
  categoryId: string,
  year: number,
  month: number,
  monthsBack: number = 3
): CategoryTrend {
  const expenseTxs = transactions.filter((t) => t.type === 'EXPENSE' && t.categoryId === categoryId);

  const currentAmount = expenseTxs
    .filter((t) => {
      const m = getTransactionMonth(t);
      return m.year === year && m.month === month;
    })
    .reduce((sum, t) => sum + t.amount, 0);

  const previousAmounts: number[] = [];
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(year, month - i, 1);
    const monthHasAnyData = transactions.some((t) => {
      const m = getTransactionMonth(t);
      return m.year === d.getFullYear() && m.month === d.getMonth();
    });
    if (!monthHasAnyData) continue;
    const amount = expenseTxs
      .filter((t) => {
        const m = getTransactionMonth(t);
        return m.year === d.getFullYear() && m.month === d.getMonth();
      })
      .reduce((sum, t) => sum + t.amount, 0);
    previousAmounts.push(amount);
  }

  if (previousAmounts.length === 0) {
    return { categoryId, currentAmount, averagePrevious: 0, percentChange: null, direction: 'stable' };
  }

  const averagePrevious = previousAmounts.reduce((a, b) => a + b, 0) / previousAmounts.length;
  const percentChange =
    averagePrevious > 0
      ? ((currentAmount - averagePrevious) / averagePrevious) * 100
      : currentAmount > 0
      ? 100
      : 0;
  const direction: 'up' | 'down' | 'stable' = Math.abs(percentChange) < 5 ? 'stable' : percentChange > 0 ? 'up' : 'down';

  return { categoryId, currentAmount, averagePrevious, percentChange, direction };
}

export function projectMonthEndTotal(totalSoFar: number, currentDate: Date = new Date()): MonthProjection {
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const daysElapsed = currentDate.getDate();
  const dailyRate = daysElapsed > 0 ? totalSoFar / daysElapsed : 0;
  const projectedTotal = dailyRate * daysInMonth;
  return { totalSoFar, projectedTotal, daysElapsed, daysInMonth };
}

export function getSavingsRateSeries(transactions: Transaction[], baseSalary: number): SavingsRatePoint[] {
  return groupTransactionsByMonth(transactions).map((m) => {
    const income = m.income + baseSalary;
    const rate = income > 0 ? (income - m.expense - m.investment) / income : 0;
    return { year: m.year, month: m.month, rate };
  });
}

export function getCumulativeBalanceSeries(transactions: Transaction[], baseSalary: number): CumulativeBalancePoint[] {
  let running = 0;
  return groupTransactionsByMonth(transactions).map((m) => {
    const income = m.income + baseSalary;
    running += income - m.expense - m.investment;
    return { year: m.year, month: m.month, cumulative: running };
  });
}
