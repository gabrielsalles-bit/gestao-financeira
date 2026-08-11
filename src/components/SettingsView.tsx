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
