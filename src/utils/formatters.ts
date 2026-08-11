import { Category, FinancialHealth, Transaction } from '@/types/finance';

/**
 * Formata um valor numérico para Real Brasileiro (R$)
 */
export function formatCurrency(value: number, hide = false): string {
  if (hide) return 'R$ ••••••';
  const val = isNaN(value) ? 0 : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

/**
 * Formata datas ISO (YYYY-MM-DD) para PT-BR (DD/MM/YY)
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '00/00/00';
  try {
    const [year, month, day] = dateString.split('-');
    if (!year || !month || !day) return dateString;
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year.slice(-2)}`;
  } catch {
    return dateString;
  }
}

/**
 * Retorna o nome do mês por extenso em Português
 */
export function getMonthName(monthIndex: number): string {
  const months = [
    'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
    'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
  ];
  return months[monthIndex] || 'MÊS ATUAL';
}

/**
 * Determina a cor semafórica baseada no percentual de limite gasta
 * Até 79%: Verde
 * De 80% a 99%: Amarelo
 * 100%+: Vermelho
 */
export function getSemaphoreColor(percentage: number) {
  if (percentage >= 100) {
    return {
      status: 'CRITICAL',
      colorText: 'text-traffic-red',
      colorBg: 'bg-traffic-redBg',
      colorBorder: 'border-traffic-red',
      colorBar: 'bg-traffic-red',
      label: 'Estourado',
    };
  }
  if (percentage >= 80) {
    return {
      status: 'WARNING',
      colorText: 'text-traffic-yellow',
      colorBg: 'bg-traffic-yellowBg',
      colorBorder: 'border-traffic-yellow',
      colorBar: 'bg-traffic-yellow',
      label: 'Atenção',
    };
  }
  return {
    status: 'EXCELLENT',
    colorText: 'text-traffic-green',
    colorBg: 'bg-traffic-greenBg',
    colorBorder: 'border-traffic-green',
    colorBar: 'bg-traffic-green',
    label: 'Tranquilo',
  };
}

/**
 * Calcula a Saúde Financeira Geral do Mês considerando gastos e ritmo diário
 */
export function calculateFinancialHealth(
  totalExpense: number,
  totalLimit: number,
  currentDate: Date = new Date()
): FinancialHealth {
  if (totalLimit <= 0) {
    return {
      status: 'EXCELLENT',
      percentageUsed: 0,
      daysPassedRatio: 0,
      burnRateMessage: 'Defina os limites dos seus nichos para acompanhar a saúde financeira.',
      tip: 'Configure seus envelopes de orçamento para começar!',
    };
  }

  const percentageUsed = Math.min(1000, (totalExpense / totalLimit) * 100);
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const currentDay = currentDate.getDate();
  const daysPassedRatio = (currentDay / daysInMonth) * 100;

  // Se excedeu 100%
  if (percentageUsed >= 100) {
    return {
      status: 'CRITICAL',
      percentageUsed,
      daysPassedRatio,
      burnRateMessage: `Orçamento mensal ultrapassado! (${percentageUsed.toFixed(0)}% do limite)`,
      tip: 'Cuidado! Tente segurar os gastos não essenciais até o próximo mês.',
    };
  }

  // Se gastou mais de 80%
  if (percentageUsed >= 80) {
    return {
      status: 'WARNING',
      percentageUsed,
      daysPassedRatio,
      burnRateMessage: `Você já consumiu ${percentageUsed.toFixed(0)}% do orçamento total!`,
      tip: 'Seus nichos estão perto do limite. Fique atenta às despesas diárias.',
    };
  }

  // Ritmo de consumo acelerado (ex: gastou 60% em apenas 30% do mês)
  if (percentageUsed > daysPassedRatio + 20) {
    return {
      status: 'WARNING',
      percentageUsed,
      daysPassedRatio,
      burnRateMessage: `Atenção ao ritmo: gastou ${percentageUsed.toFixed(0)}% em ${currentDay} dias!`,
      tip: 'Neste ritmo, você pode estourar o limite antes do fim do mês.',
    };
  }

  return {
    status: 'EXCELLENT',
    percentageUsed,
    daysPassedRatio,
    burnRateMessage: `Ritmo saudável: ${percentageUsed.toFixed(0)}% usado até o dia ${currentDay}.`,
    tip: 'Ótima gestão financeira! Você está dentro da margem segura.',
  };
}
