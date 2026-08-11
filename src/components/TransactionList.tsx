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
