'use client';

import React, { useState } from 'react';
import { Sparkles, Mail, Send, Bell, ShieldCheck, Heart, AlertTriangle, Lightbulb, TrendingUp, CheckCircle2 } from 'lucide-react';
import { Category, FinancialHealth, Transaction, UserPreferences } from '@/types/finance';
import { formatCurrency } from '@/utils/formatters';

interface HealthTipsViewProps {
  health: FinancialHealth;
  categories: Category[];
  transactions: Transaction[];
  userPrefs: UserPreferences;
  onUpdateUserPrefs: (prefs: UserPreferences) => void;
  hideValues: boolean;
}

export const HealthTipsView: React.FC<HealthTipsViewProps> = ({
  health,
  categories,
  transactions,
  userPrefs,
  onUpdateUserPrefs,
  hideValues,
}) => {
  const [emailInput, setEmailInput] = useState(userPrefs.alertEmail);
  const [testEmailSent, setTestEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Total expenses
  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  // Category breakdown calculation for personalized tips
  const categoryStats = categories.map((cat) => {
    const spent = transactions
      .filter((t) => t.categoryId === cat.id && t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    const shareOfTotal = totalExpense > 0 ? (spent / totalExpense) * 100 : 0;
    const shareOfLimit = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
    return { ...cat, spent, shareOfTotal, shareOfLimit };
  }).sort((a, b) => b.spent - a.spent);

  // Send test email simulation via Resend API
  const handleSendTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setSendingEmail(true);
    setTimeout(() => {
      setSendingEmail(false);
      setTestEmailSent(true);
      onUpdateUserPrefs({ ...userPrefs, alertEmail: emailInput });
      setTimeout(() => setTestEmailSent(false), 4000);
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banner Top */}
      <div className="rounded-3xl bg-obsidian text-white p-6 md:p-8 shadow-obsidian border border-obsidian-border relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-light px-2.5 py-0.5 rounded-full bg-brand/20 border border-brand/30">
              MÓDULO DE INTELIGÊNCIA FINANCEIRA
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight mt-2 flex items-center gap-2">
              <Sparkles size={24} className="text-amber-400" />
              Saúde Financeira & Dicas da Livinha
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-lg">
              Diagnóstico contínuo dos seus envelopes de orçamento com alertas automatizados por e-mail (Resend API).
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Status Atual</span>
            <span
              className={`text-base font-extrabold block mt-0.5 ${
                health.status === 'CRITICAL'
                  ? 'text-red-400'
                  : health.status === 'WARNING'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {health.status === 'CRITICAL' ? '🔴 Em Alerta' : health.status === 'WARNING' ? '🟡 Atenção' : '🟢 Excelente'}
            </span>
          </div>
        </div>
      </div>

      {/* Personalized AI Financial Health Tips (Section 4.5 PRD) */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
          <Lightbulb size={16} className="text-amber-500" />
          DICAS DE ORGANIZAÇÃO (REGRAS DE NEGÓCIO DA PLANILHA)
        </h3>

        <div className="space-y-3">
          {categoryStats.slice(0, 3).map((cat) => {
            if (cat.spent <= 0) return null;
            return (
              <div
                key={cat.id}
                className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 flex items-start gap-3"
              >
                <div className="p-2 rounded-xl bg-purple-100 text-brand shrink-0 mt-0.5">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-900">
                    Seus gastos com <span className="text-brand font-extrabold">{cat.name}</span> representam{' '}
                    <span className="text-brand font-extrabold">{cat.shareOfTotal.toFixed(0)}%</span> do seu orçamento total.
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Você já utilizou {formatCurrency(cat.spent, hideValues)} de um limite planejado de {formatCurrency(cat.monthlyLimit, hideValues)}.
                    {cat.shareOfLimit >= 80
                      ? ' Tente conter novas compras neste nicho para não comprometer sua margem de segurança.'
                      : ' Ótimo controle! Este nicho está dentro do padrão recomendado.'}
                  </p>
                </div>
              </div>
            );
          })}

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <Heart size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-900">Diagnóstico Global de Ritmo</h4>
              <p className="text-xs text-gray-600 mt-1">{health.tip}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Resend Email Alerts Configuration (Section 4.5 PRD) */}
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-50 text-brand">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                DISPAROS DE E-MAIL (RESEND API INTEGRATION)
              </h3>
              <p className="text-[11px] text-gray-500">Receba alertas em tempo real quando um nicho atingir 80% do limite</p>
            </div>
          </div>
        </div>

        {testEmailSent && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>E-mail de teste enviado com sucesso via Resend API para {emailInput}!</span>
          </div>
        )}

        <form onSubmit={handleSendTestEmail} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="seu.email@exemplo.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand font-semibold text-gray-900"
            />
            <button
              type="submit"
              disabled={sendingEmail}
              className="bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send size={14} className={sendingEmail ? 'animate-bounce' : ''} />
              {sendingEmail ? 'Enviando...' : 'Salvar & Testar Disparo'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">
            Regra ativa: Envio automático quando qualquer envelope atingir 80% do limite mensal.
          </p>
        </form>
      </div>
    </div>
  );
};
