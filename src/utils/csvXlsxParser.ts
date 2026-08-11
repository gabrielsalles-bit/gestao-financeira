// Relative import (not the @/ alias) so this file resolves identically under
// Next.js and under `node --import tsx --test` when csvXlsxParser.test.ts loads it.
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Category, Transaction, TransactionType } from '../types/finance';

export type StatementFormat = 'nubank_ptbr' | 'nubank_en' | 'generic';

export interface ParsedRow {
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  rawDate: string;
  hasError: boolean;
  errorMsg?: string;
  possibleDuplicate?: boolean;
}

export function detectStatementFormat(headers: string[]): StatementFormat {
  const h = headers.map((s) => s.toLowerCase().trim().replace(/"/g, ''));
  if (h.includes('descrição') || h.includes('descricao')) return 'nubank_ptbr';
  if (h.includes('title') && h.includes('amount')) return 'nubank_en';
  return 'generic';
}

export function parseStatementDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;
  return new Date().toISOString().split('T')[0];
}

export function parseStatementAmount(raw: string | number): { value: number; isNegative: boolean } {
  let s = String(raw).trim().replace(/R\$\s?/g, '').replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return { value: Math.abs(isNaN(num) ? 0 : num), isNegative: num < 0 };
}

function smartMapCategory(desc: string, categories: Category[]): string {
  const lower = desc.toLowerCase();
  for (const cat of categories) {
    if (cat.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) return cat.id;
  }
  return categories[0]?.id || '';
}

export function mapRowsToParsedTransactions(
  rawRows: Record<string, any>[],
  headers: string[],
  categories: Category[]
): ParsedRow[] {
  const format = detectStatementFormat(headers);
  const parsed: ParsedRow[] = [];

  rawRows.forEach((row, idx) => {
    try {
      let rawDate = '';
      let desc = '';
      let rawAmount: string | number = 0;
      let forceType: TransactionType | null = null;

      if (format === 'nubank_ptbr') {
        rawDate = row['Data'] || row['data'] || '';
        desc = row['Descrição'] || row['Descricao'] || row['descrição'] || row['descricao'] || '';
        rawAmount = row['Valor'] || row['valor'] || '0';
      } else if (format === 'nubank_en') {
        rawDate = row['date'] || row['Date'] || '';
        desc = row['title'] || row['Title'] || row['description'] || row['Description'] || '';
        rawAmount = row['amount'] || row['Amount'] || '0';
      } else {
        rawDate = row['Data'] || row['Date'] || row['data'] || row['date'] || row['DATA'] || '';
        desc = row['Descrição'] || row['Description'] || row['descricao'] || row['title'] ||
               row['DESCRIÇÃO'] || row['memo'] || row['Memo'] || 'Lançamento';
        rawAmount = row['Valor'] || row['Amount'] || row['valor'] || row['amount'] ||
                    row['VALOR'] || row['Debit'] || row['Credit'] || '0';
        const tipoRaw = String(row['Tipo'] || row['Type'] || row['tipo'] || '').toLowerCase();
        if (tipoRaw.includes('crédit') || tipoRaw.includes('credit') || tipoRaw.includes('receita') || tipoRaw.includes('entrada')) {
          forceType = 'INCOME';
        } else if (tipoRaw.includes('débit') || tipoRaw.includes('debit') || tipoRaw.includes('saida') || tipoRaw.includes('despesa')) {
          forceType = 'EXPENSE';
        }
      }

      const { value, isNegative } = parseStatementAmount(rawAmount);
      if (value === 0) return;

      const type: TransactionType = forceType ? forceType : isNegative ? 'EXPENSE' : 'INCOME';
      const date = parseStatementDate(rawDate);
      const descStr = String(desc).trim() || `Lançamento ${idx + 1}`;
      const hasError = !rawDate || value === 0;

      parsed.push({
        description: descStr,
        amount: value,
        type,
        categoryId: type === 'EXPENSE' ? smartMapCategory(descStr, categories) : '',
        date,
        rawDate: String(rawDate),
        hasError,
        errorMsg: !rawDate ? 'Data não encontrada' : undefined,
      });
    } catch {
      // linha não interpretável — ignorada silenciosamente, como já era o comportamento anterior
    }
  });

  return parsed;
}

export function markPossibleDuplicates(rows: ParsedRow[], existing: Transaction[]): ParsedRow[] {
  const existingKeys = new Set(
    existing.map((t) => `${t.date}|${t.amount.toFixed(2)}|${t.description.trim().toLowerCase()}`)
  );
  return rows.map((row) => ({
    ...row,
    possibleDuplicate: existingKeys.has(`${row.date}|${row.amount.toFixed(2)}|${row.description.trim().toLowerCase()}`),
  }));
}

export function parseCSVFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => resolve({ headers: results.meta.fields || [], rows: results.data as Record<string, any>[] }),
      error: (err) => reject(err),
    });
  });
}

export async function parseXLSXFile(file: File): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { headers, rows };
}
