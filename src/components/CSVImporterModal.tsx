'use client';

import React, { useState, useCallback } from 'react';
import {
  X, UploadCloud, FileText, CheckCircle2, AlertCircle,
  Edit3, ChevronDown, Smartphone, TableProperties, Info,
} from 'lucide-react';
import Papa from 'papaparse';
import { Category, Transaction, TransactionType } from '@/types/finance';

interface CSVImporterModalProps {
  isOpen: boolean;
  categories: Category[];
  onClose: () => void;
  onImportComplete: (importedTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

interface ParsedRow {
  description: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  rawDate: string;
  hasError: boolean;
  errorMsg?: string;
}

// ── Nubank CSV real format detector ──────────────────────────────
// Nubank exports: "Data","Valor","Identificador","Descrição"
// OR:             "date","title","amount"  (new format)
// OR:             "Date","Description","Amount","Type"  (English)
function detectNubankFormat(headers: string[]): 'nubank_ptbr' | 'nubank_en' | 'generic' {
  const h = headers.map((s) => s.toLowerCase().trim().replace(/"/g, ''));
  if (h.includes('descrição') || h.includes('descricao')) return 'nubank_ptbr';
  if (h.includes('title') && h.includes('amount')) return 'nubank_en';
  return 'generic';
}

// ── Parse date flexibly (DD/MM/YYYY, YYYY-MM-DD, MM/DD/YYYY) ────
function parseDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const s = String(raw).trim();

  // Already ISO: 2026-08-01
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // DD/MM/YYYY
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, '0')}-${dmY[1].padStart(2, '0')}`;

  // MM/DD/YYYY
  const mdY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdY) return `${mdY[3]}-${mdY[1].padStart(2, '0')}-${mdY[2].padStart(2, '0')}`;

  return new Date().toISOString().split('T')[0];
}

// ── Parse amount flexibly ────────────────────────────────────────
function parseAmount(raw: string | number): { value: number; isNegative: boolean } {
  let s = String(raw).trim().replace(/R\$\s?/g, '').replace(/\s/g, '');
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return { value: Math.abs(isNaN(num) ? 0 : num), isNegative: num < 0 };
}

export const CSVImporterModal: React.FC<CSVImporterModalProps> = ({
  isOpen,
  categories,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);

  if (!isOpen) return null;

  // Match description against each category's keyword list
  const smartMapCategory = (desc: string): string => {
    const lower = desc.toLowerCase();
    for (const cat of categories) {
      if (cat.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) return cat.id;
    }
    return categories[0]?.id || '';
  };

  const processCSV = (file: File) => {
    setGlobalError(null);
    setIsProcessing(true);
    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        setIsProcessing(false);
        const headers = results.meta.fields || [];
        const format = detectNubankFormat(headers);
        const parsed: ParsedRow[] = [];

        results.data.forEach((row: any, idx: number) => {
          try {
            let rawDate = '';
            let desc = '';
            let rawAmount: string | number = 0;
            let forceType: TransactionType | null = null;

            if (format === 'nubank_ptbr') {
              // Nubank PT-BR: Data, Valor, Identificador, Descrição
              rawDate = row['Data'] || row['data'] || '';
              desc = row['Descrição'] || row['Descricao'] || row['descrição'] || row['descricao'] || '';
              rawAmount = row['Valor'] || row['valor'] || '0';
            } else if (format === 'nubank_en') {
              // Nubank EN: date, title, amount
              rawDate = row['date'] || row['Date'] || '';
              desc = row['title'] || row['Title'] || row['description'] || row['Description'] || '';
              rawAmount = row['amount'] || row['Amount'] || '0';
            } else {
              // Generic: try multiple column names
              rawDate = row['Data'] || row['Date'] || row['data'] || row['date'] || row['DATA'] || '';
              desc = row['Descrição'] || row['Description'] || row['descricao'] || row['title'] ||
                     row['DESCRIÇÃO'] || row['memo'] || row['Memo'] || 'Lançamento';
              rawAmount = row['Valor'] || row['Amount'] || row['valor'] || row['amount'] ||
                          row['VALOR'] || row['Debit'] || row['Credit'] || '0';
              const tipoRaw = (row['Tipo'] || row['Type'] || row['tipo'] || '').toLowerCase();
              if (tipoRaw.includes('crédit') || tipoRaw.includes('credit') || tipoRaw.includes('receita') || tipoRaw.includes('entrada')) {
                forceType = 'INCOME';
              } else if (tipoRaw.includes('débit') || tipoRaw.includes('debit') || tipoRaw.includes('saida') || tipoRaw.includes('despesa')) {
                forceType = 'EXPENSE';
              }
            }

            const { value, isNegative } = parseAmount(rawAmount);

            if (value === 0) return; // skip zero-value rows

            const type: TransactionType = forceType
              ? forceType
              : isNegative
              ? 'EXPENSE'
              : 'INCOME';

            const date = parseDate(rawDate);
            const descStr = String(desc).trim() || `Lançamento ${idx + 1}`;
            const hasError = !rawDate || value === 0;

            parsed.push({
              description: descStr,
              amount: value,
              type,
              categoryId: type === 'EXPENSE' ? smartMapCategory(descStr) : '',
              date,
              rawDate,
              hasError,
              errorMsg: !rawDate ? 'Data não encontrada' : undefined,
            });
          } catch {
            // skip unparseable rows silently
          }
        });

        if (parsed.length === 0) {
          setGlobalError(
            'Nenhuma transação válida encontrada. Verifique se o arquivo é o extrato CSV exportado do Nubank.'
          );
          return;
        }

        setRows(parsed);
        setStep('preview');
      },
      error: () => {
        setIsProcessing(false);
        setGlobalError('Erro ao ler o arquivo. Tente exportar o CSV novamente pelo app do Nubank.');
      },
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processCSV(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processCSV(f);
  };

  const handleUpdateRow = (idx: number, field: keyof ParsedRow, value: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const validRows = rows.filter((r) => !r.hasError && r.amount > 0);
  const errorRows = rows.filter((r) => r.hasError);

  const handleConfirm = () => {
    onImportComplete(
      validRows.map((r) => ({
        description: r.description,
        amount: r.amount,
        type: r.type,
        categoryId: r.categoryId,
        date: r.date,
      }))
    );
    setStep('done');
    setTimeout(() => {
      setStep('upload');
      setRows([]);
      setFileName('');
      setGlobalError(null);
      onClose();
    }, 2000);
  };

  const handleClose = () => {
    setStep('upload');
    setRows([]);
    setFileName('');
    setGlobalError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-brand flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Importar Extrato CSV — Nubank</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Classificação automática por nicho</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">

          {/* ── STEP: UPLOAD ── */}
          {step === 'upload' && (
            <>
              {/* How to export from Nubank */}
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone size={14} className="text-brand" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand">Como exportar do Nubank</span>
                </div>
                <ol className="text-[11px] text-gray-700 space-y-1 list-decimal pl-4">
                  <li>Abra o app <strong>Nubank</strong> no celular</li>
                  <li>Toque em <strong>"Minha Conta"</strong> → <strong>"Extrato"</strong></li>
                  <li>Toque nos <strong>3 pontos (⋮)</strong> no canto superior direito</li>
                  <li>Escolha <strong>"Exportar extrato"</strong> → <strong>CSV</strong></li>
                  <li>Envie o arquivo para o computador (e-mail ou Drive)</li>
                  <li>Arraste ou selecione o arquivo <strong>.csv</strong> abaixo</li>
                </ol>
              </div>

              {globalError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {globalError}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${dragging ? 'border-brand bg-purple-50' : 'border-purple-200 hover:border-brand bg-purple-50/40 hover:bg-purple-50'}`}
              >
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileInput}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-brand">Lendo arquivo...</p>
                  </div>
                ) : (
                  <>
                    <FileText size={36} className="mx-auto text-brand mb-2" />
                    <p className="text-xs font-bold text-gray-800">Clique ou arraste o arquivo CSV aqui</p>
                    <p className="text-[10px] text-gray-500 mt-1">Extrato exportado do app Nubank (.csv)</p>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-900">
                    {validRows.length} transações lidas de <span className="text-brand">{fileName}</span>
                  </span>
                </div>
                <button
                  onClick={() => { setStep('upload'); setRows([]); setFileName(''); }}
                  className="text-[11px] text-gray-400 hover:text-gray-700 underline"
                >
                  Trocar arquivo
                </button>
              </div>

              {errorRows.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  <Info size={14} />
                  {errorRows.length} linha(s) com dados incompletos foram ignoradas automaticamente.
                </div>
              )}

              {/* Editable preview table */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_1fr_40px] gap-0 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <span>Descrição</span>
                  <span>Valor</span>
                  <span>Nicho</span>
                  <span></span>
                </div>
                <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                  {rows.filter((r) => !r.hasError).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_80px_1fr_40px] gap-1 items-center px-3 py-2 hover:bg-gray-50 transition-colors">
                      {/* Description */}
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleUpdateRow(rows.indexOf(row), 'description', e.target.value)}
                        className="text-[11px] font-semibold text-gray-900 bg-transparent border-0 outline-none w-full truncate focus:ring-1 focus:ring-brand rounded px-1"
                      />
                      {/* Amount */}
                      <span className={`text-[11px] font-bold ${row.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-800'}`}>
                        {row.type === 'INCOME' ? '+' : '−'} R${row.amount.toFixed(2)}
                      </span>
                      {/* Category selector */}
                      {row.type === 'EXPENSE' ? (
                        <div className="relative">
                          <select
                            value={row.categoryId}
                            onChange={(e) => handleUpdateRow(rows.indexOf(row), 'categoryId', e.target.value)}
                            className="w-full text-[10px] font-semibold bg-gray-100 rounded-lg px-2 py-1 border-0 outline-none appearance-none cursor-pointer pr-5 text-gray-700"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-emerald-600 font-semibold px-2 py-1 bg-emerald-50 rounded-lg">Receita</span>
                      )}
                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveRow(rows.indexOf(row))}
                        className="text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700">
                <Edit3 size={12} className="shrink-0" />
                <span>Você pode editar a descrição ou trocar o nicho antes de confirmar.</span>
              </div>
            </>
          )}

          {/* ── STEP: DONE ── */}
          {step === 'done' && (
            <div className="py-8 text-center">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-900">Importação concluída!</p>
              <p className="text-xs text-gray-500 mt-1">{validRows.length} transações adicionadas com sucesso.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && validRows.length > 0 && (
          <div className="p-5 sm:p-6 border-t border-gray-100 shrink-0">
            <button
              onClick={handleConfirm}
              className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-2xl text-xs font-bold shadow-md transition-all"
            >
              Confirmar Importação de {validRows.length} Transações
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
