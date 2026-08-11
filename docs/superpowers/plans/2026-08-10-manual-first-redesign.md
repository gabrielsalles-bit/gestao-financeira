# Manual-First Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "Gestão da Livinha" into a 100% manual, Supabase-synced finance app — remove Pluggy/Resend, fix the broken cross-device sync, replace fictitious data with real calculations, and redesign the UI for clarity on mobile and desktop.

**Architecture:** Next.js 14 App Router + Tailwind, client components, Supabase as the single source of truth with localStorage as an offline cache. Pure calculation/parsing logic lives in testable `src/utils/*.ts` modules; React components stay presentation-focused.

**Tech Stack:** Next.js 14, React 18, TypeScript, Tailwind CSS, `@supabase/supabase-js`, `papaparse` (CSV), new: `xlsx` (Excel parsing), new dev dep: `tsx` (run `.ts` tests via `node --test`).

## Global Constraints

- No new external paid APIs. Only dependency additions are `xlsx` (runtime, parses files locally, no network calls) and `tsx` (dev-only, test runner).
- All currency in BRL via `formatCurrency` from `src/utils/formatters.ts` — never format currency inline.
- All user-facing text in Portuguese (pt-BR), matching existing copy style.
- No secrets/API keys hardcoded in source — only via `process.env.*`, and only `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the schema in Task 2 uses permissive RLS since there's no real auth — the PIN is the access gate — so the anon key is all the app, and the seed script, ever need).
- Keep the existing visual identity (obsidian dark cards, brand purple `#8257E5`, semaphore colors, "Feito por Mozão" branding) — polish consistency, don't rebrand.
- Every task must leave `npm run build` passing before moving to the next task.

---

## Task 1: Remove Pluggy/Resend and dead code

**Files:**
- Delete: `src/components/OpenFinanceView.tsx`
- Delete: `src/app/api/pluggy-sync/route.ts`
- Delete: `src/app/api/send-alert/route.ts`
- Delete: `src/app/api/` (directory, now empty)
- Delete: `src/components/Header.tsx` (dead code — never imported anywhere; `Navigation.tsx` already renders its own header)
- Modify: `package.json` (remove `resend` dependency, add `xlsx` runtime dependency, add `tsx` dev dependency, add `test` script)
- Modify: `.env.local.example` (remove Pluggy/Resend vars)

**Interfaces:**
- Produces: a codebase with zero references to Pluggy, Resend, or `Header.tsx`. Later tasks assume these are gone.

- [ ] **Step 1: Confirm `Header.tsx` is truly unused**

Run: `grep -rn "components/Header" src --include=*.tsx --include=*.ts`
Expected: no output (already verified during planning — this just re-confirms before deleting).

- [ ] **Step 2: Delete the dead/removed files**

```bash
rm src/components/OpenFinanceView.tsx
rm src/app/api/pluggy-sync/route.ts
rm src/app/api/send-alert/route.ts
rmdir src/app/api/pluggy-sync src/app/api/send-alert src/app/api
rm src/components/Header.tsx
```

- [ ] **Step 3: Update `package.json`**

Remove the `"resend": "^6.18.1"` line from `dependencies`. Add to `dependencies`:

```json
    "xlsx": "^0.18.5",
```

Add to `devDependencies`:

```json
    "tsx": "^4.19.2",
```

Add to `scripts` (after `"start": "next start"`):

```json
    "test": "node --import tsx --test src/utils/insights.test.ts src/utils/csvXlsxParser.test.ts src/utils/pin.test.ts"
```

- [ ] **Step 4: Install the dependency changes**

Run: `npm install`
Expected: exits 0, `resend` removed from `node_modules`/lockfile, `xlsx` and `tsx` added.

- [ ] **Step 5: Rewrite `.env.local.example`**

```
# CONFIGURAÇÕES DO SUPABASE (BANCO DE DADOS EM NUVEM — ÚNICA DEPENDÊNCIA EXTERNA)
# Obtenha estas chaves gratuitamente em: https://app.supabase.com -> Project Settings -> API
# Usadas pelo app e também pelo script local scripts/seed-real-data.mjs (carga inicial
# de dados) — não há chave "service role" separada porque este app não usa Supabase Auth;
# o controle de acesso é o PIN dentro do app, e o schema (Task 2) usa RLS permissiva.
NEXT_PUBLIC_SUPABASE_URL=https://sua-url-do-supabase.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

- [ ] **Step 6: Verify no remaining references**

Run: `grep -rniE "pluggy|resend" src package.json`
Expected: no output.

- [ ] **Step 7: Build check**

Run: `npm run build`
Expected: fails (page.tsx still imports OpenFinanceView) — this is expected until Task 18 rewires `page.tsx`. Confirm the *only* build errors are about `OpenFinanceView`/`Header` imports in `page.tsx`, nothing else.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Remove Pluggy/Resend integrations and dead Header component

Drops the paid Open Finance API, the email-alert endpoint, and an
unused Header.tsx that was never imported. page.tsx still references
the deleted OpenFinanceView until it's rewired in a later task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rewrite Supabase schema (v2, no auth.users dependency)

**Files:**
- Modify: `supabase_schema.sql` (full rewrite)

**Interfaces:**
- Produces: three tables (`categories`, `transactions`, `user_preferences`) with **no `user_id` column** and permissive RLS policies (access control is the app's own PIN screen, not Supabase Auth). Later tasks (`storage.ts`, seed script) write against this exact shape.

- [ ] **Step 1: Replace the file contents**

```sql
-- SCRIPT SQL DE MIGRAÇÃO SUPABASE — v2 (app 100% manual, sem Open Finance)
-- Execute no SQL Editor do seu projeto Supabase (https://app.supabase.com).
-- Este script APAGA as tabelas antigas (schema v1 nunca funcionou de verdade:
-- a coluna user_id era UUID ligada a auth.users, mas o app nunca autenticava
-- via Supabase Auth, então todo insert falhava silenciosamente).
-- Não há login real neste app — o controle de acesso é o PIN dentro do app.

drop table if exists public.transactions;
drop table if exists public.categories;
drop table if exists public.user_preferences;

-- 1. Categorias / Nichos
create table public.categories (
    id text primary key,
    name text not null,
    icon text default 'Tag',
    color text,
    monthly_limit numeric(10,2) not null default 50.00,
    keywords text[] default '{}',
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. Lançamentos / Transações
create table public.transactions (
    id text primary key,
    description text not null,
    amount numeric(10,2) not null,
    type text check (type in ('INCOME', 'EXPENSE', 'INVESTMENT')) not null,
    category_id text references public.categories(id) on delete set null,
    date date not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 3. Preferências (linha única — app de uso pessoal, sem múltiplos usuários)
create table public.user_preferences (
    id text primary key default 'default',
    user_name text default 'Livinha',
    base_salary numeric(10,2) default 1000.00,
    hide_values boolean default false,
    pin_hash text,
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- RLS habilitado, mas com política permissiva: a chave anônima do projeto
-- já não é pública (fica em variável de ambiente), e o PIN da aplicação é
-- a camada de controle de acesso real.
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.user_preferences enable row level security;

create policy "acesso completo categorias" on public.categories
    for all using (true) with check (true);

create policy "acesso completo transacoes" on public.transactions
    for all using (true) with check (true);

create policy "acesso completo preferencias" on public.user_preferences
    for all using (true) with check (true);
```

- [ ] **Step 2: Note the manual follow-up (not a code step — record it for the user)**

This file only takes effect when run manually in the Supabase SQL Editor (already listed in the design spec §14 as a manual step for the user). No local command runs it.

- [ ] **Step 3: Commit**

```bash
git add supabase_schema.sql
git commit -m "$(cat <<'EOF'
Rewrite Supabase schema without auth.users dependency

v1 stored user_id as a UUID FK to auth.users, but the app never
authenticates via Supabase Auth, so every write failed silently.
v2 drops user scoping entirely (single-user app, PIN-gated) and uses
permissive RLS policies instead.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Shared category icon map + corrected default categories

**Files:**
- Create: `src/utils/categoryIcons.ts`
- Modify: `src/services/storage.ts:11-20` (the `INITIAL_CATEGORIES` array only, in this task — the rest of `storage.ts` is rewritten in Task 5)

**Interfaces:**
- Produces: `ICON_MAP: Record<string, LucideIcon>` and `resolveCategoryIcon(iconName: string): LucideIcon` from `src/utils/categoryIcons.ts`. Tasks 12 (`CategoryNicheGrid`, `TransactionList`) import `resolveCategoryIcon` instead of keeping their own duplicated maps.

- [ ] **Step 1: Create the shared icon map**

Two separate components (`CategoryNicheGrid.tsx` and `TransactionList.tsx`) each hardcode an identical `ICON_MAP` that's missing `Sparkles`, `HelpCircle`, `GraduationCap`, `Plane`, and `Shirt` — so categories using those icon names silently fall back to a generic `Tag` icon. Centralize it and fix the gaps.

```typescript
import {
  Utensils, Car, Fuel, Sparkles, GraduationCap, Shirt, Gift, Plane,
  ShoppingBag, HelpCircle, Tag, LucideIcon,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  Car,
  Fuel,
  Sparkles,
  GraduationCap,
  Shirt,
  Gift,
  Plane,
  ShoppingBag,
  HelpCircle,
  Tag,
};

export function resolveCategoryIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Tag;
}
```

- [ ] **Step 2: Update `INITIAL_CATEGORIES` in `storage.ts`**

Replace lines 11-20 (the `INITIAL_CATEGORIES` array) with the real 10 nichos from the Excel spreadsheet ("Controle da Livinha"), in the same order as the spreadsheet, with icons corrected to match `categoryIcons.ts` and limits derived from her real Jan–Ago/2026 average spend per category (rounded, with a 30% buffer) — documented inline so it's clear these are starting suggestions, not fixed values:

```typescript
// Nichos exatos da planilha "Controle da Livinha". Limites iniciais calculados
// a partir da média de gasto real (Jan-Ago/2026) nos meses em que cada nicho
// teve movimento, com ~30% de folga — ajustável a qualquer momento em Ajustes.
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-alimentacao', name: 'Alimentação', icon: 'Utensils', color: '#10B981', monthlyLimit: 150, keywords: ['mercado', 'alimentacao', 'restaurante', 'ifood', 'padaria', 'carrefour'] },
  { id: 'cat-uber', name: 'Uber', icon: 'Car', color: '#8257E5', monthlyLimit: 200, keywords: ['uber', '99', 'corrida'] },
  { id: 'cat-gasolina', name: 'Gasolina', icon: 'Fuel', color: '#F59E0B', monthlyLimit: 100, keywords: ['posto', 'gasolina', 'shell', 'ipiranga', 'combustivel'] },
  { id: 'cat-lavagem', name: 'Lavagem de Carro', icon: 'Sparkles', color: '#06B6D4', monthlyLimit: 50, keywords: ['lavagem', 'lava rapido', 'car wash', 'estetica automotiva'] },
  { id: 'cat-faculdade', name: 'Faculdade', icon: 'GraduationCap', color: '#3B82F6', monthlyLimit: 200, keywords: ['faculdade', 'mensalidade', 'universidade', 'curso'] },
  { id: 'cat-vestimenta', name: 'Vestimenta', icon: 'Shirt', color: '#EC4899', monthlyLimit: 200, keywords: ['vestuario', 'roupa', 'zara', 'renner', 'riachuelo', 'shein', 'loja'] },
  { id: 'cat-lazer', name: 'Lazer', icon: 'Gift', color: '#6366F1', monthlyLimit: 100, keywords: ['cinema', 'bar', 'lazer', 'show', 'ingresso'] },
  { id: 'cat-viagens', name: 'Viagens', icon: 'Plane', color: '#EF4444', monthlyLimit: 100, keywords: ['viagem', 'hotel', 'passagem', 'latam', 'gol', 'booking', 'airbnb'] },
  { id: 'cat-compras', name: 'Compras', icon: 'ShoppingBag', color: '#A855F7', monthlyLimit: 200, keywords: ['compras', 'loja', 'shopping', 'amazon', 'mercado livre'] },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', color: '#94A3B8', monthlyLimit: 250, keywords: ['outros', 'diversos'] },
];
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit`
Expected: no new type errors introduced by this task (existing `page.tsx`/`OpenFinanceView` errors from Task 1 are still there and expected until Task 18).

- [ ] **Step 4: Commit**

```bash
git add src/utils/categoryIcons.ts src/services/storage.ts
git commit -m "$(cat <<'EOF'
Add shared category icon map and correct default nichos

CategoryNicheGrid and TransactionList each had their own identical
ICON_MAP missing several icon names used by real categories (Sparkles,
HelpCircle), silently falling back to a generic tag icon. Also brings
INITIAL_CATEGORIES up to the real 10 nichos from the Excel spreadsheet
(was missing Faculdade and Compras) with corrected icon choices
(Fuel/Plane instead of Zap/Home) and limits derived from real spend.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Build the historical insights engine

**Files:**
- Create: `src/utils/insights.ts`
- Test: `src/utils/insights.test.ts`

**Interfaces:**
- Consumes: `Transaction` from `@/types/finance` (existing shape, unchanged).
- Produces: `groupTransactionsByMonth`, `getCategoryTrend`, `projectMonthEndTotal`, `getSavingsRateSeries`, `getCumulativeBalanceSeries` — and their result types `MonthTotals`, `CategoryTrend`, `MonthProjection`, `SavingsRatePoint`, `CumulativeBalancePoint`. Task 15 (`AnalysisView.tsx`) imports all five functions and all five types by these exact names.
- Income model: a month's income = `userPrefs.baseSalary` (applied uniformly to every month, since the app has no per-month salary history) **plus** any `INCOME`-type transactions recorded in that month. This matches how `page.tsx` already computes the current month's income today — it's extended unchanged to past months.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/insights.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupTransactionsByMonth,
  getCategoryTrend,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/utils/insights.test.ts`
Expected: FAIL — `Cannot find module './insights.ts'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/utils/insights.test.ts`
Expected: PASS — 6 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts src/utils/insights.test.ts
git commit -m "$(cat <<'EOF'
Add historical insights engine (trend, projection, savings, cumulative)

Pure, tested calculation functions replacing the hardcoded fake
monthlyData array in ReportsView. Operates on the full transaction
history instead of just the current month.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: PIN hashing utility

**Files:**
- Create: `src/utils/pin.ts`
- Test: `src/utils/pin.test.ts`

**Interfaces:**
- Produces: `hashPin(pin: string): Promise<string>`, `verifyPin(pin: string, hash: string): Promise<boolean>`. Task 8 (`AppSecurityLock.tsx`) imports both by these exact names.
- Uses the browser/Node Web Crypto API (`crypto.subtle`), available unflagged in all modern browsers and in Node ≥19 (this repo's dev environment runs Node v24, confirmed via `node --version`).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/pin.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPin, verifyPin } from './pin.ts';

test('hashPin produces a deterministic 64-char hex digest', async () => {
  const hash1 = await hashPin('1234');
  const hash2 = await hashPin('1234');
  assert.equal(hash1, hash2);
  assert.match(hash1, /^[0-9a-f]{64}$/);
});

test('hashPin produces different digests for different PINs', async () => {
  const hash1 = await hashPin('1234');
  const hash2 = await hashPin('4321');
  assert.notEqual(hash1, hash2);
});

test('verifyPin returns true for the matching PIN and false otherwise', async () => {
  const hash = await hashPin('marrenta1234');
  assert.equal(await verifyPin('marrenta1234', hash), true);
  assert.equal(await verifyPin('wrong', hash), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/utils/pin.test.ts`
Expected: FAIL — `Cannot find module './pin.ts'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/pin.ts
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/utils/pin.test.ts`
Expected: PASS — 3 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pin.ts src/utils/pin.test.ts
git commit -m "$(cat <<'EOF'
Add PIN hashing utility

Replaces storing the access PIN as plaintext (previously hardcoded as
'marrenta1234' in source) with a SHA-256 hash comparison.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extract statement-parsing logic into a testable module (CSV + XLSX)

**Files:**
- Create: `src/utils/csvXlsxParser.ts`
- Test: `src/utils/csvXlsxParser.test.ts`

**Interfaces:**
- Consumes: `Category`, `Transaction`, `TransactionType` from `@/types/finance`; `papaparse` (already a dependency); `xlsx` (added in Task 1).
- Produces: `ParsedRow` type, `detectStatementFormat`, `parseStatementDate`, `parseStatementAmount`, `mapRowsToParsedTransactions`, `markPossibleDuplicates`, `parseCSVFile`, `parseXLSXFile`. Task 13 (`CSVImporterModal.tsx` rewrite) imports all of these by these exact names.
- `parseCSVFile`/`parseXLSXFile` take a browser `File` and are not unit-tested here (no DOM in `node --test`) — they're covered by the manual verification checklist (Task 21). Everything else is pure and tested.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/csvXlsxParser.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectStatementFormat,
  parseStatementDate,
  parseStatementAmount,
  mapRowsToParsedTransactions,
  markPossibleDuplicates,
} from './csvXlsxParser.ts';
import type { Category, Transaction } from '../types/finance.ts';

const categories: Category[] = [
  { id: 'cat-uber', name: 'Uber', icon: 'Car', monthlyLimit: 200, keywords: ['uber', '99'] },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', monthlyLimit: 250, keywords: ['outros'] },
];

test('detectStatementFormat recognizes the Nubank PT-BR export', () => {
  assert.equal(detectStatementFormat(['Data', 'Valor', 'Identificador', 'Descrição']), 'nubank_ptbr');
});

test('detectStatementFormat recognizes the Nubank EN export', () => {
  assert.equal(detectStatementFormat(['date', 'title', 'amount']), 'nubank_en');
});

test('detectStatementFormat falls back to generic for anything else', () => {
  assert.equal(detectStatementFormat(['Date', 'Description', 'Amount', 'Type']), 'generic');
});

test('parseStatementDate handles ISO and DD/MM/YYYY', () => {
  assert.equal(parseStatementDate('2026-03-05'), '2026-03-05');
  assert.equal(parseStatementDate('05/03/2026'), '2026-03-05');
});

test('parseStatementAmount handles Brazilian thousand/decimal separators and negatives', () => {
  assert.deepEqual(parseStatementAmount('R$ 1.234,56'), { value: 1234.56, isNegative: false });
  assert.deepEqual(parseStatementAmount('-89,90'), { value: 89.9, isNegative: true });
});

test('mapRowsToParsedTransactions maps a Nubank PT-BR row and auto-matches the category by keyword', () => {
  const rows = [{ Data: '10/03/2026', Descrição: 'Uber Viagem', Valor: '-45,00' }];
  const parsed = mapRowsToParsedTransactions(rows, ['Data', 'Descrição', 'Valor'], categories);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].date, '2026-03-10');
  assert.equal(parsed[0].amount, 45);
  assert.equal(parsed[0].type, 'EXPENSE');
  assert.equal(parsed[0].categoryId, 'cat-uber');
});

test('mapRowsToParsedTransactions skips zero-value rows', () => {
  const rows = [{ Data: '10/03/2026', Descrição: 'Estorno', Valor: '0' }];
  const parsed = mapRowsToParsedTransactions(rows, ['Data', 'Descrição', 'Valor'], categories);
  assert.equal(parsed.length, 0);
});

test('markPossibleDuplicates flags rows matching an existing transaction by date+amount+description', () => {
  const existing: Transaction[] = [
    { id: 'tx-1', description: 'Uber Viagem', amount: 45, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-03-10', createdAt: '2026-03-10' },
  ];
  const rows = mapRowsToParsedTransactions(
    [{ Data: '10/03/2026', Descrição: 'Uber Viagem', Valor: '-45,00' }],
    ['Data', 'Descrição', 'Valor'],
    categories
  );
  const marked = markPossibleDuplicates(rows, existing);
  assert.equal(marked[0].possibleDuplicate, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --import tsx --test src/utils/csvXlsxParser.test.ts`
Expected: FAIL — `Cannot find module './csvXlsxParser.ts'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/csvXlsxParser.ts
// Relative import (not the @/ alias) so this file resolves identically under
// Next.js and under `node --import tsx --test` when csvXlsxParser.test.ts loads it.
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Category, Transaction, TransactionType } from '../types/finance';

export type StatementFormat = 'nubank_ptbr' | 'nubank_en' | 'generic';

export interface ParsedRow {
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  rawDate: string;
  hasError: boolean;
  errorMsg?: string;
  possibleDuplicate?: boolean;
}

export function detectStatementFormat(headers: string[]): StatementFormat {
  const h = headers.map((s) => s.toLowerCase().trim().replace(/"/g, ''));
  if (h.includes('descrição') || h.includes('descricao')) return 'nubank_ptbr';
  if (h.includes('title') && h.includes('amount')) return 'nubank_en';
  return 'generic';
}

export function parseStatementDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  return new Date().toISOString().split('T')[0];
}

export function parseStatementAmount(raw: string | number): { value: number; isNegative: boolean } {
  let s = String(raw).trim().replace(/R\$\s?/g, '').replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return { value: Math.abs(isNaN(num) ? 0 : num), isNegative: num < 0 };
}

function smartMapCategory(desc: string, categories: Category[]): string {
  const lower = desc.toLowerCase();
  for (const cat of categories) {
    if (cat.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) return cat.id;
  }
  return categories[0]?.id || '';
}

export function mapRowsToParsedTransactions(
  rawRows: Record<string, any>[],
  headers: string[],
  categories: Category[]
): ParsedRow[] {
  const format = detectStatementFormat(headers);
  const parsed: ParsedRow[] = [];

  rawRows.forEach((row, idx) => {
    try {
      let rawDate = '';
      let desc = '';
      let rawAmount: string | number = 0;
      let forceType: TransactionType | null = null;

      if (format === 'nubank_ptbr') {
        rawDate = row['Data'] || row['data'] || '';
        desc = row['Descrição'] || row['Descricao'] || row['descrição'] || row['descricao'] || '';
        rawAmount = row['Valor'] || row['valor'] || '0';
      } else if (format === 'nubank_en') {
        rawDate = row['date'] || row['Date'] || '';
        desc = row['title'] || row['Title'] || row['description'] || row['Description'] || '';
        rawAmount = row['amount'] || row['Amount'] || '0';
      } else {
        rawDate = row['Data'] || row['Date'] || row['data'] || row['date'] || row['DATA'] || '';
        desc = row['Descrição'] || row['Description'] || row['descricao'] || row['title'] ||
               row['DESCRIÇÃO'] || row['memo'] || row['Memo'] || 'Lançamento';
        rawAmount = row['Valor'] || row['Amount'] || row['valor'] || row['amount'] ||
                    row['VALOR'] || row['Debit'] || row['Credit'] || '0';
        const tipoRaw = String(row['Tipo'] || row['Type'] || row['tipo'] || '').toLowerCase();
        if (tipoRaw.includes('crédit') || tipoRaw.includes('credit') || tipoRaw.includes('receita') || tipoRaw.includes('entrada')) {
          forceType = 'INCOME';
        } else if (tipoRaw.includes('débit') || tipoRaw.includes('debit') || tipoRaw.includes('saida') || tipoRaw.includes('despesa')) {
          forceType = 'EXPENSE';
        }
      }

      const { value, isNegative } = parseStatementAmount(rawAmount);
      if (value === 0) return;

      const type: TransactionType = forceType ? forceType : isNegative ? 'EXPENSE' : 'INCOME';
      const date = parseStatementDate(rawDate);
      const descStr = String(desc).trim() || `Lançamento ${idx + 1}`;
      const hasError = !rawDate || value === 0;

      parsed.push({
        description: descStr,
        amount: value,
        type,
        categoryId: type === 'EXPENSE' ? smartMapCategory(descStr, categories) : '',
        date,
        rawDate: String(rawDate),
        hasError,
        errorMsg: !rawDate ? 'Data não encontrada' : undefined,
      });
    } catch {
      // linha não interpretável — ignorada silenciosamente, como já era o comportamento anterior
    }
  });

  return parsed;
}

export function markPossibleDuplicates(rows: ParsedRow[], existing: Transaction[]): ParsedRow[] {
  const existingKeys = new Set(
    existing.map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.description.trim().toLowerCase()}`)
  );
  return rows.map((row) => ({
    ...row,
    possibleDuplicate: existingKeys.has(`${row.date}|${row.amount.toFixed(2)}|${row.description.trim().toLowerCase()}`),
  }));
}

export function parseCSVFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => resolve({ headers: results.meta.fields || [], rows: results.data as Record<string, any>[] }),
      error: (err) => reject(err),
    });
  });
}

export async function parseXLSXFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --import tsx --test src/utils/csvXlsxParser.test.ts`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/csvXlsxParser.ts src/utils/csvXlsxParser.test.ts
git commit -m "$(cat <<'EOF'
Extract statement parsing into a tested, format-agnostic module

Pulls the CSV-parsing logic out of CSVImporterModal into pure,
unit-tested functions, adds XLSX support (SheetJS, runs entirely
client-side, no network calls), and adds duplicate detection against
already-imported transactions.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update `UserPreferences` type (drop email fields, add PIN hash)

**Files:**
- Modify: `src/types/finance.ts:44-50`

**Interfaces:**
- Produces: `UserPreferences` without `alertEmail`/`enableEmailAlerts`, with `pinHash: string | null` added. Every task touching `UserPreferences` from here on (7, 8, 17, 18) uses this exact shape.

- [ ] **Step 1: Replace the `UserPreferences` interface**

```typescript
export interface UserPreferences {
  userName: string;
  baseSalary: number; // Salário base mensal configurável (ex: R$ 1000)
  hideValues: boolean;
  pinHash: string | null; // null = nenhum PIN configurado ainda (primeiro uso)
}
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: new errors appear in `SettingsView.tsx` and `HealthTipsView.tsx` (both still reference `alertEmail`) — expected, fixed in Tasks 15 and 17. Confirm no *other* unexpected errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/finance.ts
git commit -m "$(cat <<'EOF'
Drop email fields from UserPreferences, add pinHash

alertEmail/enableEmailAlerts existed only to support the removed
Resend integration. pinHash replaces the hardcoded plaintext PIN.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Rewrite `storage.ts` — Supabase as source of truth, local cache, sync state, fixed deletes

**Files:**
- Modify: `src/services/storage.ts` (full rewrite)

**Interfaces:**
- Consumes: `INITIAL_CATEGORIES` icon/keyword shape from Task 3; `Category`/`Transaction`/`UserPreferences` from Task 7's `finance.ts`; `supabase`/`isSupabaseConfigured` from `src/services/supabaseClient.ts` (unchanged).
- Produces: `StorageService.getCategories(): Promise<Category[]>`, `.saveCategories(categories): Promise<void>`, `.getTransactions(): Promise<Transaction[]>`, `.saveTransactions(transactions): Promise<void>`, `.getUserPrefs(): Promise<UserPreferences>`, `.saveUserPrefs(prefs): Promise<void>`, `.clearAllData(): Promise<void>`. Also `onSyncStateChange(cb: (state: SyncState) => void): () => void` and `attachOnlineSync(getSnapshot): () => void`, and the `SyncState = 'synced' | 'syncing' | 'offline'` type. Task 18 (`page.tsx`) and Task 9 (`Navigation.tsx`, via a prop) consume all of these by these exact names.
- Fixes two real bugs found during the audit: (1) `user_id` was a UUID column but the app wrote a plain string to it, so every Supabase write failed silently and `getCategories`/`getTransactions`/`getUserPrefs` never read from Supabase at all — sync never worked. (2) deleting a category/transaction only removed it from the local array passed to `save*`, which only ever `upsert`s — the row stayed orphaned in Supabase forever. Both are fixed by matching the Task 2 schema (no `user_id`) and by diffing against the previous local cache to issue explicit deletes before upserting.
- Storage keys are bumped to `_v6` so stale cached fictitious data from earlier versions never resurfaces.

- [ ] **Step 1: Write the full implementation**

```typescript
// src/services/storage.ts
import { Category, Transaction, UserPreferences } from '@/types/finance';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  CATEGORIES: 'livinha_categories_v6',
  TRANSACTIONS: 'livinha_transactions_v6',
  USER_PREFS: 'livinha_user_prefs_v6',
};

// Nichos exatos da planilha "Controle da Livinha". Limites iniciais calculados
// a partir da média de gasto real (Jan-Ago/2026) nos meses em que cada nicho
// teve movimento, com ~30% de folga — ajustável a qualquer momento em Ajustes.
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-alimentacao', name: 'Alimentação', icon: 'Utensils', color: '#10B981', monthlyLimit: 150, keywords: ['mercado', 'alimentacao', 'restaurante', 'ifood', 'padaria', 'carrefour'] },
  { id: 'cat-uber', name: 'Uber', icon: 'Car', color: '#8257E5', monthlyLimit: 200, keywords: ['uber', '99', 'corrida'] },
  { id: 'cat-gasolina', name: 'Gasolina', icon: 'Fuel', color: '#F59E0B', monthlyLimit: 100, keywords: ['posto', 'gasolina', 'shell', 'ipiranga', 'combustivel'] },
  { id: 'cat-lavagem', name: 'Lavagem de Carro', icon: 'Sparkles', color: '#06B6D4', monthlyLimit: 50, keywords: ['lavagem', 'lava rapido', 'car wash', 'estetica automotiva'] },
  { id: 'cat-faculdade', name: 'Faculdade', icon: 'GraduationCap', color: '#3B82F6', monthlyLimit: 200, keywords: ['faculdade', 'mensalidade', 'universidade', 'curso'] },
  { id: 'cat-vestimenta', name: 'Vestimenta', icon: 'Shirt', color: '#EC4899', monthlyLimit: 200, keywords: ['vestuario', 'roupa', 'zara', 'renner', 'riachuelo', 'shein', 'loja'] },
  { id: 'cat-lazer', name: 'Lazer', icon: 'Gift', color: '#6366F1', monthlyLimit: 100, keywords: ['cinema', 'bar', 'lazer', 'show', 'ingresso'] },
  { id: 'cat-viagens', name: 'Viagens', icon: 'Plane', color: '#EF4444', monthlyLimit: 100, keywords: ['viagem', 'hotel', 'passagem', 'latam', 'gol', 'booking', 'airbnb'] },
  { id: 'cat-compras', name: 'Compras', icon: 'ShoppingBag', color: '#A855F7', monthlyLimit: 200, keywords: ['compras', 'loja', 'shopping', 'amazon', 'mercado livre'] },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', color: '#94A3B8', monthlyLimit: 250, keywords: ['outros', 'diversos'] },
];

export const INITIAL_PREFS: UserPreferences = {
  userName: 'Livinha',
  baseSalary: 1000.00,
  hideValues: false,
  pinHash: null,
};

export type SyncState = 'synced' | 'syncing' | 'offline';

type SyncListener = (state: SyncState) => void;
let listeners: SyncListener[] = [];
let currentSyncState: SyncState = 'offline';

export function onSyncStateChange(cb: SyncListener): () => void {
  listeners.push(cb);
  cb(currentSyncState);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}

function setSyncState(state: SyncState): void {
  currentSyncState = state;
  listeners.forEach((cb) => cb(state));
}

function readLocalCache<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Erro ao salvar cache local (${key}):`, e);
  }
}

function categoryToRow(c: Category) {
  return {
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color || null,
    monthly_limit: c.monthlyLimit,
    keywords: c.keywords || [],
  };
}

function rowToCategory(r: any): Category {
  return {
    id: r.id,
    name: r.name,
    icon: r.icon,
    color: r.color || undefined,
    monthlyLimit: Number(r.monthly_limit),
    keywords: r.keywords || [],
  };
}

function transactionToRow(t: Transaction) {
  return {
    id: t.id,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category_id: t.categoryId || null,
    date: t.date,
    created_at: t.createdAt,
  };
}

function rowToTransaction(r: any): Transaction {
  return {
    id: r.id,
    description: r.description,
    amount: Number(r.amount),
    type: r.type,
    categoryId: r.category_id || '',
    date: r.date,
    createdAt: r.created_at,
  };
}

export class StorageService {
  static async getCategories(): Promise<Category[]> {
    const cached = readLocalCache<Category[]>(STORAGE_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    if (!isSupabaseConfigured() || !supabase) {
      setSyncState('offline');
      return cached;
    }
    try {
      setSyncState('syncing');
      const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
      if (error) throw error;
      setSyncState('synced');
      if (!data || data.length === 0) {
        await StorageService.saveCategories(INITIAL_CATEGORIES);
        return INITIAL_CATEGORIES;
      }
      const mapped = data.map(rowToCategory);
      writeLocalCache(STORAGE_KEYS.CATEGORIES, mapped);
      return mapped;
    } catch (e) {
      console.warn('Supabase indisponível, usando cache local (categorias):', e);
      setSyncState('offline');
      return cached;
    }
  }

  static async saveCategories(categories: Category[]): Promise<void> {
    const previous = readLocalCache<Category[]>(STORAGE_KEYS.CATEGORIES, []);
    const newIds = new Set(categories.map((c) => c.id));
    const removedIds = previous.filter((c) => !newIds.has(c.id)).map((c) => c.id);
    writeLocalCache(STORAGE_KEYS.CATEGORIES, categories);

    if (!isSupabaseConfigured() || !supabase) {
      setSyncState('offline');
      return;
    }
    try {
      setSyncState('syncing');
      if (removedIds.length > 0) {
        const { error: delError } = await supabase.from('categories').delete().in('id', removedIds);
        if (delError) throw delError;
      }
      const { error } = await supabase.from('categories').upsert(categories.map(categoryToRow), { onConflict: 'id' });
      if (error) throw error;
      setSyncState('synced');
    } catch (e) {
      console.warn('Falha ao sincronizar categorias com o Supabase:', e);
      setSyncState('offline');
    }
  }

  static async getTransactions(): Promise<Transaction[]> {
    const cached = readLocalCache<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    if (!isSupabaseConfigured() || !supabase) {
      setSyncState('offline');
      return cached;
    }
    try {
      setSyncState('syncing');
      const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (error) throw error;
      setSyncState('synced');
      const mapped = (data || []).map(rowToTransaction);
      writeLocalCache(STORAGE_KEYS.TRANSACTIONS, mapped);
      return mapped;
    } catch (e) {
      console.warn('Supabase indisponível, usando cache local (transações):', e);
      setSyncState('offline');
      return cached;
    }
  }

  static async saveTransactions(transactions: Transaction[]): Promise<void> {
    const previous = readLocalCache<Transaction[]>(STORAGE_KEYS.TRANSACTIONS, []);
    const newIds = new Set(transactions.map((t) => t.id));
    const removedIds = previous.filter((t) => !newIds.has(t.id)).map((t) => t.id);
    writeLocalCache(STORAGE_KEYS.TRANSACTIONS, transactions);

    if (!isSupabaseConfigured() || !supabase) {
      setSyncState('offline');
      return;
    }
    try {
      setSyncState('syncing');
      if (removedIds.length > 0) {
        const { error: delError } = await supabase.from('transactions').delete().in('id', removedIds);
        if (delError) throw delError;
      }
      const { error } = await supabase.from('transactions').upsert(transactions.map(transactionToRow), { onConflict: 'id' });
      if (error) throw error;
      setSyncState('synced');
    } catch (e) {
      console.warn('Falha ao sincronizar transações com o Supabase:', e);
      setSyncState('offline');
    }
  }

  static async getUserPrefs(): Promise<UserPreferences> {
    const cached = readLocalCache<UserPreferences>(STORAGE_KEYS.USER_PREFS, INITIAL_PREFS);
    if (!isSupabaseConfigured() || !supabase) {
      setSyncState('offline');
      return cached;
    }
    try {
      setSyncState('syncing');
      const { data, error } = await supabase.from('user_preferences').select('*').eq('id', 'default').maybeSingle();
      if (error) throw error;
      setSyncState('synced');
      if (!data) {
        await StorageService.saveUserPrefs(INITIAL_PREFS);
        return INITIAL_PREFS;
      }
      const prefs: UserPreferences = {
        userName: data.user_name,
        baseSalary: Number(data.base_salary),
        hideValues: Boolean(data.hide_values),
        pinHash: data.pin_hash || null,
      };
      writeLocalCache(STORAGE_KEYS.USER_PREFS, prefs);
      return prefs;
    } catch (e) {
      console.warn('Supabase indisponível, usando cache local (preferências):', e);
      setSyncState('offline');
      return cached;
    }
  }

  static async saveUserPrefs(prefs: UserPreferences): Promise<void> {
    writeLocalCache(STORAGE_KEYS.USER_PREFS, prefs);
    if (!isSupabaseConfigured() || !supabase) {
      setSyncState('offline');
      return;
    }
    try {
      setSyncState('syncing');
      const { error } = await supabase.from('user_preferences').upsert(
        {
          id: 'default',
          user_name: prefs.userName,
          base_salary: prefs.baseSalary,
          hide_values: prefs.hideValues,
          pin_hash: prefs.pinHash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
      setSyncState('synced');
    } catch (e) {
      console.warn('Falha ao sincronizar preferências com o Supabase:', e);
      setSyncState('offline');
    }
  }

  static async clearAllData(): Promise<void> {
    writeLocalCache(STORAGE_KEYS.CATEGORIES, []);
    writeLocalCache(STORAGE_KEYS.TRANSACTIONS, []);
    writeLocalCache(STORAGE_KEYS.USER_PREFS, INITIAL_PREFS);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.USER_PREFS);
    }
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('transactions').delete().neq('id', '');
      await supabase.from('categories').delete().neq('id', '');
      await supabase.from('user_preferences').delete().neq('id', '');
    } catch (e) {
      console.warn('Falha ao limpar dados no Supabase:', e);
    }
  }
}

// Reenvia o snapshot atual (em memória, vindo do React state) para o
// Supabase quando a conexão volta — best-effort, sem fila de retries.
export function attachOnlineSync(getSnapshot: () => {
  categories: Category[];
  transactions: Transaction[];
  prefs: UserPreferences;
}): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    const { categories, transactions, prefs } = getSnapshot();
    StorageService.saveCategories(categories);
    StorageService.saveTransactions(transactions);
    StorageService.saveUserPrefs(prefs);
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: errors remain only in files not yet updated (`page.tsx` calling these as sync functions, `OpenFinanceView` already deleted, `HealthTipsView`/`SettingsView` still using `alertEmail`) — all fixed in later tasks. No errors inside `storage.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add src/services/storage.ts
git commit -m "$(cat <<'EOF'
Rewrite storage.ts: Supabase is now actually the source of truth

Previous version only ever wrote to Supabase (and failed silently
doing so — see Task 2) and always read from localStorage, so cross-
device sync never worked. This version reads from Supabase first with
localStorage as an offline cache, tracks sync state (synced/syncing/
offline), and fixes deleted rows never being removed from Supabase
(save* now diffs against the previous cache and issues explicit
deletes before upserting).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Design-system primitives — `Card`, `EmptyState`, `DashboardSkeleton`

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/DashboardSkeleton.tsx`

**Interfaces:**
- Produces: `Card` (props: `tone?: 'light' | 'dark'`, `padding?: 'sm' | 'md' | 'lg'`, plus standard `div` props), `EmptyState` (props: `icon: LucideIcon`, `title: string`, `description: string`, `actionLabel?: string`, `onAction?: () => void`), `DashboardSkeleton` (no props). Tasks 12, 15, 16, 19 import these by these exact names from `@/components/ui/Card`, `@/components/ui/EmptyState`, `@/components/ui/DashboardSkeleton`.
- No unit tests — purely presentational, verified visually in Task 21's manual checklist (consistent with the rest of this codebase, which has no component-level test infrastructure).

- [ ] **Step 1: Create `Card`**

Every screen today repeats `rounded-3xl border border-gray-100 shadow-sm p-6` (light cards) or `rounded-3xl bg-obsidian ... shadow-obsidian` (dark cards) with small inconsistencies (some use `p-5`, some `p-7 md:p-9`). This centralizes it.

```typescript
// src/components/ui/Card.tsx
import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'light' | 'dark';
  padding?: 'sm' | 'md' | 'lg';
}

const PADDING_CLASS: Record<NonNullable<CardProps['padding']>, string> = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-7 md:p-9',
};

export const Card: React.FC<CardProps> = ({ tone = 'light', padding = 'md', className, children, ...rest }) => {
  const toneClass =
    tone === 'dark'
      ? 'bg-obsidian text-white border border-obsidian-border shadow-obsidian'
      : 'bg-white text-gray-900 border border-gray-100 shadow-sm';

  return (
    <div className={twMerge('rounded-3xl', toneClass, PADDING_CLASS[padding], className)} {...rest}>
      {children}
    </div>
  );
};
```

- [ ] **Step 2: Create `EmptyState`**

Needed now that the app never ships fictitious seed transactions — every list can legitimately be empty on first use.

```typescript
// src/components/ui/EmptyState.tsx
import React from 'react';
import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-3xl bg-white border border-dashed border-gray-200">
    <div className="w-14 h-14 rounded-2xl bg-purple-50 text-brand flex items-center justify-center mb-4">
      <Icon size={26} />
    </div>
    <h3 className="text-sm font-bold text-gray-900">{title}</h3>
    <p className="text-xs text-gray-500 mt-1.5 max-w-xs">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-2xl text-xs font-bold shadow-md transition-all"
      >
        <Plus size={14} />
        {actionLabel}
      </button>
    )}
  </div>
);
```

- [ ] **Step 3: Create `DashboardSkeleton`**

Shown while the initial Supabase fetch is in flight, instead of a blank-then-populate flash.

```typescript
// src/components/ui/DashboardSkeleton.tsx
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
```

- [ ] **Step 4: Build check**

Run: `npx tsc --noEmit`
Expected: no new errors (these are new, unimported files — `tailwind-merge` is already a dependency per `package.json`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/EmptyState.tsx src/components/ui/DashboardSkeleton.tsx
git commit -m "$(cat <<'EOF'
Add shared Card, EmptyState, and DashboardSkeleton primitives

Consolidates the repeated card styling scattered across every screen
and adds the empty/loading states the app needs now that it no longer
ships fictitious seed data.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Rewrite `AppSecurityLock` — first-run PIN setup, hashed storage

**Files:**
- Modify: `src/components/AppSecurityLock.tsx` (full rewrite)

**Interfaces:**
- Consumes: `hashPin`/`verifyPin` from `@/utils/pin` (Task 5), `StorageService.getUserPrefs`/`saveUserPrefs` from `@/services/storage` (Task 8), `UserPreferences` from `@/types/finance` (Task 7).
- Produces: `AppSecurityLock` with props `{ children: React.ReactNode }` — the `userPin` prop is removed (no hardcoded default exists anymore). Task 19 (`page.tsx`) keeps wrapping the app in `<AppSecurityLock>{...}</AppSecurityLock>` unchanged.
- Behavior: on mount, loads prefs; if `pinHash` is `null` it shows a **create PIN** form (asks twice, hashes, saves); otherwise shows the **unlock** form (hashes the input and compares). Session unlock (`sessionStorage`) behavior is unchanged from before.

- [ ] **Step 1: Replace the file contents**

```typescript
// src/components/AppSecurityLock.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Heart, ArrowRight } from 'lucide-react';
import { StorageService } from '@/services/storage';
import { hashPin, verifyPin } from '@/utils/pin';
import { UserPreferences } from '@/types/finance';

interface AppSecurityLockProps {
  children: React.ReactNode;
}

type LockState = 'loading' | 'setup' | 'unlock' | 'unlocked';

export const AppSecurityLock: React.FC<AppSecurityLockProps> = ({ children }) => {
  const [state, setState] = useState<LockState>('loading');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alreadyUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('livinha_app_unlocked') === 'true';
    StorageService.getUserPrefs().then((loaded) => {
      setPrefs(loaded);
      if (alreadyUnlocked) setState('unlocked');
      else if (!loaded.pinHash) setState('setup');
      else setState('unlock');
    });
  }, []);

  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pinInput.length < 4) {
      setError('O PIN precisa ter pelo menos 4 dígitos.');
      return;
    }
    if (pinInput !== pinConfirm) {
      setError('Os PINs não coincidem. Tente novamente.');
      return;
    }
    const pinHash = await hashPin(pinInput);
    const updated: UserPreferences = { ...(prefs as UserPreferences), pinHash };
    setPrefs(updated);
    await StorageService.saveUserPrefs(updated);
    sessionStorage.setItem('livinha_app_unlocked', 'true');
    setState('unlocked');
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!prefs?.pinHash) return;
    const ok = await verifyPin(pinInput, prefs.pinHash);
    if (ok) {
      sessionStorage.setItem('livinha_app_unlocked', 'true');
      setState('unlocked');
    } else {
      setError('PIN incorreto. Tente novamente!');
      setPinInput('');
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'unlocked') {
    return <>{children}</>;
  }

  const isSetup = state === 'setup';

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-xs w-full bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl relative z-10 text-center animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand to-purple-400 text-white flex items-center justify-center font-black text-2xl shadow-lg mx-auto mb-4">
          L
        </div>

        <h1 className="text-sm font-extrabold uppercase tracking-widest text-gray-200 mb-1">GESTÃO DA LIVINHA</h1>
        <p className="text-xs text-brand font-semibold mb-6 flex items-center justify-center gap-1">
          Feito por Mozão <Heart size={12} className="fill-brand text-brand" />
        </p>

        <div className="p-3 bg-white/5 rounded-2xl border border-white/10 mb-6 flex items-center justify-center gap-2 text-xs font-medium text-gray-300">
          <Lock size={14} className="text-emerald-400" />
          <span>{isSetup ? 'Crie um PIN de acesso' : 'Acesso Protegido por PIN'}</span>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold animate-pulse">
            {error}
          </div>
        )}

        {isSetup ? (
          <form onSubmit={handleCreatePin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Escolha um PIN (mín. 4 dígitos)
              </label>
              <input
                type="password"
                maxLength={20}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-lg font-black py-3 px-4 rounded-2xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Confirme o PIN</label>
              <input
                type="password"
                maxLength={20}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-lg font-black py-3 px-4 rounded-2xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-dark text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-brand/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Criar PIN e Entrar</span>
              <ArrowRight size={14} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Digite o PIN de Acesso
              </label>
              <input
                type="password"
                maxLength={20}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••••••"
                className="w-full text-center tracking-widest text-lg font-black py-3 px-4 rounded-2xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-dark text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-brand/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Desbloquear Acesso</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>

      <footer className="mt-8 text-[11px] text-gray-500 font-semibold text-center">
        Seus dados ficam salvos com segurança e sincronizados entre seus aparelhos
      </footer>
    </div>
  );
};
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors in `AppSecurityLock.tsx`. `page.tsx` still fails to build (expected until Task 19).

- [ ] **Step 3: Commit**

```bash
git add src/components/AppSecurityLock.tsx
git commit -m "$(cat <<'EOF'
Replace hardcoded PIN with first-run setup + hashed storage

No more plaintext 'marrenta1234' default in source. First launch
prompts to create a PIN (asked twice), stored as a SHA-256 hash via
StorageService (Supabase + local cache) instead of a source literal.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Rewrite `Navigation` — 4 tabs, real sync indicator, primary add button

**Files:**
- Modify: `src/components/Navigation.tsx` (full rewrite)

**Interfaces:**
- Consumes: `SyncState` from `@/services/storage` (Task 8).
- Produces: `TabType = 'dashboard' | 'extract' | 'analysis' | 'settings'` (was 6 values, now 4 — `'reports'`/`'tips'` merge into `'analysis'`, `'openfinance'` is gone). `Navigation` props drop `onQuickSync`, `isSyncing`, and the never-rendered `userName` (verified unused in the current file — `Header.tsx`, the only place that rendered it, was dead code removed in Task 1), and add `syncState: SyncState`. Task 19 (`page.tsx`) renders `<Navigation activeTab={...} onTabChange={...} onOpenNewTransaction={...} hideValues={...} onToggleHideValues={...} hasAlerts={...} onOpenAlerts={...} syncState={...} />` — no `userName`, no `onQuickSync`, no `isSyncing`.

- [ ] **Step 1: Replace the file contents**

```typescript
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
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside `Navigation.tsx` itself. `page.tsx` still fails (expected until Task 19).

- [ ] **Step 3: Commit**

```bash
git add src/components/Navigation.tsx
git commit -m "$(cat <<'EOF'
Simplify Navigation to 4 tabs with a real sync indicator

Drops the Nubank Sync tab and the fake "100% Automático" badge, adds
a genuine synced/syncing/offline indicator wired to storage.ts, makes
"Novo Lançamento" the primary header action instead of a small
secondary icon, and removes the userName prop that Navigation never
actually rendered.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Update `MainBudgetCard` — use `Card`, drop dead props, clarify labels

**Files:**
- Modify: `src/components/MainBudgetCard.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Card` from `@/components/ui/Card` (Task 9).
- Produces: `MainBudgetCard` drops `onQuickSync`, `isSyncing` (dead after Task 1) and `availableBudget` (accepted in the current file but never referenced anywhere in its JSX — verified during planning). Remaining props keep their exact current names/types. Task 19 (`page.tsx`) stops passing these three.
- "Saldo Restante no Mês" is relabeled "Saldo do Mês" and "Saldo Final Livre" becomes "Sobra Após Investir" with a `title` tooltip explaining it's the monthly balance minus what was set aside as investment — today neither label explains the relationship, which the user flagged as confusing.

- [ ] **Step 1: Replace the file contents**

```typescript
// src/components/MainBudgetCard.tsx
'use client';

import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Smile, AlertTriangle, AlertCircle, X, DollarSign } from 'lucide-react';
import { formatCurrency, getMonthName } from '@/utils/formatters';
import { FinancialHealth } from '@/types/finance';
import { Card } from '@/components/ui/Card';

interface MainBudgetCardProps {
  currentMonth: number;
  currentYear: number;
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
  onUpdateBaseSalary: (newSalary: number) => void;
}

export const MainBudgetCard: React.FC<MainBudgetCardProps> = ({
  currentMonth,
  currentYear,
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
    if (!isNaN(val) && val > 0) onUpdateBaseSalary(val);
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
      <Card tone="dark" padding="lg" className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-brand/20 via-purple-600/10 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 relative z-10">
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <button onClick={onPrevMonth} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Mês Anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-extrabold tracking-widest text-gray-200 uppercase px-2">
              {getMonthName(currentMonth)} {currentYear}
            </span>
            <button onClick={onNextMonth} className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Próximo Mês">
              <ChevronRight size={16} />
            </button>
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

        <div className="mb-6 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
              Saldo do Mês (Receita − Despesas)
            </span>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-none">
              {formatCurrency(monthlyBalance, hideValues)}
            </h2>

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
              <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider block">Guardado em Investimento</span>
              <span className="text-xl font-extrabold text-brand-light block mt-0.5">
                {formatCurrency(totalInvestment, hideValues)}
              </span>
            </div>

            <div className="text-right">
              <span
                className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block"
                title="Saldo do mês já descontando o que foi guardado em investimento"
              >
                Sobra Após Investir
              </span>
              <span className="text-base font-extrabold text-emerald-400 block mt-0.5">
                {formatCurrency(finalBalance, hideValues)}
              </span>
            </div>
          </div>
        </div>

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
      </Card>

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
              <button onClick={() => setIsSalaryModalOpen(false)} className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Salário Base Mensal (R$)</label>
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
                  Este valor é somado à receita de cada mês para calcular a sobra — inclusive nos meses anteriores do histórico.
                </p>
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setIsSalaryModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm">
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
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside `MainBudgetCard.tsx`. `page.tsx` still fails (expected until Task 19).

- [ ] **Step 3: Commit**

```bash
git add src/components/MainBudgetCard.tsx
git commit -m "$(cat <<'EOF'
Simplify MainBudgetCard: shared Card, drop dead props, clearer labels

Drops onQuickSync/isSyncing (dead after removing fake sync) and
availableBudget (accepted but never rendered anywhere in the
component). Relabels "Saldo Final Livre" to "Sobra Após Investir"
with a tooltip explaining it's the monthly balance minus what was
invested — previously unexplained anywhere in the UI.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Update `CategoryNicheGrid` and `TransactionList` — shared icons, empty state, drop dead "Auto" badge

**Files:**
- Modify: `src/components/CategoryNicheGrid.tsx` (full rewrite)
- Modify: `src/components/TransactionList.tsx` (full rewrite)

**Interfaces:**
- Consumes: `resolveCategoryIcon` from `@/utils/categoryIcons` (Task 3), `EmptyState` from `@/components/ui/EmptyState` (Task 9).
- Produces: both components keep their exact current prop signatures — no callers need to change. `TransactionList` shows `EmptyState` when `transactions.length === 0` (the whole month has nothing yet) versus the existing lightweight "no results" message when filters/search produce zero from a non-empty list.
- Drops the `isAutoOpenFinance`/"Auto" badge logic in `TransactionList` (checked `tx.id.startsWith('tx-nubank')` or description containing `'Open Finance'` — dead now that nothing creates those IDs) and the unused `Landmark` import.

- [ ] **Step 1: Replace `CategoryNicheGrid.tsx`**

```typescript
// src/components/CategoryNicheGrid.tsx
'use client';

import React from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, getSemaphoreColor } from '@/utils/formatters';
import { resolveCategoryIcon } from '@/utils/categoryIcons';

interface CategoryNicheGridProps {
  categories: Category[];
  transactions: Transaction[];
  selectedCategoryId: string | null;
  hideValues: boolean;
  onSelectCategory: (id: string | null) => void;
  onOpenManageCategories: () => void;
}

export const CategoryNicheGrid: React.FC<CategoryNicheGridProps> = ({
  categories,
  transactions,
  selectedCategoryId,
  hideValues,
  onSelectCategory,
  onOpenManageCategories,
}) => {
  const getCategorySpent = (categoryId: string): number =>
    transactions.filter((t) => t.categoryId === categoryId && t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);

  return (
    <section className="my-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-brand" />
          NICHOS DE GASTOS
        </h3>
        <button
          onClick={onOpenManageCategories}
          className="text-xs font-bold text-brand hover:text-brand-dark flex items-center gap-1 transition-colors bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100"
        >
          <Plus size={14} />
          Gerenciar Nichos
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
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

        {categories.map((cat) => {
          const spent = getCategorySpent(cat.id);
          const percentage = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
          const semaph = getSemaphoreColor(percentage);
          const IconComponent = resolveCategoryIcon(cat.icon);
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
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-white/10 text-white' : 'bg-purple-50 text-brand border border-purple-100'
                  }`}
                >
                  <IconComponent size={18} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold truncate leading-tight">{cat.name}</h4>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                      isSelected ? 'bg-white/10 text-purple-200' : `${semaph.colorBg} ${semaph.colorText}`
                    }`}
                  >
                    {semaph.label}
                  </span>
                </div>
              </div>

              <div className="mt-auto">
                <div className="flex items-baseline justify-between text-xs font-bold mb-1.5">
                  <span className={isSelected ? 'text-white' : 'text-gray-900'}>{formatCurrency(spent, hideValues)}</span>
                  <span className="text-gray-400 text-[10px]">/ {formatCurrency(cat.monthlyLimit, hideValues)}</span>
                </div>
                <div className={`w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${isSelected ? 'bg-brand-light' : semaph.colorBar}`}
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
```

- [ ] **Step 2: Replace `TransactionList.tsx`**

```typescript
// src/components/TransactionList.tsx
'use client';

import React, { useState } from 'react';
import { Search, Trash2, Receipt } from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { resolveCategoryIcon } from '@/utils/categoryIcons';
import { EmptyState } from '@/components/ui/EmptyState';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  selectedCategoryId: string | null;
  hideValues: boolean;
  onAddTransaction: () => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  categories,
  selectedCategoryId,
  hideValues,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const filteredTransactions = transactions.filter((tx) => {
    if (selectedCategoryId && tx.categoryId !== selectedCategoryId) return false;
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchDesc = tx.description.toLowerCase().includes(term);
      const cat = categories.find((c) => c.id === tx.categoryId);
      return matchDesc || (cat ? cat.name.toLowerCase().includes(term) : false);
    }
    return true;
  });

  const getCategoryInfo = (categoryId: string) => categories.find((c) => c.id === categoryId) || { name: 'Outros', icon: 'Tag' };

  return (
    <section className="my-8">
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">LANÇAMENTOS DO MÊS</h3>
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-[11px] font-bold flex items-center justify-center">
            {filteredTransactions.length}
          </span>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum lançamento neste mês ainda"
          description="Toda vez que você gastar, receber ou investir algo, registre aqui — é assim que o app calcula sua saúde financeira."
          actionLabel="Adicionar Lançamento"
          onAction={onAddTransaction}
        />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-5">
            <div className="relative w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por descrição ou nicho..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all shadow-sm/50"
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200/80 w-full sm:w-auto shrink-0 justify-center shadow-sm/50">
              <button
                onClick={() => setFilterType('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${filterType === 'ALL' ? 'bg-obsidian text-white' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterType('EXPENSE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${filterType === 'EXPENSE' ? 'bg-red-50 text-red-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Saídas
              </button>
              <button
                onClick={() => setFilterType('INCOME')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${filterType === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                Entradas
              </button>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-gray-100 shadow-sm my-2">
              <p className="text-xs text-gray-400 font-medium">Nenhum lançamento encontrado para esses filtros.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => {
                const catInfo = getCategoryInfo(tx.categoryId);
                const IconComponent = resolveCategoryIcon(catInfo.icon);
                const isExpense = tx.type === 'EXPENSE';

                return (
                  <div
                    key={tx.id}
                    className="group flex items-center justify-between p-4 rounded-2xl bg-white border border-gray-100 hover:border-purple-100 shadow-sm/50 transition-all duration-200"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 text-brand flex items-center justify-center shrink-0">
                        <IconComponent size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{tx.description}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 font-medium">{formatDate(tx.date)}</span>
                          {catInfo.name && (
                            <span className="text-[10px] bg-gray-50 text-gray-500 px-2 py-0.5 rounded font-semibold">{catInfo.name}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-black flex items-center justify-end gap-0.5 ${isExpense ? 'text-gray-900' : 'text-emerald-600'}`}>
                        {isExpense ? '- ' : '+ '}
                        {formatCurrency(tx.amount, hideValues)}
                      </span>

                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-80 group-hover:opacity-100"
                        title="Excluir Lançamento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
};
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside either file.

- [ ] **Step 4: Commit**

```bash
git add src/components/CategoryNicheGrid.tsx src/components/TransactionList.tsx
git commit -m "$(cat <<'EOF'
Use shared icon map, add empty state, drop dead Open Finance badge

Both components had their own copy of an incomplete icon map; now use
resolveCategoryIcon. TransactionList shows a real empty state (with a
CTA to add the first transaction) instead of a blank list now that no
fictitious data ships, and drops the "Auto" badge logic that checked
for tx-nubank-* IDs nothing creates anymore.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Rewrite `CSVImporterModal` — CSV + XLSX, duplicate warnings, generic copy

**Files:**
- Modify: `src/components/CSVImporterModal.tsx` (full rewrite)

**Interfaces:**
- Consumes: `ParsedRow`, `parseCSVFile`, `parseXLSXFile`, `mapRowsToParsedTransactions`, `markPossibleDuplicates` from `@/utils/csvXlsxParser` (Task 6).
- Produces: `CSVImporterModal` adds a new required prop `existingTransactions: Transaction[]` (needed to detect duplicates) — Task 19 (`page.tsx`) passes the current `transactions` array. All other props (`isOpen`, `categories`, `onClose`, `onImportComplete`) are unchanged.
- Copy changes from Nubank-specific to generic ("Importar Planilha de Extrato" instead of "Importar Extrato CSV — Nubank"), and the file input now accepts `.csv,.txt,.xlsx,.xls`.

- [ ] **Step 1: Replace the file contents**

```typescript
// src/components/CSVImporterModal.tsx
'use client';

import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Edit3, ChevronDown, Smartphone, Info } from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { ParsedRow, parseCSVFile, parseXLSXFile, mapRowsToParsedTransactions, markPossibleDuplicates } from '@/utils/csvXlsxParser';

interface CSVImporterModalProps {
  isOpen: boolean;
  categories: Category[];
  existingTransactions: Transaction[];
  onClose: () => void;
  onImportComplete: (importedTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

export const CSVImporterModal: React.FC<CSVImporterModalProps> = ({
  isOpen,
  categories,
  existingTransactions,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setGlobalError(null);
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      const { headers, rows: rawRows } = isExcel ? await parseXLSXFile(file) : await parseCSVFile(file);
      const parsed = mapRowsToParsedTransactions(rawRows, headers, categories);
      const withDuplicates = markPossibleDuplicates(parsed, existingTransactions);

      if (withDuplicates.length === 0) {
        setGlobalError('Nenhuma transação válida encontrada. Verifique se o arquivo é um extrato exportado (CSV ou Excel).');
        setIsProcessing(false);
        return;
      }

      setRows(withDuplicates);
      setStep('preview');
    } catch {
      setGlobalError('Erro ao ler o arquivo. Confira se é um .csv ou .xlsx válido e tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleUpdateRow = (idx: number, field: keyof ParsedRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const validRows = rows.filter((r) => !r.hasError && r.amount > 0);
  const errorRows = rows.filter((r) => r.hasError);
  const duplicateCount = validRows.filter((r) => r.possibleDuplicate).length;

  const handleConfirm = () => {
    onImportComplete(
      validRows.map((r) => ({
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        date: r.date,
      }))
    );
    setStep('done');
    setTimeout(() => {
      setStep('upload');
      setRows([]);
      setFileName('');
      setGlobalError(null);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setFileName('');
    setGlobalError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-brand flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Importar Planilha de Extrato</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">CSV ou Excel — classificação automática por nicho, revisão antes de confirmar</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
          {step === 'upload' && (
            <>
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone size={14} className="text-brand" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand">Como exportar do Nubank (ou outro banco)</span>
                </div>
                <ol className="text-[11px] text-gray-700 space-y-1 list-decimal pl-4">
                  <li>Abra o app do seu banco no celular</li>
                  <li>Acesse o extrato e escolha "Exportar" em CSV ou Excel</li>
                  <li>Envie o arquivo para o computador (e-mail ou Drive)</li>
                  <li>Arraste ou selecione o arquivo abaixo</li>
                </ol>
              </div>

              {globalError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {globalError}
                </div>
              )}

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${dragging ? 'border-brand bg-purple-50' : 'border-purple-200 hover:border-brand bg-purple-50/40 hover:bg-purple-50'}`}
              >
                <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileInput} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-brand">Lendo arquivo...</p>
                  </div>
                ) : (
                  <>
                    <FileText size={36} className="mx-auto text-brand mb-2" />
                    <p className="text-xs font-bold text-gray-800">Clique ou arraste o arquivo aqui</p>
                    <p className="text-[10px] text-gray-500 mt-1">Extrato em .csv ou .xlsx</p>
                  </>
                )}
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-900">
                    {validRows.length} transações lidas de <span className="text-brand">{fileName}</span>
                  </span>
                </div>
                <button onClick={() => { setStep('upload'); setRows([]); setFileName(''); }} className="text-[11px] text-gray-400 hover:text-gray-700 underline">
                  Trocar arquivo
                </button>
              </div>

              {errorRows.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  <Info size={14} />
                  {errorRows.length} linha(s) com dados incompletos foram ignoradas automaticamente.
                </div>
              )}

              {duplicateCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {duplicateCount} linha(s) parecem já estar lançadas (mesma data, valor e descrição). Revise antes de confirmar.
                </div>
              )}

              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_1fr_40px] gap-0 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <span>Descrição</span>
                  <span>Valor</span>
                  <span>Nicho</span>
                  <span></span>
                </div>
                <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                  {rows.filter((r) => !r.hasError).map((row, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-[1fr_80px_1fr_40px] gap-1 items-center px-3 py-2 hover:bg-gray-50 transition-colors ${row.possibleDuplicate ? 'bg-amber-50/60' : ''}`}
                    >
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleUpdateRow(rows.indexOf(row), 'description', e.target.value)}
                          className="text-[11px] font-semibold text-gray-900 bg-transparent border-0 outline-none w-full truncate focus:ring-1 focus:ring-brand rounded px-1"
                        />
                        {row.possibleDuplicate && <span className="text-[9px] font-bold text-amber-700 px-1">Possível duplicata</span>}
                      </div>
                      <span className={`text-[11px] font-bold ${row.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-800'}`}>
                        {row.type === 'INCOME' ? '+' : '−'} R${row.amount.toFixed(2)}
                      </span>
                      {row.type === 'EXPENSE' ? (
                        <div className="relative">
                          <select
                            value={row.categoryId}
                            onChange={(e) => handleUpdateRow(rows.indexOf(row), 'categoryId', e.target.value)}
                            className="w-full text-[10px] font-semibold bg-gray-100 rounded-lg px-2 py-1 border-0 outline-none appearance-none cursor-pointer pr-5 text-gray-700"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold px-2 py-1 bg-emerald-50 rounded-lg">Receita</span>
                      )}
                      <button onClick={() => handleRemoveRow(rows.indexOf(row))} className="text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700">
                <Edit3 size={12} className="shrink-0" />
                <span>Nada é lançado até você confirmar — edite ou remova qualquer linha antes de importar.</span>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="py-8 text-center">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-900">Importação concluída!</p>
              <p className="text-xs text-gray-500 mt-1">{validRows.length} transações adicionadas com sucesso.</p>
            </div>
          )}
        </div>

        {step === 'preview' && validRows.length > 0 && (
          <div className="p-5 sm:p-6 border-t border-gray-100 shrink-0">
            <button onClick={handleConfirm} className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-2xl text-xs font-bold shadow-md transition-all">
              Confirmar Importação de {validRows.length} Transações
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside `CSVImporterModal.tsx` itself (`page.tsx` still failing until Task 19, which also supplies the new `existingTransactions` prop).

- [ ] **Step 3: Commit**

```bash
git add src/components/CSVImporterModal.tsx
git commit -m "$(cat <<'EOF'
Generalize CSVImporterModal to CSV+XLSX with duplicate warnings

Uses the extracted csvXlsxParser module, accepts .xlsx/.xls files
(needed for the real Excel data), and flags rows that look like
duplicates of already-imported transactions — addresses the concern
about bad data sneaking in, while keeping the final decision manual
via the existing review-before-confirm step.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Update `FullExtractView` — importer entry point, real empty state

**Files:**
- Modify: `src/components/FullExtractView.tsx` (full rewrite)

**Interfaces:**
- Consumes: `EmptyState` from `@/components/ui/EmptyState` (Task 9).
- Produces: `FullExtractView` adds two new required props: `onAddTransaction: () => void` (already existed) and `onOpenImporter: () => void` (new — this is where "Importar Planilha" now lives, since `OpenFinanceView` that used to host it is gone). Task 19 (`page.tsx`) wires `onOpenImporter={() => setIsCSVImporterOpen(true)}`.
- Also drops three imports that were never used in the original file (`Edit2`, `Filter`, `Check` — dead imports, confirmed unused in the source read during planning).

- [ ] **Step 1: Replace the file contents**

```typescript
// src/components/FullExtractView.tsx
'use client';

import React, { useState } from 'react';
import { Receipt, Search, Download, Trash2, UploadCloud, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { EmptyState } from '@/components/ui/EmptyState';

interface FullExtractViewProps {
  transactions: Transaction[];
  categories: Category[];
  hideValues: boolean;
  onUpdateTransactionCategory: (transactionId: string, newCategoryId: string) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: () => void;
  onOpenImporter: () => void;
}

export const FullExtractView: React.FC<FullExtractViewProps> = ({
  transactions,
  categories,
  hideValues,
  onUpdateTransactionCategory,
  onDeleteTransaction,
  onAddTransaction,
  onOpenImporter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  const filtered = transactions.filter((tx) => {
    if (selectedCategoryFilter !== 'ALL' && tx.categoryId !== selectedCategoryFilter) return false;
    if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchDesc = tx.description.toLowerCase().includes(term);
      const catName = categories.find((c) => c.id === tx.categoryId)?.name.toLowerCase() || '';
      return matchDesc || catName.includes(term);
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = 'Descrição,Valor,Tipo,Nicho,Data\n';
    const rows = filtered
      .map((tx) => {
        const cat = categories.find((c) => c.id === tx.categoryId)?.name || 'Sem Nicho';
        return `"${tx.description}",${tx.amount},${tx.type},"${cat}",${tx.date}`;
      })
      .join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-livinha-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Receipt className="text-brand" size={24} />
            Extrato Completo
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Visualize, filtre e corrija manualmente os nichos dos seus lançamentos</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onOpenImporter}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all"
          >
            <UploadCloud size={15} />
            Importar Planilha
          </button>
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all"
          >
            <Download size={15} />
            Exportar CSV
          </button>
        </div>
      </div>

      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhum lançamento registrado ainda"
          description="Assim que você começar a registrar seus gastos, entradas e investimentos, eles aparecem aqui — filtráveis por nicho, tipo ou busca."
          actionLabel="Adicionar Lançamento"
          onAction={onAddTransaction}
        />
      ) : (
        <>
          <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por descrição ou nicho..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="w-full sm:w-auto px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
              >
                <option value="ALL">Todos os Nichos</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-400 font-medium">
                Nenhuma transação encontrada com os filtros selecionados.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((tx) => {
                  const category = categories.find((c) => c.id === tx.categoryId);
                  return (
                    <div key={tx.id} className="p-4 hover:bg-gray-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold ${
                            tx.type === 'EXPENSE' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                          }`}
                        >
                          {tx.type === 'EXPENSE' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-gray-900 truncate">{tx.description}</h4>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            {formatDate(tx.date)}{category ? ` · ${category.name}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                        {tx.type === 'EXPENSE' && (
                          <select
                            value={tx.categoryId}
                            onChange={(e) => onUpdateTransactionCategory(tx.id, e.target.value)}
                            className="text-[11px] font-semibold bg-purple-50 text-brand border border-purple-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
                            title="Corrigir categoria manualmente"
                          >
                            <option value="">Selecione Nicho...</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}

                        <span className={`text-xs font-extrabold ${tx.type === 'EXPENSE' ? 'text-gray-900' : 'text-emerald-600'}`}>
                          {tx.type === 'EXPENSE' ? '- ' : '+ '}
                          {formatCurrency(tx.amount, hideValues)}
                        </span>

                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Excluir Lançamento"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside `FullExtractView.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/FullExtractView.tsx
git commit -m "$(cat <<'EOF'
Add spreadsheet-import entry point and real empty state to Extrato

Importar Planilha now lives here (its previous home, OpenFinanceView,
was removed). Shows a proper empty state with a call-to-action when
there are no transactions yet, instead of an empty filtered list.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Create `AnalysisView` (merges Reports + Health/Tips), delete both old files

**Files:**
- Create: `src/components/AnalysisView.tsx`
- Delete: `src/components/ReportsView.tsx`
- Delete: `src/components/HealthTipsView.tsx`

**Interfaces:**
- Consumes: `groupTransactionsByMonth`, `getCategoryTrend`, `projectMonthEndTotal`, `getCumulativeBalanceSeries` from `@/utils/insights` (Task 4); `EmptyState` from `@/components/ui/EmptyState` (Task 9).
- Produces: `AnalysisView` with props `{ transactions: Transaction[]; categories: Category[]; currentDate: Date; baseSalary: number; health: FinancialHealth; hideValues: boolean }`. **`transactions` here is the full history, not just the current month** — the component derives the current month internally so it can also compute trends/projections that need prior months. Task 19 (`page.tsx`) renders `<AnalysisView transactions={transactions} categories={categories} currentDate={currentDate} baseSalary={userPrefs.baseSalary} health={health} hideValues={userPrefs.hideValues} />` and drops its old `<ReportsView>`/`<HealthTipsView>` renders and the `'reports'`/`'tips'` tab branches.
- Replaces the hardcoded fake `monthlyData` bar chart (Task-1-era `ReportsView.tsx`) with a real cumulative-balance chart, and drops the email-alert section entirely (Task 1 already removed its backing API).

- [ ] **Step 1: Delete the two old views**

```bash
rm src/components/ReportsView.tsx src/components/HealthTipsView.tsx
```

- [ ] **Step 2: Create `AnalysisView.tsx`**

```typescript
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
```

- [ ] **Step 3: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside `AnalysisView.tsx`. Errors remain in `page.tsx` (still imports the now-deleted `ReportsView`/`HealthTipsView`) until Task 19.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Merge Reports and Health/Tips into a single real AnalysisView

Replaces the hardcoded fake monthlyData bar chart with a real
cumulative-balance history, adds month-end projection and savings
rate KPIs backed by the insights engine, and drops the Resend email
section entirely. Reports and Health/Tips were functionally
overlapping (both diagnostic) — merging into one screen matches how
the 4-tab navigation (Task 11) is organized.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Update `SettingsView` — drop email field, add PIN change

**Files:**
- Modify: `src/components/SettingsView.tsx` (full rewrite)

**Interfaces:**
- Consumes: `hashPin`, `verifyPin` from `@/utils/pin` (Task 5).
- Produces: `SettingsView` keeps its exact current prop signature (`userPrefs`, `categories`, `onUpdateUserPrefs`, `onOpenManageCategories`, `onResetData`) — no caller changes needed beyond `UserPreferences` no longer having `alertEmail` (Task 7). Adds a PIN-change form using the same `onUpdateUserPrefs` callback (sets `pinHash`).

- [ ] **Step 1: Replace the file contents**

```typescript
// src/components/SettingsView.tsx
'use client';

import React, { useState } from 'react';
import { Settings, User, Shield, SlidersHorizontal, Trash2, Save, CheckCircle2, KeyRound } from 'lucide-react';
import { Category, UserPreferences } from '@/types/finance';
import { hashPin, verifyPin } from '@/utils/pin';

interface SettingsViewProps {
  userPrefs: UserPreferences;
  categories: Category[];
  onUpdateUserPrefs: (prefs: UserPreferences) => void;
  onOpenManageCategories: () => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userPrefs,
  categories,
  onUpdateUserPrefs,
  onOpenManageCategories,
  onResetData,
}) => {
  const [userName, setUserName] = useState(userPrefs.userName);
  const [baseSalary, setBaseSalary] = useState((userPrefs.baseSalary || 1000).toString());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const salaryVal = parseFloat(baseSalary.replace(',', '.')) || 1000;
    onUpdateUserPrefs({ ...userPrefs, userName: userName.trim() || 'Livinha', baseSalary: salaryVal });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);

    if (userPrefs.pinHash) {
      const currentOk = await verifyPin(currentPin, userPrefs.pinHash);
      if (!currentOk) {
        setPinError('PIN atual incorreto.');
        return;
      }
    }
    if (newPin.length < 4) {
      setPinError('O novo PIN precisa ter pelo menos 4 dígitos.');
      return;
    }
    if (newPin !== newPinConfirm) {
      setPinError('Os PINs não coincidem.');
      return;
    }

    const pinHash = await hashPin(newPin);
    onUpdateUserPrefs({ ...userPrefs, pinHash });
    setCurrentPin('');
    setNewPin('');
    setNewPinConfirm('');
    setPinSuccess(true);
    setTimeout(() => setPinSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Settings className="text-brand" size={24} />
            Ajustes & Configurações
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Gerencie seu perfil, salário base, PIN de acesso e nichos de orçamento</p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>Configurações salvas com sucesso!</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <User size={16} className="text-brand" />
          PERFIL & RECEITA BASE
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Seu Nome / Apelido</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Salário Base Mensal (R$)</label>
              <input
                type="text"
                value={baseSalary}
                onChange={(e) => setBaseSalary(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-bold text-gray-900"
              />
            </div>
          </div>

          <button type="submit" className="bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2">
            <Save size={14} />
            Salvar Alterações
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
          <Shield size={16} className="text-brand" />
          PIN DE ACESSO
        </h3>

        {pinSuccess && (
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>PIN atualizado com sucesso!</span>
          </div>
        )}
        {pinError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">{pinError}</div>}

        <form onSubmit={handleChangePin} className="space-y-3">
          {userPrefs.pinHash && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">PIN Atual</label>
              <input
                type="password"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold"
              />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Novo PIN</label>
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Confirmar Novo PIN</label>
              <input
                type="password"
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold"
              />
            </div>
          </div>
          <button type="submit" className="bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2">
            <KeyRound size={14} />
            Atualizar PIN
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-brand flex items-center justify-center font-bold">
            <SlidersHorizontal size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Gerenciar Meus Nichos</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Você possui {categories.length} nichos configurados</p>
          </div>
        </div>

        <button onClick={onOpenManageCategories} className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all">
          Editar Nichos
        </button>
      </div>

      <div className="bg-red-50/60 p-6 rounded-3xl border border-red-100 shadow-sm flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold text-red-900">Recomeçar do Zero (Limpar Dados)</h4>
          <p className="text-[11px] text-red-700/80 mt-0.5">Remove todas as transações e nichos atuais para você criar seu próprio setup do zero.</p>
        </div>

        <button onClick={onResetData} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5">
          <Trash2 size={14} />
          Limpar Dados
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors inside `SettingsView.tsx` itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/SettingsView.tsx
git commit -m "$(cat <<'EOF'
Drop email field, add PIN change to SettingsView

alertEmail no longer exists on UserPreferences (Task 7). Adds a form
to change the access PIN (verifies the current one first when set),
reusing the same hashPin/verifyPin utilities as first-run setup.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: `CategoryModal` copy fix — remove Nubank-specific wording

**Files:**
- Modify: `src/components/CategoryModal.tsx:163` (label text only)

**Interfaces:**
- No prop/behavior changes — this is a one-line copy fix.

- [ ] **Step 1: Replace the label text**

Change:

```typescript
                  <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">
                    Palavras-Chave para o Nubank categorizar automático:
                  </label>
```

to:

```typescript
                  <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">
                    Palavras-chave para reconhecer este nicho ao importar uma planilha:
                  </label>
```

- [ ] **Step 2: Build check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/CategoryModal.tsx
git commit -m "$(cat <<'EOF'
Fix Nubank-specific copy in category keyword label

Keywords are used by the generic spreadsheet importer (Task 14), not
a Nubank-only integration.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 19: Rewrite `page.tsx` — async boot, skeleton, 4 tabs, sync wiring

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

**Interfaces:**
- Consumes everything produced by Tasks 3, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17: `StorageService`, `SyncState`, `onSyncStateChange`, `attachOnlineSync`, `INITIAL_PREFS` from `@/services/storage`; `TabType` from `@/components/Navigation`; `DashboardSkeleton` from `@/components/ui/DashboardSkeleton`; `AnalysisView` from `@/components/AnalysisView`.
- This is the last task that touches component wiring — after this, `npm run build` must pass cleanly with zero references to Pluggy, Resend, `OpenFinanceView`, `ReportsView`, `HealthTipsView`, or `Header`.
- Simplifies the income calculation: the old code excluded `INCOME` transactions whose description contained "salár"/"salar" from `extraIncome`, because the fictitious seed data stored the salary itself as a transaction. Now that salary only ever lives in `userPrefs.baseSalary` (never as a transaction — confirmed no task creates one), that string-matching workaround is dead weight and is removed: `extraIncome` is simply all `INCOME` transactions in the month.
- `handleUpdateBaseSalary` no longer hunts through transactions to update a "Salário"-labeled entry's amount (same reason) — it only updates `userPrefs`.
- `handleResetData` becomes `async` (calls `StorageService.clearAllData()` then reloads from storage) since deletion now also has to reach Supabase.

- [ ] **Step 1: Replace the file contents**

```typescript
// src/app/page.tsx
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Navigation, TabType } from '@/components/Navigation';
import { MainBudgetCard } from '@/components/MainBudgetCard';
import { CategoryNicheGrid } from '@/components/CategoryNicheGrid';
import { TransactionList } from '@/components/TransactionList';
import { TransactionModal } from '@/components/TransactionModal';
import { CSVImporterModal } from '@/components/CSVImporterModal';
import { CategoryModal } from '@/components/CategoryModal';
import { AnalysisView } from '@/components/AnalysisView';
import { FullExtractView } from '@/components/FullExtractView';
import { SettingsView } from '@/components/SettingsView';
import { AppSecurityLock } from '@/components/AppSecurityLock';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { StorageService, SyncState, onSyncStateChange, attachOnlineSync, INITIAL_PREFS } from '@/services/storage';
import { Category, Transaction, UserPreferences } from '@/types/finance';
import { calculateFinancialHealth } from '@/utils/formatters';
import { CheckCircle2, Heart, ShieldAlert, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>(INITIAL_PREFS);
  const [syncState, setSyncState] = useState<SyncState>('offline');

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCSVImporterOpen, setIsCSVImporterOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);

  // Snapshot ref so the 'online' listener (attached once) always sees current state
  const snapshotRef = useRef({ categories, transactions, prefs: userPrefs });
  useEffect(() => {
    snapshotRef.current = { categories, transactions, prefs: userPrefs };
  }, [categories, transactions, userPrefs]);

  useEffect(() => {
    let mounted = true;
    Promise.all([StorageService.getCategories(), StorageService.getTransactions(), StorageService.getUserPrefs()]).then(
      ([cats, txs, prefs]) => {
        if (!mounted) return;
        setCategories(cats);
        setTransactions(txs);
        setUserPrefs(prefs);
        setIsLoading(false);
      }
    );
    const unsubscribeSync = onSyncStateChange(setSyncState);
    const detachOnlineSync = attachOnlineSync(() => snapshotRef.current);
    return () => {
      mounted = false;
      unsubscribeSync();
      detachOnlineSync();
    };
  }, []);

  const monthTransactions = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    return transactions.filter((t) => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions, currentDate]);

  const totalIncome = useMemo(() => {
    const base = userPrefs.baseSalary && userPrefs.baseSalary > 0 ? userPrefs.baseSalary : 1000.0;
    const extraIncome = monthTransactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    return base + extraIncome;
  }, [monthTransactions, userPrefs.baseSalary]);

  const totalExpense = useMemo(
    () => monthTransactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

  const totalInvestment = useMemo(
    () => monthTransactions.filter((t) => t.type === 'INVESTMENT').reduce((sum, t) => sum + t.amount, 0),
    [monthTransactions]
  );

  const monthlyBalance = useMemo(() => totalIncome - totalExpense, [totalIncome, totalExpense]);
  const finalBalance = useMemo(() => monthlyBalance - totalInvestment, [monthlyBalance, totalInvestment]);
  const totalLimit = useMemo(() => categories.reduce((sum, c) => sum + c.monthlyLimit, 0), [categories]);

  const health = useMemo(
    () => calculateFinancialHealth(totalExpense, totalLimit > 0 ? totalLimit : totalIncome, currentDate),
    [totalExpense, totalLimit, totalIncome, currentDate]
  );

  const categoriesWithAlerts = useMemo(() => {
    return categories.filter((cat) => {
      const spent = monthTransactions.filter((t) => t.categoryId === cat.id && t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
      const percentage = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
      return percentage >= 80;
    });
  }, [categories, monthTransactions]);

  const handleToggleHideValues = () => {
    const updated = { ...userPrefs, hideValues: !userPrefs.hideValues };
    setUserPrefs(updated);
    StorageService.saveUserPrefs(updated);
  };

  const handleUpdateBaseSalary = (newSalary: number) => {
    const updated = { ...userPrefs, baseSalary: newSalary };
    setUserPrefs(updated);
    StorageService.saveUserPrefs(updated);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
  };

  const handleUpdateUserPrefs = (newPrefs: UserPreferences) => {
    setUserPrefs(newPrefs);
    StorageService.saveUserPrefs(newPrefs);
  };

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const created: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [created, ...transactions];
    setTransactions(updated);
    StorageService.saveTransactions(updated);

    if (newTx.type === 'INCOME' || newTx.type === 'INVESTMENT') {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }
  };

  const handleAddBatchTransactions = (newTxs: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    const createdItems: Transaction[] = newTxs.map((t, idx) => ({
      ...t,
      id: `tx-import-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
    }));
    const updated = [...createdItems, ...transactions];
    setTransactions(updated);
    StorageService.saveTransactions(updated);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    StorageService.saveTransactions(updated);
  };

  const handleUpdateTransactionCategory = (transactionId: string, newCategoryId: string) => {
    const updated = transactions.map((t) => (t.id === transactionId ? { ...t, categoryId: newCategoryId } : t));
    setTransactions(updated);
    StorageService.saveTransactions(updated);
  };

  const handleSaveCategories = (updatedCategories: Category[]) => {
    setCategories(updatedCategories);
    StorageService.saveCategories(updatedCategories);
  };

  const handleResetData = async () => {
    if (!confirm('Deseja limpar todos os dados e recomeçar do zero?')) return;
    await StorageService.clearAllData();
    const [cats, txs, prefs] = await Promise.all([
      StorageService.getCategories(),
      StorageService.getTransactions(),
      StorageService.getUserPrefs(),
    ]);
    setCategories(cats);
    setTransactions(txs);
    setUserPrefs(prefs);
  };

  if (isLoading) {
    return (
      <AppSecurityLock>
        <div className="min-h-screen bg-[#F8F9FA] pb-32 md:pb-12">
          <DashboardSkeleton />
        </div>
      </AppSecurityLock>
    );
  }

  return (
    <AppSecurityLock>
      <div className="min-h-screen bg-[#F8F9FA] pb-32 md:pb-12">
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenNewTransaction={() => setIsTransactionModalOpen(true)}
          hideValues={userPrefs.hideValues}
          onToggleHideValues={handleToggleHideValues}
          hasAlerts={categoriesWithAlerts.length > 0}
          onOpenAlerts={() => setShowAlertsDrawer(true)}
          syncState={syncState}
        />

        <main className="px-4 sm:px-6 md:px-8 max-w-5xl mx-auto pt-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              <MainBudgetCard
                currentMonth={currentDate.getMonth()}
                currentYear={currentDate.getFullYear()}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                totalInvestment={totalInvestment}
                monthlyBalance={monthlyBalance}
                finalBalance={finalBalance}
                totalLimit={totalLimit}
                hideValues={userPrefs.hideValues}
                health={health}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onOpenCategoriesModal={() => setIsCategoryModalOpen(true)}
                onUpdateBaseSalary={handleUpdateBaseSalary}
              />

              <CategoryNicheGrid
                categories={categories}
                transactions={monthTransactions}
                selectedCategoryId={selectedCategoryId}
                hideValues={userPrefs.hideValues}
                onSelectCategory={setSelectedCategoryId}
                onOpenManageCategories={() => setIsCategoryModalOpen(true)}
              />

              <TransactionList
                transactions={monthTransactions}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                hideValues={userPrefs.hideValues}
                onAddTransaction={() => setIsTransactionModalOpen(true)}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </div>
          )}

          {activeTab === 'extract' && (
            <div className="animate-fadeIn">
              <FullExtractView
                transactions={transactions}
                categories={categories}
                hideValues={userPrefs.hideValues}
                onUpdateTransactionCategory={handleUpdateTransactionCategory}
                onDeleteTransaction={handleDeleteTransaction}
                onAddTransaction={() => setIsTransactionModalOpen(true)}
                onOpenImporter={() => setIsCSVImporterOpen(true)}
              />
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="animate-fadeIn">
              <AnalysisView
                transactions={transactions}
                categories={categories}
                currentDate={currentDate}
                baseSalary={userPrefs.baseSalary}
                health={health}
                hideValues={userPrefs.hideValues}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fadeIn">
              <SettingsView
                userPrefs={userPrefs}
                categories={categories}
                onUpdateUserPrefs={handleUpdateUserPrefs}
                onOpenManageCategories={() => setIsCategoryModalOpen(true)}
                onResetData={handleResetData}
              />
            </div>
          )}
        </main>

        <footer className="mt-16 text-center text-xs text-gray-400 font-semibold py-4 flex items-center justify-center gap-1.5">
          <span>Gestão da Livinha</span>
          <span>•</span>
          <span className="text-brand flex items-center gap-1">
            Feito por Mozão <Heart size={12} className="fill-brand text-brand inline" />
          </span>
        </footer>

        <TransactionModal
          isOpen={isTransactionModalOpen}
          categories={categories}
          onClose={() => setIsTransactionModalOpen(false)}
          onSave={handleAddTransaction}
        />

        <CSVImporterModal
          isOpen={isCSVImporterOpen}
          categories={categories}
          existingTransactions={transactions}
          onClose={() => setIsCSVImporterOpen(false)}
          onImportComplete={handleAddBatchTransactions}
        />

        <CategoryModal
          isOpen={isCategoryModalOpen}
          categories={categories}
          baseSalary={userPrefs.baseSalary || 1000}
          onClose={() => setIsCategoryModalOpen(false)}
          onSaveCategories={handleSaveCategories}
        />

        {showAlertsDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={20} className="text-amber-500" />
                  <h3 className="text-base font-bold text-gray-900">Central de Avisos & Limites</h3>
                </div>
                <button onClick={() => setShowAlertsDrawer(false)} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>

              {categoriesWithAlerts.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Todos os nichos estão dentro do limite seguro (&lt; 80%)!</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-2">Os seguintes nichos ultrapassaram 80% do limite configurado:</p>
                  {categoriesWithAlerts.map((cat) => {
                    const spent = monthTransactions.filter((t) => t.categoryId === cat.id && t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
                    const percentage = Math.round((spent / cat.monthlyLimit) * 100);
                    return (
                      <div
                        key={cat.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                          percentage >= 100 ? 'bg-red-50 border-red-200 text-red-700 font-bold' : 'bg-amber-50 border-amber-200 text-amber-800 font-semibold'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span>{percentage}% (R$ {spent.toFixed(2)} / R$ {cat.monthlyLimit.toFixed(2)})</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppSecurityLock>
  );
}
```

- [ ] **Step 2: Full build check (should now be clean end-to-end)**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run build`
Expected: exits 0, no warnings about missing modules.

Run: `grep -rniE "pluggy|resend|openfinance|nubank sync" src`
Expected: no output (the word "Nubank" itself is still fine in copy — e.g. "Como exportar do Nubank" — only the removed integration's naming should be gone).

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "$(cat <<'EOF'
Rewire page.tsx for the manual-first redesign

Loads all data asynchronously from Supabase-backed storage.ts with a
loading skeleton, subscribes to real sync state, drops the Open
Finance tab and fake quick-sync handler, wires the new 4-tab
navigation and merged AnalysisView, and removes the salary-transaction
string-matching workaround now that salary only ever lives in
userPrefs.baseSalary.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 20: One-time seed script for the real Excel history

**Files:**
- Create: `scripts/seed-real-data.mjs`

**Interfaces:**
- Consumes: `@supabase/supabase-js` (already a dependency), `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local`.
- Standalone Node script — not part of the Next.js bundle, run manually once: `node scripts/seed-real-data.mjs`. Requires the Task 2 schema to already exist in the target Supabase project (the script upserts into `categories`, `transactions`, `user_preferences` and will fail if those tables don't exist yet).
- Data source: `Controle da Livinha (2).xlsx`, read and verified during planning (see conversation — Jan–Ago/2026 real monthly totals per nicho; Set–Dez were still zero in the spreadsheet, i.e. not-yet-happened months, and are intentionally not imported). The spreadsheet gives one total per nicho per month, not day-level transactions, so each becomes a single dated entry labeled "(importado da planilha)" so it reads clearly as a consolidated historical entry rather than a single real purchase.
- Idempotent: every row upserts on a deterministic ID (`tx-seed-{year}-{month}-{categoryId}`), so re-running the script after fixing a typo just overwrites the same rows instead of duplicating them.

- [ ] **Step 1: Create the script**

```javascript
// scripts/seed-real-data.mjs
// Uso: node scripts/seed-real-data.mjs
// Carrega o histórico real (Jan-Ago/2026) extraído da planilha "Controle da
// Livinha" no Supabase. Rode uma única vez, DEPOIS que o schema v2
// (supabase_schema.sql) já tiver sido aplicado no painel do Supabase.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const content = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local ausente — segue só com variáveis já exportadas no shell
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em .env.local antes de rodar este script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Categorias exatas da planilha "Controle da Livinha" (mesma lista de
// src/services/storage.ts — mantida em sincronia manualmente, pois este é
// um script standalone fora do bundle do Next.js).
const CATEGORIES = [
  { id: 'cat-alimentacao', name: 'Alimentação', icon: 'Utensils', color: '#10B981', monthly_limit: 150, keywords: ['mercado', 'alimentacao', 'restaurante', 'ifood', 'padaria', 'carrefour'] },
  { id: 'cat-uber', name: 'Uber', icon: 'Car', color: '#8257E5', monthly_limit: 200, keywords: ['uber', '99', 'corrida'] },
  { id: 'cat-gasolina', name: 'Gasolina', icon: 'Fuel', color: '#F59E0B', monthly_limit: 100, keywords: ['posto', 'gasolina', 'shell', 'ipiranga', 'combustivel'] },
  { id: 'cat-lavagem', name: 'Lavagem de Carro', icon: 'Sparkles', color: '#06B6D4', monthly_limit: 50, keywords: ['lavagem', 'lava rapido', 'car wash', 'estetica automotiva'] },
  { id: 'cat-faculdade', name: 'Faculdade', icon: 'GraduationCap', color: '#3B82F6', monthly_limit: 200, keywords: ['faculdade', 'mensalidade', 'universidade', 'curso'] },
  { id: 'cat-vestimenta', name: 'Vestimenta', icon: 'Shirt', color: '#EC4899', monthly_limit: 200, keywords: ['vestuario', 'roupa', 'zara', 'renner', 'riachuelo', 'shein', 'loja'] },
  { id: 'cat-lazer', name: 'Lazer', icon: 'Gift', color: '#6366F1', monthly_limit: 100, keywords: ['cinema', 'bar', 'lazer', 'show', 'ingresso'] },
  { id: 'cat-viagens', name: 'Viagens', icon: 'Plane', color: '#EF4444', monthly_limit: 100, keywords: ['viagem', 'hotel', 'passagem', 'latam', 'gol', 'booking', 'airbnb'] },
  { id: 'cat-compras', name: 'Compras', icon: 'ShoppingBag', color: '#A855F7', monthly_limit: 200, keywords: ['compras', 'loja', 'shopping', 'amazon', 'mercado livre'] },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', color: '#94A3B8', monthly_limit: 250, keywords: ['outros', 'diversos'] },
];

// Totais mensais reais por nicho, extraídos de "Controle da Livinha (2).xlsx".
// month é 0-indexado (0 = Janeiro) para bater com Date do JS. Categorias
// omitidas em um mês tiveram gasto zero naquele mês na planilha original.
const MONTHLY_EXPENSES = [
  { month: 0, values: { 'cat-alimentacao': 3.50, 'cat-uber': 67.50, 'cat-compras': 58.61, 'cat-outros': 630.00 } },
  { month: 1, values: { 'cat-alimentacao': 303.52, 'cat-uber': 269.00, 'cat-vestimenta': 69.90, 'cat-compras': 348.63, 'cat-outros': 105.00 } },
  { month: 2, values: { 'cat-alimentacao': 42.00, 'cat-uber': 223.66, 'cat-compras': 51.65, 'cat-outros': 53.40 } },
  { month: 3, values: { 'cat-alimentacao': 89.00, 'cat-uber': 173.67, 'cat-compras': 153.55, 'cat-outros': 35.40 } },
  { month: 4, values: { 'cat-alimentacao': 85.55, 'cat-uber': 96.83, 'cat-vestimenta': 179.80, 'cat-lazer': 60.00, 'cat-compras': 404.38, 'cat-outros': 204.40 } },
  { month: 5, values: { 'cat-alimentacao': 220.92, 'cat-uber': 200.71, 'cat-gasolina': 50.00, 'cat-compras': 96.37, 'cat-outros': 171.17 } },
  { month: 6, values: { 'cat-alimentacao': 119.75, 'cat-uber': 222.78, 'cat-gasolina': 117.24, 'cat-vestimenta': 200.00, 'cat-compras': 127.14, 'cat-outros': 161.89 } },
  { month: 7, values: { 'cat-uber': 54.87, 'cat-compras': 7.45 } }, // Agosto em andamento (dados até o dia 10)
];

const YEAR = 2026;
const BASE_SALARY = 1000.0;
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto'];

function buildTransactions() {
  const transactions = [];
  for (const { month, values } of MONTHLY_EXPENSES) {
    const lastDayOfMonth = new Date(YEAR, month + 1, 0).getDate();
    const date = `${YEAR}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
    for (const [categoryId, amount] of Object.entries(values)) {
      transactions.push({
        id: `tx-seed-${YEAR}-${String(month + 1).padStart(2, '0')}-${categoryId}`,
        description: `${MONTH_NAMES[month]} (importado da planilha)`,
        amount,
        type: 'EXPENSE',
        category_id: categoryId,
        date,
        created_at: new Date().toISOString(),
      });
    }
  }
  return transactions;
}

async function main() {
  console.log('Enviando categorias...');
  const { error: catError } = await supabase.from('categories').upsert(CATEGORIES, { onConflict: 'id' });
  if (catError) throw catError;

  console.log('Enviando preferências (nome + salário base)...');
  const { error: prefError } = await supabase
    .from('user_preferences')
    .upsert({ id: 'default', user_name: 'Livinha', base_salary: BASE_SALARY, hide_values: false }, { onConflict: 'id' });
  if (prefError) throw prefError;

  const transactions = buildTransactions();
  console.log(`Enviando ${transactions.length} lançamentos históricos (Jan-Ago/${YEAR})...`);
  const { error: txError } = await supabase.from('transactions').upsert(transactions, { onConflict: 'id' });
  if (txError) throw txError;

  console.log('Carga concluída com sucesso.');
}

main().catch((err) => {
  console.error('Falha na carga de dados:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the configured Supabase project**

Run: `node scripts/seed-real-data.mjs`
Expected: prints "Carga concluída com sucesso." with no thrown errors. (Requires `.env.local` to point at a Supabase project where Task 2's `supabase_schema.sql` has already been run — this is a manual prerequisite, not something this script can do for you.)

- [ ] **Step 3: Spot-check in the app**

Open the app, unlock with the PIN set up in Task 10, and confirm: February shows a negative "Saldo do Mês" (real data has Feb at −R$96,05), and the Análise tab's "Saldo Acumulado" chart has 8 bars (Jan–Ago).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-real-data.mjs
git commit -m "$(cat <<'EOF'
Add one-time seed script for the real Jan-Aug 2026 history

Loads the real category/month totals extracted from "Controle da
Livinha (2).xlsx" into Supabase — categories (all 10 real nichos),
base salary, and one consolidated transaction per nicho per month
(the spreadsheet only has monthly totals, not day-level entries).
Idempotent via deterministic IDs; run once after the Task 2 schema
is live.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 21: Final verification pass

**Files:** none (verification only)

**Interfaces:** N/A — this task closes out the plan.

- [ ] **Step 1: Full automated check**

```bash
npm run test
npx tsc --noEmit
npm run build
```

Expected: all three exit 0. `npm run test` reports 3 test files, ~16 passing assertions total (6 in `insights.test.ts`, 3 in `pin.test.ts`, 7 in `csvXlsxParser.test.ts`).

- [ ] **Step 2: Confirm nothing paid/external remains**

Run: `grep -rniE "pluggy|resend|@resend" src package.json`
Expected: no output.

Run: `grep -c "SUPABASE" .env.local.example`
Expected: only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` remain (2 lines).

- [ ] **Step 3: Manual UAT checklist (from the design spec §13 — run in the actual browser, both viewport sizes)**

- [ ] Adicionar, editar e excluir um lançamento manualmente pelo botão "Novo Lançamento".
- [ ] Trocar de mês no cartão do dashboard e confirmar que os totais recalculam.
- [ ] Criar, editar limite e excluir um nicho pela tela de Ajustes → Editar Nichos.
- [ ] Importar um `.csv` de teste e um `.xlsx` de teste pelo Extrato → Importar Planilha; confirmar que a etapa de revisão aparece antes de qualquer coisa ser lançada, e que uma linha repetida é marcada como "Possível duplicata".
- [ ] Apagar todos os dados de teste do navegador (ou usar uma aba anônima), abrir o app pela primeira vez e confirmar que pede para **criar** um PIN (não pede para digitar um já existente).
- [ ] Sair (fechar a aba) e voltar: confirmar que pede o PIN já criado.
- [ ] Abrir o app em duas abas (ou dois aparelhos) apontando pro mesmo Supabase, lançar algo em uma, atualizar a outra, e confirmar que aparece.
- [ ] No DevTools, simular offline, adicionar um lançamento, confirmar o indicador de sincronização muda para "Offline", voltar a conexão e confirmar que ele sincroniza.
- [ ] Checar responsivo em 375px (mobile), 768px (tablet) e 1280px+ (desktop) nas 4 abas — nada deve cortar texto, sobrepor botões ou exigir scroll horizontal.
- [ ] Confirmar que a aba "Análise" mostra a comparação com meses anteriores, a projeção de fechamento, a taxa de poupança e o gráfico de saldo acumulado usando dados reais (não mais números fixos no código).
- [ ] Instalar o app como PWA no celular (Adicionar à Tela de Início) e confirmar que abre em tela cheia, sem barra do navegador.

- [ ] **Step 4: Final commit (if the checklist above required any fixes)**

If any manual check fails, fix inline, re-run the specific automated check that covers it, and commit with a message describing exactly what was wrong and what changed. If everything passes with no changes needed, this task has no commit of its own.

---
