// src/utils/insights.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupTransactionsByMonth,
  getCategoryTrend,
  getExpenseTrend,
  projectMonthEndTotal,
  getSavingsRateSeries,
  getCumulativeBalanceSeries,
} from './insights.ts';
import type { Transaction } from '../types/finance.ts';

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'type' | 'date'>): Transaction {
  return {
    id: `tx-${Math.random()}`,
    description: 'Teste',
    categoryId: 'cat-x',
    createdAt: partial.date,
    ...partial,
  };
}

test('groupTransactionsByMonth sums income/expense/investment per month and computes balance', () => {
  const txs: Transaction[] = [
    tx({ amount: 100, type: 'EXPENSE', date: '2026-03-05' }),
    tx({ amount: 50, type: 'EXPENSE', date: '2026-03-20' }),
    tx({ amount: 200, type: 'INCOME', date: '2026-03-10' }),
    tx({ amount: 30, type: 'INVESTMENT', date: '2026-03-15' }),
    tx({ amount: 40, type: 'EXPENSE', date: '2026-04-01' }),
  ];

  const result = groupTransactionsByMonth(txs);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { year: 2026, month: 2, income: 200, expense: 150, investment: 30, balance: 50 });
  assert.deepEqual(result[1], { year: 2026, month: 3, income: 0, expense: 40, investment: 0, balance: -40 });
});

test('getCategoryTrend returns null percentChange when there is no prior month data at all', () => {
  const txs: Transaction[] = [tx({ amount: 100, type: 'EXPENSE', date: '2026-03-05', categoryId: 'cat-uber' })];
  const result = getCategoryTrend(txs, 'cat-uber', 2026, 2);
  assert.equal(result.currentAmount, 100);
  assert.equal(result.percentChange, null);
  assert.equal(result.direction, 'stable');
});

test('getCategoryTrend compares current month to the average of prior months with data', () => {
  const txs: Transaction[] = [
    tx({ amount: 100, type: 'EXPENSE', date: '2026-01-05', categoryId: 'cat-uber' }),
    tx({ amount: 200, type: 'EXPENSE', date: '2026-02-05', categoryId: 'cat-uber' }),
    tx({ amount: 300, type: 'EXPENSE', date: '2026-03-05', categoryId: 'cat-uber' }),
  ];
  // março (month index 2): média de jan+fev = 150; atual = 300 -> +100%
  const result = getCategoryTrend(txs, 'cat-uber', 2026, 2);
  assert.equal(result.currentAmount, 300);
  assert.equal(result.averagePrevious, 150);
  assert.equal(result.percentChange, 100);
  assert.equal(result.direction, 'up');
});

test('projectMonthEndTotal extrapolates the daily average across the whole month', () => {
  const currentDate = new Date(2026, 3, 10); // 10 de abril, abril tem 30 dias
  const result = projectMonthEndTotal(300, currentDate);
  assert.equal(result.daysElapsed, 10);
  assert.equal(result.daysInMonth, 30);
  assert.equal(result.projectedTotal, 900);
});

// Regression test for the Fix 1 bug: AnalysisView.tsx was calling
// projectMonthEndTotal(totalExpense, currentDate) where `currentDate` came
// from page.tsx's month-navigation buttons, which always set day 1 of the
// target month (`new Date(y, m ± 1, 1)`) — not the real "today". That made
// daysElapsed always 1 for ANY month browsed to, wildly inflating the
// projection for past (closed) months. The fix moved to only calling this
// function with the real `new Date()` for the actual current calendar
// month, and showing the closed-month total (not a projection) otherwise —
// entirely in AnalysisView.tsx, not here. This test documents that
// projectMonthEndTotal itself behaves correctly in isolation when it
// legitimately receives day 1 (e.g. someone opening the app on the 1st of
// the real current month): daysElapsed = 1 is the CORRECT answer in that
// case, so this function needed no change.
test('projectMonthEndTotal with a day-1 currentDate: daysElapsed is legitimately 1', () => {
  const currentDate = new Date(2026, 3, 1); // 1 de abril, abril tem 30 dias
  const result = projectMonthEndTotal(300, currentDate);
  assert.equal(result.daysElapsed, 1);
  assert.equal(result.daysInMonth, 30);
  assert.equal(result.projectedTotal, 9000); // 300 / 1 dia * 30 dias
});

// Regression test for the Fix 2 bug: AnalysisView.tsx reimplemented this
// comparison inline as
//   monthlyHistory.filter((m) => m.year !== year || m.month !== month).slice(-3)
// which excludes the viewed month but then takes the last 3 of the WHOLE
// history — including months chronologically AFTER the viewed month. This
// dataset has three months before April (Jan/Feb/Mar) and three months
// after (May/Jun/Jul) — the buggy inline logic would have averaged
// May/Jun/Jul (900 each) instead of Jan/Feb/Mar (100/200/300).
test('getExpenseTrend only averages months chronologically before the queried month, not ones after', () => {
  const txs: Transaction[] = [
    tx({ amount: 100, type: 'EXPENSE', date: '2026-01-10' }),
    tx({ amount: 200, type: 'EXPENSE', date: '2026-02-10' }),
    tx({ amount: 300, type: 'EXPENSE', date: '2026-03-10' }),
    tx({ amount: 400, type: 'EXPENSE', date: '2026-04-15' }), // mês consultado
    tx({ amount: 900, type: 'EXPENSE', date: '2026-05-10' }),
    tx({ amount: 900, type: 'EXPENSE', date: '2026-06-10' }),
    tx({ amount: 900, type: 'EXPENSE', date: '2026-07-10' }),
  ];
  // abril (month index 3): média correta = (100+200+300)/3 = 200, não 900
  const result = getExpenseTrend(txs, 2026, 3);
  assert.equal(result.currentAmount, 400);
  assert.equal(result.averagePrevious, 200);
  assert.equal(result.percentChange, 100);
  assert.equal(result.direction, 'up');
});

test('getExpenseTrend returns null percentChange when there is no prior month data at all', () => {
  const txs: Transaction[] = [tx({ amount: 100, type: 'EXPENSE', date: '2026-03-05' })];
  const result = getExpenseTrend(txs, 2026, 2);
  assert.equal(result.currentAmount, 100);
  assert.equal(result.percentChange, null);
  assert.equal(result.direction, 'stable');
});

test('getSavingsRateSeries adds baseSalary to each month and computes the saved fraction', () => {
  const txs: Transaction[] = [tx({ amount: 750, type: 'EXPENSE', date: '2026-03-05' })];
  const result = getSavingsRateSeries(txs, 1000);
  assert.equal(result.length, 1);
  assert.equal(result[0].rate, 0.25);
});

test('getCumulativeBalanceSeries accumulates month balances in chronological order', () => {
  const txs: Transaction[] = [
    tx({ amount: 200, type: 'EXPENSE', date: '2026-01-05' }),
    tx({ amount: 900, type: 'EXPENSE', date: '2026-02-05' }),
  ];
  const result = getCumulativeBalanceSeries(txs, 1000);
  assert.equal(result[0].cumulative, 800); // 1000 - 200
  assert.equal(result[1].cumulative, 900); // 800 + (1000 - 900)
});
