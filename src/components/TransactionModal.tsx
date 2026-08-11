'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Tag, ArrowUpRight, ArrowDownRight, PiggyBank } from 'lucide-react';
import { Category, Transaction, TransactionType } from '@/types/finance';

interface TransactionModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  categories,
  onClose,
  onSave,
}) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (!description.trim()) {
      setError('Por favor, informe a descrição do lançamento.');
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Por favor, insira um valor válido maior que zero.');
      return;
    }

    onSave({
      description: description.trim(),
      amount: parsedAmount,
      type,
      categoryId: type === 'EXPENSE' ? categoryId : '',
      date,
    });

    // Reset form
    setDescription('');
    setAmount('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl border border-gray-100 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900">Novo Lançamento</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Toggle Type: Saída / Entrada / Investimento */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('EXPENSE')}
              className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                type === 'EXPENSE'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowDownRight size={14} />
              Saída
            </button>

            <button
              type="button"
              onClick={() => setType('INCOME')}
              className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                type === 'INCOME'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ArrowUpRight size={14} />
              Entrada
            </button>

            <button
              type="button"
              onClick={() => setType('INVESTMENT')}
              className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold transition-all ${
                type === 'INVESTMENT'
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <PiggyBank size={14} />
              Investimento
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              placeholder={
                type === 'INVESTMENT'
                  ? 'Ex: Caixinha Nubank, Tesouro Direto'
                  : type === 'INCOME'
                  ? 'Ex: Salário, Freela'
                  : 'Ex: Uber, Carrefour, Farmácia'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all font-semibold"
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Valor (R$)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
              <input
                type="text"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all font-bold text-gray-900"
              />
            </div>
          </div>

          {/* Category Dropdown (only for Expense) */}
          {type === 'EXPENSE' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nicho / Envelope</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Limite: R$ {c.monthlyLimit})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full box-border px-3 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold appearance-none"
              style={{ maxWidth: '100%' }}
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-200"
            >
              Salvar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
