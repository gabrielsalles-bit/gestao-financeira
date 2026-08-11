'use client';

import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Download,
  Trash2,
  Edit2,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Check
} from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface FullExtractViewProps {
  transactions: Transaction[];
  categories: Category[];
  hideValues: boolean;
  onUpdateTransactionCategory: (transactionId: string, newCategoryId: string) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: () => void;
}

export const FullExtractView: React.FC<FullExtractViewProps> = ({
  transactions,
  categories,
  hideValues,
  onUpdateTransactionCategory,
  onDeleteTransaction,
  onAddTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [editingTxId, setEditingTxId] = useState<string | null>(null);

  // Filtered transactions
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

  // Export CSV
  const handleExportCSV = () => {
    const headers = 'Descrição,Valor,Tipo,Nicho,Data\n';
    const rows = filtered.map((tx) => {
      const cat = categories.find((c) => c.id === tx.categoryId)?.name || 'Sem Nicho';
      return `"${tx.description}",${tx.amount},${tx.type},"${cat}",${tx.date}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato-livinha-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Receipt className="text-brand" size={24} />
            Extrato Completo & Ajustes de Categoria
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Visualize, filtre e corrija manualmente nichos de lançamentos do extrato
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-gray-50 transition-all"
        >
          <Download size={15} />
          Exportar CSV
        </button>
      </div>

      {/* Filter Bar */}
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

          {/* Category Dropdown Filter */}
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            <option value="ALL">Todos os Nichos</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Extrato Table List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-gray-400 font-medium">
            Nenhuma transação encontrada com os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((tx) => {
              const category = categories.find((c) => c.id === tx.categoryId);
              const isEditing = editingTxId === tx.id;

              return (
                <div
                  key={tx.id}
                  className="p-4 hover:bg-gray-50/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold ${
                        tx.type === 'EXPENSE'
                          ? 'bg-red-50 text-red-600 border border-red-100'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}
                    >
                      {tx.type === 'EXPENSE' ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 truncate">{tx.description}</h4>
                      <span className="text-[11px] text-gray-400 block mt-0.5">{formatDate(tx.date)}</span>
                    </div>
                  </div>

                  {/* Right side: Category Selector & Value */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-2 sm:pt-0">
                    {/* Category Selector (Live Correction) */}
                    {tx.type === 'EXPENSE' && (
                      <select
                        value={tx.categoryId}
                        onChange={(e) => onUpdateTransactionCategory(tx.id, e.target.value)}
                        className="text-[11px] font-semibold bg-purple-50 text-brand border border-purple-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand"
                        title="Corrigir categoria manualmente"
                      >
                        <option value="">Selecione Nicho...</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Amount */}
                    <span
                      className={`text-xs font-extrabold ${
                        tx.type === 'EXPENSE' ? 'text-gray-900' : 'text-emerald-600'
                      }`}
                    >
                      {tx.type === 'EXPENSE' ? '- ' : '+ '}
                      {formatCurrency(tx.amount, hideValues)}
                    </span>

                    {/* Delete button */}
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
    </div>
  );
};
