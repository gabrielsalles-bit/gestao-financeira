'use client';

import React, { useState, useCallback } from 'react';
import {
  Landmark, RefreshCw, CheckCircle2, ShieldCheck, Zap, AlertCircle,
  ArrowRight, Sparkles, Link2, Wifi, WifiOff, TrendingDown, TrendingUp, FileText, UploadCloud,
} from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface OpenFinanceViewProps {
  transactions: Transaction[];
  categories: Category[];
  onAddOpenFinanceTransactions: (newTxs: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
  hideValues: boolean;
  onOpenCSVImporter: () => void;
}

interface PluggyTransaction {
  providerTransactionId: string;
  description: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  date: string;
  accountName?: string;
}

type SyncStatus = 'idle' | 'loading' | 'connected' | 'no_bank' | 'error';

export const OpenFinanceView: React.FC<OpenFinanceViewProps> = ({
  transactions,
  categories,
  onAddOpenFinanceTransactions,
  hideValues,
  onOpenCSVImporter,
}) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pluggyTxs, setPluggyTxs] = useState<PluggyTransaction[]>([]);
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Match description against niche keywords
  const matchCategory = useCallback((desc: string): string => {
    const lower = desc.toLowerCase();
    for (const cat of categories) {
      if (cat.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) return cat.id;
    }
    return categories[0]?.id || '';
  }, [categories]);

  // Call POST /api/pluggy-sync to fetch real transactions
  const handleSync = async () => {
    setSyncStatus('loading');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/pluggy-sync', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao conectar com a Pluggy API');
      }

      if (!data.connected) {
        // No bank connected yet — show connect widget
        setConnectToken(data.connectToken);
        setSyncStatus('no_bank');
        return;
      }

      const now = new Date();
      setLastSyncTime(
        `${now.toLocaleDateString('pt-BR')} às ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
      );
      setPluggyTxs(data.transactions || []);
      setSyncStatus('connected');
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha na sincronização.');
      setSyncStatus('error');
    }
  };

  // Import selected Pluggy transactions into the app
  const handleImportTransaction = (tx: PluggyTransaction) => {
    if (importedIds.has(tx.providerTransactionId)) return;

    onAddOpenFinanceTransactions([{
      description: `Nubank: ${tx.description}`,
      amount: tx.amount,
      type: tx.type,
      categoryId: tx.type === 'EXPENSE' ? matchCategory(tx.description) : '',
      date: tx.date,
    }]);

    setImportedIds((prev) => new Set([...prev, tx.providerTransactionId]));
  };

  const handleImportAll = () => {
    const toImport = pluggyTxs.filter((tx) => !importedIds.has(tx.providerTransactionId));
    if (toImport.length === 0) return;

    onAddOpenFinanceTransactions(
      toImport.map((tx) => ({
        description: `Nubank: ${tx.description}`,
        amount: tx.amount,
        type: tx.type,
        categoryId: tx.type === 'EXPENSE' ? matchCategory(tx.description) : '',
        date: tx.date,
      }))
    );
    setImportedIds(new Set(pluggyTxs.map((t) => t.providerTransactionId)));
  };

  const alreadyImported = transactions.filter((t) => t.id.startsWith('tx-nubank'));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8257E5] via-[#6B21A8] to-[#121214] text-white p-6 md:p-8 shadow-obsidian border border-purple-900/40">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shrink-0">
              <Landmark size={28} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                SINCRO NUBANK &amp; NICHOS
              </span>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mt-1">
                Conexão Nubank &amp; Importação de Extratos
              </h2>
              <p className="text-xs text-purple-100 mt-1 max-w-md">
                Busca transações do seu Nubank (via API ou arquivo CSV exportado) e as classifica automaticamente nos seus nichos.
              </p>
            </div>
          </div>

          <button
            onClick={handleSync}
            disabled={syncStatus === 'loading'}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-white text-purple-950 font-extrabold px-5 py-3 rounded-2xl text-xs shadow-lg hover:bg-purple-50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncStatus === 'loading' ? 'animate-spin' : ''} />
            {syncStatus === 'loading' ? 'Buscando da API...' : 'Sincronizar via API'}
          </button>
        </div>

        {lastSyncTime && (
          <p className="text-[11px] text-purple-200 mt-3 relative z-10">
            Última sincronização: {lastSyncTime}
          </p>
        )}
      </div>

      {/* ── Card Destaque: Importação 100% Gratuita por CSV ── */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <UploadCloud size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                100% Grátis · Ilimitado
              </span>
            </div>
            <h3 className="text-base font-extrabold text-emerald-950 mt-1">
              Importar Extrato CSV do Nubank
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5 max-w-lg">
              Exporte o arquivo <code>.csv</code> direto pelo app do Nubank no seu celular. O sistema lê todas as compras e classifica nos nichos automaticamente sem erro!
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCSVImporter}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-6 py-3 rounded-2xl text-xs shadow-md transition-all shrink-0"
        >
          <FileText size={16} />
          Importar Arquivo CSV
        </button>
      </div>

      {/* ── Error State ── */}
      {syncStatus === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-red-800">Falha na Conexão com a Pluggy</p>
            <p className="text-[11px] text-red-700 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* ── No Bank Connected — Widget Prompt ── */}
      {syncStatus === 'no_bank' && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center">
          <WifiOff size={32} className="text-amber-500 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-amber-900 mb-1">Nenhum banco conectado ainda</h3>
          <p className="text-xs text-amber-700 mb-4">
            Para importar transações reais do Nubank, você precisa conectar sua conta via Open Finance. É seguro, rápido e regulamentado pelo Banco Central.
          </p>
          <a
            href={`https://dashboard.pluggy.ai/`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-2xl text-xs transition-all"
          >
            <Link2 size={14} />
            Conectar Nubank no Painel Pluggy
            <ArrowRight size={14} />
          </a>
          <p className="text-[11px] text-amber-600 mt-3">
            Após conectar, clique em "Sincronizar Nubank Agora" para importar seus extratos.
          </p>
        </div>
      )}

      {/* ── Connected: Show Transactions ── */}
      {syncStatus === 'connected' && pluggyTxs.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi size={16} className="text-emerald-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">
                {pluggyTxs.length} transações encontradas no Nubank
              </h3>
            </div>
            <button
              onClick={handleImportAll}
              className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
            >
              Importar Todas
            </button>
          </div>

          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {pluggyTxs.map((tx) => {
              const isImported = importedIds.has(tx.providerTransactionId);
              const matchedCat = categories.find((c) => c.id === matchCategory(tx.description));
              return (
                <div
                  key={tx.providerTransactionId}
                  className={`flex items-center justify-between p-4 transition-colors ${isImported ? 'bg-emerald-50/40' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'INCOME' ? 'bg-emerald-100' : 'bg-red-50'}`}>
                      {tx.type === 'INCOME'
                        ? <TrendingUp size={14} className="text-emerald-600" />
                        : <TrendingDown size={14} className="text-red-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{tx.description}</p>
                      <p className="text-[11px] text-gray-400">
                        {new Date(tx.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {matchedCat && <span className="ml-2 text-brand font-semibold">→ {matchedCat.name}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span className={`text-xs font-bold ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-900'}`}>
                      {hideValues ? '••••' : `R$ ${tx.amount.toFixed(2)}`}
                    </span>
                    {isImported ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                        <CheckCircle2 size={12} /> Importado
                      </span>
                    ) : (
                      <button
                        onClick={() => handleImportTransaction(tx)}
                        className="bg-brand text-white px-3 py-1.5 rounded-lg text-[10px] font-bold hover:bg-brand-dark transition-all"
                      >
                        Importar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {syncStatus === 'connected' && pluggyTxs.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <p className="text-xs font-semibold text-emerald-800">
            Nubank conectado, mas nenhuma transação nova encontrada nos últimos 90 dias.
          </p>
        </div>
      )}

      {/* ── How It Works ── */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-brand" />
          COMO FUNCIONA O MAPEAMENTO AUTOMÁTICO DE NICHOS
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
            <div className="font-extrabold text-brand mb-1">1. O Nubank Envia</div>
            <p className="text-gray-600 text-[11px]">
              A Pluggy puxa a transação bruta via Open Finance (ex: <em>"COMPRA DEBITO CARREFOUR R$ 150,00"</em>).
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100">
            <div className="font-extrabold text-brand mb-1">2. O Motor Compara</div>
            <p className="text-gray-600 text-[11px]">
              O sistema verifica as palavras-chave dos seus nichos (ex: <em>"carrefour", "mercado"</em>) e vincula automaticamente.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
            <div className="font-extrabold text-emerald-700 mb-1">3. Importar &amp; Atualizar</div>
            <p className="text-gray-600 text-[11px]">
              Com um clique, o valor entra no seu nicho certo e o saldo do mês se atualiza em tempo real!
            </p>
          </div>
        </div>
      </div>

      {/* ── Status da Conexão ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${syncStatus === 'connected' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Status da Conexão Pluggy</h4>
            <p className={`text-[11px] font-semibold flex items-center gap-1 mt-0.5 ${syncStatus === 'connected' ? 'text-emerald-600' : 'text-gray-400'}`}>
              {syncStatus === 'connected'
                ? <><CheckCircle2 size={12} /> Nubank Conectado via Open Finance</>
                : <><AlertCircle size={12} /> Aguardando Sincronização</>
              }
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Zap size={22} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900">Transações Importadas nesta Sessão</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {importedIds.size} importada(s) · {alreadyImported.length} total no sistema
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
