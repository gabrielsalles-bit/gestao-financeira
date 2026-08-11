'use client';

import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, SlidersHorizontal, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Category } from '@/types/finance';
import { formatCurrency } from '@/utils/formatters';

interface CategoryModalProps {
  isOpen: boolean;
  categories: Category[];
  baseSalary?: number;
  onClose: () => void;
  onSaveCategories: (updatedCategories: Category[]) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  categories,
  baseSalary = 1000.00,
  onClose,
  onSaveCategories,
}) => {
  const [items, setItems] = useState<Category[]>(categories);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLimit, setNewCatLimit] = useState('');
  const [newCatKeywords, setNewCatKeywords] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('Tag');

  // Synchronize items with categories prop whenever modal opens or categories change
  useEffect(() => {
    if (categories && categories.length > 0) {
      setItems(categories);
    }
  }, [categories, isOpen]);

  if (!isOpen) return null;

  const totalNicheLimit = items.reduce((sum, c) => sum + (c.monthlyLimit || 0), 0);
  const targetMonthlyBudget = baseSalary;
  const isBalanced = Math.abs(totalNicheLimit - targetMonthlyBudget) < 0.01;

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const limit = parseFloat(newCatLimit.replace(',', '.')) || 50;
    const keywordsList = newCatKeywords
      ? newCatKeywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
      : [newCatName.trim().toLowerCase()];

    const newCat: Category = {
      id: `cat-${Date.now()}`,
      name: newCatName.trim(),
      icon: newCatIcon,
      monthlyLimit: limit,
      keywords: keywordsList,
    };

    const updated = [...items, newCat];
    setItems(updated);
    onSaveCategories(updated);

    // Reset inputs
    setNewCatName('');
    setNewCatLimit('');
    setNewCatKeywords('');
  };

  const handleUpdateLimit = (id: string, newLimitStr: string) => {
    const limit = parseFloat(newLimitStr.replace(',', '.')) || 0;
    const updated = items.map((c) => (c.id === id ? { ...c, monthlyLimit: limit } : c));
    setItems(updated);
    onSaveCategories(updated);
  };

  const handleUpdateKeywords = (id: string, kwStr: string) => {
    const kwList = kwStr.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    const updated = items.map((c) => (c.id === id ? { ...c, keywords: kwList } : c));
    setItems(updated);
    onSaveCategories(updated);
  };

  const handleDelete = (id: string) => {
    if (items.length <= 1) return;
    const updated = items.filter((c) => c.id !== id);
    setItems(updated);
    onSaveCategories(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-gray-100 relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-brand" />
            <div>
              <h3 className="text-base font-bold text-gray-900">Configuração Lógica de Nichos</h3>
              <p className="text-[11px] text-gray-500">
                Distribua o limite total mensal de {formatCurrency(targetMonthlyBudget)} entre seus nichos
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Total Budget Logic Indicator */}
        <div
          className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between shrink-0 mb-4 border ${
            isBalanced
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {isBalanced ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>Soma dos Limites: {formatCurrency(totalNicheLimit)} / {formatCurrency(targetMonthlyBudget)}</span>
          </div>
          <span className="text-[10px] font-semibold">
            {isBalanced ? 'Perfeitamente Equilibrado!' : `Diferença: R$ ${(targetMonthlyBudget - totalNicheLimit).toFixed(2)}`}
          </span>
        </div>

        {/* Categories List (Exibe todos os nichos existentes) */}
        <div className="overflow-y-auto space-y-3 mb-4 pr-1 shrink max-h-60">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Nenhum nicho encontrado. Adicione um novo abaixo.</p>
          ) : (
            items.map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/70 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-gray-900">{cat.name}</span>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-semibold">Limite R$:</span>
                    <input
                      type="number"
                      value={cat.monthlyLimit}
                      onChange={(e) => handleUpdateLimit(cat.id, e.target.value)}
                      className="w-20 px-2 py-1 text-xs font-extrabold rounded-lg border border-gray-200 bg-white text-right focus:outline-none focus:ring-1 focus:ring-brand text-gray-900"
                    />
                    {items.length > 1 && (
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Excluir Nicho"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Keywords Input for Auto Matching */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-500 mb-0.5">
                    Palavras-chave para reconhecer este nicho ao importar uma planilha:
                  </label>
                  <input
                    type="text"
                    placeholder="ex: uber, corrida, 99"
                    value={cat.keywords ? cat.keywords.join(', ') : ''}
                    onChange={(e) => handleUpdateKeywords(cat.id, e.target.value)}
                    className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-brand text-gray-700 font-medium"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add New Category Form */}
        <form onSubmit={handleAddCategory} className="pt-3 border-t border-gray-100 shrink-0 space-y-3">
          <h4 className="text-xs font-bold text-gray-900">Adicionar Novo Nicho</h4>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Nome do Nicho"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand font-semibold"
            />
            <input
              type="text"
              placeholder="Limite (R$)"
              value={newCatLimit}
              onChange={(e) => setNewCatLimit(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand font-semibold"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus size={14} />
            Adicionar Nicho
          </button>
        </form>
      </div>
    </div>
  );
};
