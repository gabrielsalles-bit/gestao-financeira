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
