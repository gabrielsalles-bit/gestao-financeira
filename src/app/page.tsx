'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Navigation, TabType } from '@/components/Navigation';
import { MainBudgetCard } from '@/components/MainBudgetCard';
import { CategoryNicheGrid } from '@/components/CategoryNicheGrid';
import { TransactionList } from '@/components/TransactionList';
import { TransactionModal } from '@/components/TransactionModal';
import { CSVImporterModal } from '@/components/CSVImporterModal';
import { CategoryModal } from '@/components/CategoryModal';
import { OpenFinanceView } from '@/components/OpenFinanceView';
import { HealthTipsView } from '@/components/HealthTipsView';
import { ReportsView } from '@/components/ReportsView';
import { FullExtractView } from '@/components/FullExtractView';
import { SettingsView } from '@/components/SettingsView';
import { AppSecurityLock } from '@/components/AppSecurityLock';
import { StorageService } from '@/services/storage';
import { Category, Transaction, UserPreferences } from '@/types/finance';
import { calculateFinancialHealth } from '@/utils/formatters';
import { AlertTriangle, CheckCircle2, Heart, RotateCcw, ShieldAlert, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>({
    userName: 'Livinha',
    baseSalary: 1000.00,
    hideValues: false,
    alertEmail: 'livinha@exemplo.com',
    enableEmailAlerts: true,
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isCSVImporterOpen, setIsCSVImporterOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [showAlertsDrawer, setShowAlertsDrawer] = useState(false);

  // Load initial data on mount
  useEffect(() => {
    setCategories(StorageService.getCategories());
    setTransactions(StorageService.getTransactions());
    setUserPrefs(StorageService.getUserPrefs());
  }, []);

  // Filter transactions by current month & year
  const monthTransactions = useMemo(() => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    return transactions.filter((t) => {
      const d = new Date(t.date + 'T00:00:00');
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [transactions, currentDate]);

  // Total Income = Base Salary (from userPrefs) + Extra non-salary income
  const totalIncome = useMemo(() => {
    const extraIncome = monthTransactions
      .filter(
        (t) =>
          t.type === 'INCOME' &&
          !t.description.toLowerCase().includes('salár') &&
          !t.description.toLowerCase().includes('salar')
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const base = userPrefs.baseSalary && userPrefs.baseSalary > 0 ? userPrefs.baseSalary : 1000.00;
    return base + extraIncome;
  }, [monthTransactions, userPrefs.baseSalary]);

  const totalExpense = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const totalInvestment = useMemo(() => {
    return monthTransactions
      .filter((t) => t.type === 'INVESTMENT')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const monthlyBalance = useMemo(() => {
    return totalIncome - totalExpense;
  }, [totalIncome, totalExpense]);

  const finalBalance = useMemo(() => {
    return monthlyBalance - totalInvestment;
  }, [monthlyBalance, totalInvestment]);

  const totalLimit = useMemo(() => {
    return categories.reduce((sum, c) => sum + c.monthlyLimit, 0);
  }, [categories]);

  const availableBudget = useMemo(() => {
    return monthlyBalance;
  }, [monthlyBalance]);

  // Health Score Calculation
  const health = useMemo(() => {
    return calculateFinancialHealth(totalExpense, totalLimit > 0 ? totalLimit : totalIncome, currentDate);
  }, [totalExpense, totalLimit, totalIncome, currentDate]);

  // Check categories with >80% for alerts
  const categoriesWithAlerts = useMemo(() => {
    return categories.filter((cat) => {
      const spent = monthTransactions
        .filter((t) => t.categoryId === cat.id && t.type === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);
      const percentage = cat.monthlyLimit > 0 ? (spent / cat.monthlyLimit) * 100 : 0;
      return percentage >= 80;
    });
  }, [categories, monthTransactions]);

  // Automatic Open Finance Keyword Matching Logic
  const matchCategoryForDescription = (desc: string): string => {
    const lower = desc.toLowerCase();
    for (const cat of categories) {
      if (cat.keywords && cat.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        return cat.id;
      }
    }
    return categories[0]?.id || '';
  };

  // Quick Open Finance Automatic Sync Simulation
  const handleQuickSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      const now = new Date();
      const mockDesc = 'Nubank: Uber Corrida (Open Finance)';
      const mockNubankFetch: Omit<Transaction, 'id' | 'createdAt'>[] = [
        {
          description: mockDesc,
          amount: 28.50,
          type: 'EXPENSE',
          categoryId: matchCategoryForDescription(mockDesc),
          date: now.toISOString().split('T')[0],
        },
      ];
      handleAddBatchTransactions(mockNubankFetch);
    }, 1200);
  };

  // Handlers for Base Salary & Preferences with Instant Multi-Component Propagation
  const handleToggleHideValues = () => {
    const updated = { ...userPrefs, hideValues: !userPrefs.hideValues };
    setUserPrefs(updated);
    StorageService.saveUserPrefs(updated);
  };

  const handleUpdateBaseSalary = (newSalary: number) => {
    const updatedPrefs = { ...userPrefs, baseSalary: newSalary };
    setUserPrefs(updatedPrefs);
    StorageService.saveUserPrefs(updatedPrefs);

    const updatedTransactions = transactions.map((t) => {
      if (t.type === 'INCOME' && (t.description.toLowerCase().includes('salár') || t.description.toLowerCase().includes('salar'))) {
        return { ...t, amount: newSalary };
      }
      return t;
    });

    setTransactions(updatedTransactions);
    StorageService.saveTransactions(updatedTransactions);
    confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
  };

  const handleUpdateUserPrefs = (newPrefs: UserPreferences) => {
    setUserPrefs(newPrefs);
    StorageService.saveUserPrefs(newPrefs);

    if (newPrefs.baseSalary && newPrefs.baseSalary !== userPrefs.baseSalary) {
      handleUpdateBaseSalary(newPrefs.baseSalary);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const created: Transaction = {
      ...newTx,
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [created, ...transactions];
    setTransactions(updated);
    StorageService.saveTransactions(updated);

    if (newTx.type === 'INCOME' || newTx.type === 'INVESTMENT') {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }
  };

  const handleAddBatchTransactions = (newTxs: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    const createdItems: Transaction[] = newTxs.map((t, idx) => ({
      ...t,
      id: `tx-nubank-${Date.now()}-${idx}`,
      createdAt: new Date().toISOString(),
    }));
    const updated = [...createdItems, ...transactions];
    setTransactions(updated);
    StorageService.saveTransactions(updated);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
  };

  const handleDeleteTransaction = (id: string) => {
    const updated = transactions.filter((t) => t.id !== id);
    setTransactions(updated);
    StorageService.saveTransactions(updated);
  };

  const handleUpdateTransactionCategory = (transactionId: string, newCategoryId: string) => {
    const updated = transactions.map((t) =>
      t.id === transactionId ? { ...t, categoryId: newCategoryId } : t
    );
    setTransactions(updated);
    StorageService.saveTransactions(updated);
  };

  const handleImportComplete = (imported: Omit<Transaction, 'id' | 'createdAt'>[]) => {
    handleAddBatchTransactions(imported);
  };

  const handleSaveCategories = (updatedCategories: Category[]) => {
    setCategories(updatedCategories);
    StorageService.saveCategories(updatedCategories);
  };

  const handleResetData = () => {
    if (confirm('Deseja limpar todos os dados e recomeçar do zero?')) {
      StorageService.clearAllData();
      setCategories(StorageService.getCategories());
      setTransactions(StorageService.getTransactions());
      setUserPrefs(StorageService.getUserPrefs());
    }
  };

  return (
    <AppSecurityLock>
      <div className="min-h-screen bg-[#F8F9FA] pb-32 md:pb-12">
        {/* Top Clean Header & Mobile Nav */}
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenNewTransaction={() => setIsTransactionModalOpen(true)}
          userName={userPrefs.userName}
          hideValues={userPrefs.hideValues}
          onToggleHideValues={handleToggleHideValues}
          hasAlerts={categoriesWithAlerts.length > 0}
          onOpenAlerts={() => setShowAlertsDrawer(true)}
          onQuickSync={handleQuickSync}
          isSyncing={isSyncing}
        />

        {/* Main Container */}
        <main className="px-4 sm:px-6 md:px-8 max-w-5xl mx-auto pt-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Main Dark Budget Card */}
              <MainBudgetCard
                currentMonth={currentDate.getMonth()}
                currentYear={currentDate.getFullYear()}
                availableBudget={availableBudget}
                totalIncome={totalIncome}
                totalExpense={totalExpense}
                totalInvestment={totalInvestment}
                monthlyBalance={monthlyBalance}
                finalBalance={finalBalance}
                totalLimit={totalLimit}
                hideValues={userPrefs.hideValues}
                health={health}
                onPrevMonth={handlePrevMonth}
                onNextMonth={handleNextMonth}
                onOpenCategoriesModal={() => setIsCategoryModalOpen(true)}
                onQuickSync={handleQuickSync}
                isSyncing={isSyncing}
                onUpdateBaseSalary={handleUpdateBaseSalary}
              />

              {/* Niche Envelopes Grid */}
              <CategoryNicheGrid
                categories={categories}
                transactions={monthTransactions}
                selectedCategoryId={selectedCategoryId}
                hideValues={userPrefs.hideValues}
                onSelectCategory={setSelectedCategoryId}
                onOpenManageCategories={() => setIsCategoryModalOpen(true)}
              />

              {/* Lançamentos List */}
              <TransactionList
                transactions={monthTransactions}
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                hideValues={userPrefs.hideValues}
                onAddTransaction={() => setIsTransactionModalOpen(true)}
                onDeleteTransaction={handleDeleteTransaction}
              />
            </div>
          )}

          {activeTab === 'extract' && (
            <div className="animate-fadeIn">
              <FullExtractView
                transactions={transactions}
                categories={categories}
                hideValues={userPrefs.hideValues}
                onUpdateTransactionCategory={handleUpdateTransactionCategory}
                onDeleteTransaction={handleDeleteTransaction}
                onAddTransaction={() => setIsTransactionModalOpen(true)}
              />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="animate-fadeIn">
              <ReportsView
                transactions={monthTransactions}
                categories={categories}
                hideValues={userPrefs.hideValues}
              />
            </div>
          )}

          {activeTab === 'openfinance' && (
            <div className="animate-fadeIn">
              <OpenFinanceView
                transactions={transactions}
                categories={categories}
                onAddOpenFinanceTransactions={handleAddBatchTransactions}
                hideValues={userPrefs.hideValues}
                onOpenCSVImporter={() => setIsCSVImporterOpen(true)}
              />
            </div>
          )}

          {activeTab === 'tips' && (
            <div className="animate-fadeIn">
              <HealthTipsView
                health={health}
                categories={categories}
                transactions={monthTransactions}
                userPrefs={userPrefs}
                onUpdateUserPrefs={handleUpdateUserPrefs}
                hideValues={userPrefs.hideValues}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-fadeIn">
              <SettingsView
                userPrefs={userPrefs}
                categories={categories}
                onUpdateUserPrefs={handleUpdateUserPrefs}
                onOpenManageCategories={() => setIsCategoryModalOpen(true)}
                onResetData={handleResetData}
              />
            </div>
          )}
        </main>

        {/* Footer Branding */}
        <footer className="mt-16 text-center text-xs text-gray-400 font-semibold py-4 flex items-center justify-center gap-1.5">
          <span>Gestão da Livinha</span>
          <span>•</span>
          <span className="text-brand flex items-center gap-1">
            Feito por Mozão <Heart size={12} className="fill-brand text-brand inline" />
          </span>
        </footer>

        {/* Modals */}
        <TransactionModal
          isOpen={isTransactionModalOpen}
          categories={categories}
          onClose={() => setIsTransactionModalOpen(false)}
          onSave={handleAddTransaction}
        />

        <CSVImporterModal
          isOpen={isCSVImporterOpen}
          categories={categories}
          onClose={() => setIsCSVImporterOpen(false)}
          onImportComplete={handleImportComplete}
        />

        <CategoryModal
          isOpen={isCategoryModalOpen}
          categories={categories}
          baseSalary={userPrefs.baseSalary || 1000}
          onClose={() => setIsCategoryModalOpen(false)}
          onSaveCategories={handleSaveCategories}
        />

        {/* Alerts Drawer Modal */}
        {showAlertsDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-gray-100 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={20} className="text-amber-500" />
                  <h3 className="text-base font-bold text-gray-900">Central de Avisos & Limites</h3>
                </div>
                <button
                  onClick={() => setShowAlertsDrawer(false)}
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              {categoriesWithAlerts.length === 0 ? (
                <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-700 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>Todos os nichos estão dentro do limite seguro (&lt; 80%)!</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-2">
                    Os seguintes nichos ultrapassaram 80% do limite configurado:
                  </p>
                  {categoriesWithAlerts.map((cat) => {
                    const spent = monthTransactions
                      .filter((t) => t.categoryId === cat.id && t.type === 'EXPENSE')
                      .reduce((sum, t) => sum + t.amount, 0);
                    const percentage = Math.round((spent / cat.monthlyLimit) * 100);

                    return (
                      <div
                        key={cat.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                          percentage >= 100
                            ? 'bg-red-50 border-red-200 text-red-700 font-bold'
                            : 'bg-amber-50 border-amber-200 text-amber-800 font-semibold'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span>
                          {percentage}% (R$ {spent.toFixed(2)} / R$ {cat.monthlyLimit.toFixed(2)})
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppSecurityLock>
  );
}
