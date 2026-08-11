'use client';

import React, { useState, useEffect } from 'react';
import { Lock, KeyRound, ShieldCheck, Heart, ArrowRight } from 'lucide-react';

interface AppSecurityLockProps {
  children: React.ReactNode;
  userPin?: string; // Senha de acesso privada
}

export const AppSecurityLock: React.FC<AppSecurityLockProps> = ({
  children,
  userPin = 'marrenta1234',
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [savedPin, setSavedPin] = useState<string>(userPin);

  useEffect(() => {
    // Check if session is already unlocked in this browser session
    const unlocked = sessionStorage.getItem('livinha_app_unlocked');
    if (unlocked === 'true') {
      setIsAuthenticated(true);
    }
    const localPin = localStorage.getItem('livinha_app_pin');
    if (localPin) {
      setSavedPin(localPin);
    }
  }, []);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === savedPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem('livinha_app_unlocked', 'true');
      setError(false);
    } else {
      setError(true);
      setPinInput('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-obsidian text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-xs w-full bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl relative z-10 text-center animate-fadeIn">
        {/* Brand Header */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand to-purple-400 text-white flex items-center justify-center font-black text-2xl shadow-lg mx-auto mb-4">
          L
        </div>

        <h1 className="text-sm font-extrabold uppercase tracking-widest text-gray-200 mb-1">
          GESTÃO DA LIVINHA
        </h1>
        <p className="text-xs text-brand font-semibold mb-6 flex items-center justify-center gap-1">
          Feito por Mozão <Heart size={12} className="fill-brand text-brand" />
        </p>

        <div className="p-3 bg-white/5 rounded-2xl border border-white/10 mb-6 flex items-center justify-center gap-2 text-xs font-medium text-gray-300">
          <Lock size={14} className="text-emerald-400" />
          <span>Acesso Protegido por Senha</span>
        </div>

        {error && (
          <div className="mb-4 p-2.5 bg-red-500/20 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold animate-pulse">
            Senha incorreta. Tente novamente!
          </div>
        )}

        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Digite a Senha de Acesso
            </label>
            <div className="relative">
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
          </div>

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white py-3.5 rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-brand/40 transition-all flex items-center justify-center gap-2"
          >
            <span>Desbloquear Acesso</span>
            <ArrowRight size={14} />
          </button>
        </form>
      </div>

      <footer className="mt-8 text-[11px] text-gray-500 font-semibold text-center">
        Proteção de Privacidade Nativa • 100% Gratuita
      </footer>
    </div>
  );
};
