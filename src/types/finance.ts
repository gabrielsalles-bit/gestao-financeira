export type TransactionType = 'INCOME' | 'EXPENSE' | 'INVESTMENT';

export interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
  monthlyLimit: number;
  keywords?: string[];
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string; // ISO format YYYY-MM-DD
  createdAt: string;
}

export type HealthStatusLevel = 'EXCELLENT' | 'WARNING' | 'CRITICAL';

export interface FinancialHealth {
  status: HealthStatusLevel;
  percentageUsed: number;
  daysPassedRatio: number;
  burnRateMessage: string;
  tip: string;
}

export interface MonthlyBudgetSummary {
  monthName: string;
  year: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  monthlyBalance: number; // Income - Expense
  finalBalance: number; // MonthlyBalance - Investment
  totalLimit: number;
  availableBudget: number;
}

export interface UserPreferences {
  userName: string;
  baseSalary: number; // Salário base mensal configurável (ex: R$ 1000)
  hideValues: boolean;
  pinHash: string | null; // null = nenhum PIN configurado ainda (primeiro uso)
}
