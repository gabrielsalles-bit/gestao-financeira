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
