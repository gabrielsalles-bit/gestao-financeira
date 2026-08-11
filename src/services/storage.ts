import { Category, Transaction, UserPreferences } from '@/types/finance';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  CATEGORIES: 'livinha_categories_v4',
  TRANSACTIONS: 'livinha_transactions_v4',
  USER_PREFS: 'livinha_user_prefs_v5',
};

// Nichos Exatos da Planilha da Livinha
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-alimentacao', name: 'Alimentação', icon: 'Utensils', color: '#10B981', monthlyLimit: 300, keywords: ['mercado', 'alimentacao', 'restaurante', 'ifood', 'padaria', 'carrefour'] },
  { id: 'cat-uber', name: 'Uber', icon: 'Car', color: '#8257E5', monthlyLimit: 250, keywords: ['uber', '99', 'corrida'] },
  { id: 'cat-gasolina', name: 'Gasolina', icon: 'Zap', color: '#F59E0B', monthlyLimit: 150, keywords: ['posto', 'gasolina', 'shell', 'ipiranga', 'combustivel'] },
  { id: 'cat-vestimenta', name: 'Vestimenta', icon: 'Tag', color: '#EC4899', monthlyLimit: 100, keywords: ['vestuario', 'roupa', 'zara', 'renner', 'riachuelo', 'shein', 'loja'] },
  { id: 'cat-lazer', name: 'Lazer', icon: 'Gift', color: '#6366F1', monthlyLimit: 100, keywords: ['cinema', 'bar', 'lazer', 'show', 'ingresso'] },
  { id: 'cat-lavagem', name: 'Lavagem de Carro', icon: 'Sparkles', color: '#06B6D4', monthlyLimit: 50, keywords: ['lavagem', 'lava rapido', 'car wash', 'estetica automotiva'] },
  { id: 'cat-viagens', name: 'Viagens', icon: 'Home', color: '#EF4444', monthlyLimit: 30, keywords: ['viagem', 'hotel', 'passagem', 'latam', 'gol', 'booking', 'airbnb'] },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', color: '#94A3B8', monthlyLimit: 20, keywords: ['outros', 'diversos'] },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [
  // JANEIRO
  { id: 'tx-jan-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-01-01', createdAt: '2026-01-01' },
  { id: 'tx-jan-exp1', description: 'Uber Corrida', amount: 67.50, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-01-15', createdAt: '2026-01-15' },

  // FEVEREIRO
  { id: 'tx-fev-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-02-01', createdAt: '2026-02-01' },
  { id: 'tx-fev-exp1', description: 'Uber Corrida', amount: 269.00, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-02-14', createdAt: '2026-02-14' },

  // MARÇO
  { id: 'tx-mar-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-03-01', createdAt: '2026-03-01' },
  { id: 'tx-mar-exp1', description: 'Uber Corrida', amount: 223.66, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-03-18', createdAt: '2026-03-18' },

  // ABRIL
  { id: 'tx-abr-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-04-01', createdAt: '2026-04-01' },
  { id: 'tx-abr-exp1', description: 'Uber Corrida', amount: 173.67, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-04-10', createdAt: '2026-04-10' },

  // MAIO
  { id: 'tx-mai-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-05-01', createdAt: '2026-05-01' },
  { id: 'tx-mai-exp1', description: 'Uber Corrida', amount: 96.83, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-05-12', createdAt: '2026-05-12' },

  // JUNHO
  { id: 'tx-jun-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-06-01', createdAt: '2026-06-01' },
  { id: 'tx-jun-exp1', description: 'Uber Corrida', amount: 200.71, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-06-20', createdAt: '2026-06-20' },

  // JULHO
  { id: 'tx-jul-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-07-01', createdAt: '2026-07-01' },
  { id: 'tx-jul-exp1', description: 'Uber Corrida', amount: 222.78, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-07-05', createdAt: '2026-07-05' },
  { id: 'tx-jul-exp2', description: 'Compras Vestimenta', amount: 200.00, type: 'EXPENSE', categoryId: 'cat-vestimenta', date: '2026-07-19', createdAt: '2026-07-19' },

  // AGOSTO (ATUAL)
  { id: 'tx-ago-inc', description: 'Salário', amount: 1200.00, type: 'INCOME', categoryId: '', date: '2026-08-01', createdAt: '2026-08-01' },
  { id: 'tx-ago-exp1', description: 'Uber Corrida', amount: 54.87, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-08-03', createdAt: '2026-08-03' },
];

export const INITIAL_PREFS: UserPreferences = {
  userName: 'Livinha',
  baseSalary: 1200.00,
  hideValues: false,
  alertEmail: 'livinha@exemplo.com',
  enableEmailAlerts: true,
};

// ─────────────────────────────────────────────────────────
// Supabase Sync Helpers (async, cloud)
// ─────────────────────────────────────────────────────────
const ANON_USER_ID = 'livinha-app-user-v1';

async function syncTransactionsToSupabase(transactions: Transaction[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    // Upsert all transactions for this user
    const rows = transactions.map((t) => ({
      id: t.id,
      user_id: ANON_USER_ID,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category_id: t.categoryId || null,
      date: t.date,
      created_at: t.createdAt,
    }));
    await supabase.from('transactions').upsert(rows, { onConflict: 'id' });
  } catch (e) {
    console.warn('Supabase sync (transactions) failed, using localStorage fallback:', e);
  }
}

async function syncCategoriesToSupabase(categories: Category[]): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    const rows = categories.map((c) => ({
      id: c.id,
      user_id: ANON_USER_ID,
      name: c.name,
      icon: c.icon,
      color: c.color || '#8257E5',
      monthly_limit: c.monthlyLimit,
      keywords: c.keywords || [],
    }));
    await supabase.from('categories').upsert(rows, { onConflict: 'id' });
  } catch (e) {
    console.warn('Supabase sync (categories) failed, using localStorage fallback:', e);
  }
}

async function syncPrefsToSupabase(prefs: UserPreferences): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  try {
    await supabase.from('user_preferences').upsert(
      {
        id: ANON_USER_ID,
        user_name: prefs.userName,
        base_salary: prefs.baseSalary,
        hide_values: prefs.hideValues,
        alert_email: prefs.alertEmail,
        enable_email_alerts: prefs.enableEmailAlerts,
      },
      { onConflict: 'id' }
    );
  } catch (e) {
    console.warn('Supabase sync (prefs) failed, using localStorage fallback:', e);
  }
}

// ─────────────────────────────────────────────────────────
// Main StorageService (localStorage + Supabase fallback)
// ─────────────────────────────────────────────────────────
export class StorageService {
  static getCategories(): Category[] {
    if (typeof window === 'undefined') return INITIAL_CATEGORIES;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (!data) {
        this.saveCategories(INITIAL_CATEGORIES);
        return INITIAL_CATEGORIES;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CATEGORIES;
    } catch {
      return INITIAL_CATEGORIES;
    }
  }

  static saveCategories(categories: Category[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
      // Fire-and-forget cloud sync
      syncCategoriesToSupabase(categories);
    } catch (e) {
      console.error('Erro ao salvar categorias:', e);
    }
  }

  static getTransactions(): Transaction[] {
    if (typeof window === 'undefined') return INITIAL_TRANSACTIONS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!data) {
        this.saveTransactions(INITIAL_TRANSACTIONS);
        return INITIAL_TRANSACTIONS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TRANSACTIONS;
    } catch {
      return INITIAL_TRANSACTIONS;
    }
  }

  static saveTransactions(transactions: Transaction[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      // Fire-and-forget cloud sync
      syncTransactionsToSupabase(transactions);
    } catch (e) {
      console.error('Erro ao salvar transações:', e);
    }
  }

  static getUserPrefs(): UserPreferences {
    if (typeof window === 'undefined') return INITIAL_PREFS;
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PREFS);
      if (!data) {
        this.saveUserPrefs(INITIAL_PREFS);
        return INITIAL_PREFS;
      }
      return { ...INITIAL_PREFS, ...JSON.parse(data) };
    } catch {
      return INITIAL_PREFS;
    }
  }

  static saveUserPrefs(prefs: UserPreferences): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PREFS, JSON.stringify(prefs));
      // Fire-and-forget cloud sync
      syncPrefsToSupabase(prefs);
    } catch (e) {
      console.error('Erro ao salvar preferências:', e);
    }
  }

  static clearAllData(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEYS.CATEGORIES);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.USER_PREFS);
    } catch (e) {
      console.error('Erro ao limpar dados:', e);
    }
  }
}
