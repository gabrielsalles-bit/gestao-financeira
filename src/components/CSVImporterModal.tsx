'use client';

import React, { useState } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, AlertCircle, Edit3, ChevronDown, Smartphone, Info } from 'lucide-react';
import { Category, Transaction } from '@/types/finance';
import { ParsedRow, parseCSVFile, parseXLSXFile, mapRowsToParsedTransactions, markPossibleDuplicates } from '@/utils/csvXlsxParser';

interface CSVImporterModalProps {
  isOpen: boolean;
  categories: Category[];
  existingTransactions: Transaction[];
  onClose: () => void;
  onImportComplete: (importedTransactions: Omit<Transaction, 'id' | 'createdAt'>[]) => void;
}

export const CSVImporterModal: React.FC<CSVImporterModalProps> = ({
  isOpen,
  categories,
  existingTransactions,
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

  const processFile = async (file: File) => {
    setGlobalError(null);
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      const { headers, rows: rawRows } = isExcel ? await parseXLSXFile(file) : await parseCSVFile(file);
      const parsed = mapRowsToParsedTransactions(rawRows, headers, categories);
      const withDuplicates = markPossibleDuplicates(parsed, existingTransactions);

      if (withDuplicates.length === 0) {
        setGlobalError('Nenhuma transação válida encontrada. Verifique se o arquivo é um extrato exportado (CSV ou Excel).');
        setIsProcessing(false);
        return;
      }

      setRows(withDuplicates);
      setStep('preview');
    } catch {
      setGlobalError('Erro ao ler o arquivo. Confira se é um .csv ou .xlsx válido e tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  };

  const handleUpdateRow = (idx: number, field: keyof ParsedRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const validRows = rows.filter((r) => !r.hasError && r.amount > 0);
  const errorRows = rows.filter((r) => r.hasError);
  const duplicateCount = validRows.filter((r) => r.possibleDuplicate).length;

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
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-brand flex items-center justify-center">
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Importar Planilha de Extrato</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">CSV ou Excel — classificação automática por nicho, revisão antes de confirmar</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 sm:p-6 space-y-4">
          {step === 'upload' && (
            <>
              <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Smartphone size={14} className="text-brand" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand">Como exportar do Nubank (ou outro banco)</span>
                </div>
                <ol className="text-[11px] text-gray-700 space-y-1 list-decimal pl-4">
                  <li>Abra o app do seu banco no celular</li>
                  <li>Acesse o extrato e escolha "Exportar" em CSV ou Excel</li>
                  <li>Envie o arquivo para o computador (e-mail ou Drive)</li>
                  <li>Arraste ou selecione o arquivo abaixo</li>
                </ol>
              </div>

              {globalError && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {globalError}
                </div>
              )}

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer relative ${dragging ? 'border-brand bg-purple-50' : 'border-purple-200 hover:border-brand bg-purple-50/40 hover:bg-purple-50'}`}
              >
                <input type="file" accept=".csv,.txt,.xlsx,.xls" onChange={handleFileInput} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-semibold text-brand">Lendo arquivo...</p>
                  </div>
                ) : (
                  <>
                    <FileText size={36} className="mx-auto text-brand mb-2" />
                    <p className="text-xs font-bold text-gray-800">Clique ou arraste o arquivo aqui</p>
                    <p className="text-[10px] text-gray-500 mt-1">Extrato em .csv ou .xlsx</p>
                  </>
                )}
              </div>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-xs font-bold text-gray-900">
                    {validRows.length} transações lidas de <span className="text-brand">{fileName}</span>
                  </span>
                </div>
                <button onClick={() => { setStep('upload'); setRows([]); setFileName(''); }} className="text-[11px] text-gray-400 hover:text-gray-700 underline">
                  Trocar arquivo
                </button>
              </div>

              {errorRows.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  <Info size={14} />
                  {errorRows.length} linha(s) com dados incompletos foram ignoradas automaticamente.
                </div>
              )}

              {duplicateCount > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-center gap-2">
                  <AlertCircle size={14} />
                  {duplicateCount} linha(s) parecem já estar lançadas (mesma data, valor e descrição). Revise antes de confirmar.
                </div>
              )}

              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_80px_1fr_40px] gap-0 bg-gray-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <span>Descrição</span>
                  <span>Valor</span>
                  <span>Nicho</span>
                  <span></span>
                </div>
                <div className="divide-y divide-gray-50 max-h-60 overflow-y-auto">
                  {rows.filter((r) => !r.hasError).map((row, idx) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-[1fr_80px_1fr_40px] gap-1 items-center px-3 py-2 hover:bg-gray-50 transition-colors ${row.possibleDuplicate ? 'bg-amber-50/60' : ''}`}
                    >
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => handleUpdateRow(rows.indexOf(row), 'description', e.target.value)}
                          className="text-[11px] font-semibold text-gray-900 bg-transparent border-0 outline-none w-full truncate focus:ring-1 focus:ring-brand rounded px-1"
                        />
                        {row.possibleDuplicate && <span className="text-[9px] font-bold text-amber-700 px-1">Possível duplicata</span>}
                      </div>
                      <span className={`text-[11px] font-bold ${row.type === 'INCOME' ? 'text-emerald-600' : 'text-gray-800'}`}>
                        {row.type === 'INCOME' ? '+' : '−'} R${row.amount.toFixed(2)}
                      </span>
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
                      <button onClick={() => handleRemoveRow(rows.indexOf(row))} className="text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100 text-[11px] text-blue-700">
                <Edit3 size={12} className="shrink-0" />
                <span>Nada é lançado até você confirmar — edite ou remova qualquer linha antes de importar.</span>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="py-8 text-center">
              <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-900">Importação concluída!</p>
              <p className="text-xs text-gray-500 mt-1">{validRows.length} transações adicionadas com sucesso.</p>
            </div>
          )}
        </div>

        {step === 'preview' && validRows.length > 0 && (
          <div className="p-5 sm:p-6 border-t border-gray-100 shrink-0">
            <button onClick={handleConfirm} className="w-full bg-brand hover:bg-brand-dark text-white py-3 rounded-2xl text-xs font-bold shadow-md transition-all">
              Confirmar Importação de {validRows.length} Transações
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
