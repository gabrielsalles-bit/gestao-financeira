// src/components/AppSecurityLock.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Heart, ArrowRight } from 'lucide-react';
import { StorageService } from '@/services/storage';
import { hashPin, verifyPin } from '@/utils/pin';
import { UserPreferences } from '@/types/finance';

interface AppSecurityLockProps {
  children: React.ReactNode;
  onUnlock?: (prefs: UserPreferences) => void;
}

type LockState = 'loading' | 'setup' | 'unlock' | 'unlocked';

export const AppSecurityLock: React.FC<AppSecurityLockProps> = ({ children, onUnlock }) => {
  const [state, setState] = useState<LockState>('loading');
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const alreadyUnlocked = typeof window !== 'undefined' && sessionStorage.getItem('livinha_app_unlocked') === 'true';
    StorageService.getUserPrefs().then((loaded) => {
      setPrefs(loaded);
      if (alreadyUnlocked) {
        setState('unlocked');
        onUnlock?.(loaded);
      } else if (!loaded.pinHash) {
        setState('setup');
      } else {
        setState('unlock');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pinInput.length < 4) {
      setError('O PIN precisa ter pelo menos 4 dígitos.');
      return;
    }
    if (pinInput !== pinConfirm) {
      setError('Os PINs não coincidem. Tente novamente.');
      return;
    }
    const pinHash = await hashPin(pinInput);
    const updated: UserPreferences = { ...(prefs as UserPreferences), pinHash };
    setPrefs(updated);
    await StorageService.saveUserPrefs(updated);
    sessionStorage.setItem('livinha_app_unlocked', 'true');
    setState('unlocked');
    onUnlock?.(updated);
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!prefs?.pinHash) return;
    const ok = await verifyPin(pinInput, prefs.pinHash);
    if (ok) {
      sessionStorage.setItem('livinha_app_unlocked', 'true');
      setState('unlocked');
      onUnlock?.(prefs);
    } else {
      setError('PIN incorreto. Tente novamente!');
      setPinInput('');
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'unlocked') {
    return <>{children}</>;
  }

  const isSetup = state === 'setup';

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-xs w-full bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl relative z-10 text-center animate-fadeIn">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand to-purple-400 text-white flex items-center justify-center font-black text-2xl shadow-lg mx-auto mb-4">
          L
        </div>

        <h1 className="text-sm font-extrabold uppercase tracking-widest text-gray-200 mb-1">GESTÃO DA LIVINHA</h1>
        <p className="text-xs text-brand font-semibold mb-6 flex items-center justify-center gap-1">
          Feito por Mozão <Heart size={12} className="fill-brand text-brand" />
        </p>

        <div className="p-3 bg-white/5 rounded-2xl border border-white/10 mb-6 flex items-center justify-center gap-2 text-xs font-medium text-gray-300">
          <Lock size={14} className="text-emerald-400" />
          <span>{isSetup ? 'Crie um PIN de acesso' : 'Acesso Protegido por PIN'}</span>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold animate-pulse">
            {error}
          </div>
        )}

        {isSetup ? (
          <form onSubmit={handleCreatePin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Escolha um PIN (mín. 4 dígitos)
              </label>
              <input
                type="password"
                maxLength={20}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-lg font-black py-3 px-4 rounded-2xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Confirme o PIN</label>
              <input
                type="password"
                maxLength={20}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                placeholder="••••"
                className="w-full text-center tracking-widest text-lg font-black py-3 px-4 rounded-2xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-dark text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-brand/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Criar PIN e Entrar</span>
              <ArrowRight size={14} />
            </button>
          </form>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                Digite o PIN de Acesso
              </label>
              <input
                type="password"
                maxLength={20}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="••••••••"
                className="w-full text-center tracking-widest text-lg font-black py-3 px-4 rounded-2xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-brand hover:bg-brand-dark text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-brand/40 transition-all flex items-center justify-center gap-2"
            >
              <span>Desbloquear Acesso</span>
              <ArrowRight size={14} />
            </button>
          </form>
        )}
      </div>

      <footer className="mt-8 text-[11px] text-gray-500 font-semibold text-center">
        Seus dados ficam salvos com segurança e sincronizados entre seus aparelhos
      </footer>
    </div>
  );
};
