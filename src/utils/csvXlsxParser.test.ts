import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectStatementFormat,
  parseStatementDate,
  parseStatementAmount,
  mapRowsToParsedTransactions,
  markPossibleDuplicates,
} from './csvXlsxParser.ts';
import type { Category, Transaction } from '../types/finance.ts';

const categories: Category[] = [
  { id: 'cat-uber', name: 'Uber', icon: 'Car', monthlyLimit: 200, keywords: ['uber', '99'] },
  { id: 'cat-outros', name: 'Outros', icon: 'HelpCircle', monthlyLimit: 250, keywords: ['outros'] },
];

test('detectStatementFormat recognizes the Nubank PT-BR export', () => {
  assert.equal(detectStatementFormat(['Data', 'Valor', 'Identificador', 'Descrição']), 'nubank_ptbr');
});

test('detectStatementFormat recognizes the Nubank EN export', () => {
  assert.equal(detectStatementFormat(['date', 'title', 'amount']), 'nubank_en');
});

test('detectStatementFormat falls back to generic for anything else', () => {
  assert.equal(detectStatementFormat(['Date', 'Description', 'Amount', 'Type']), 'generic');
});

test('parseStatementDate handles ISO and DD/MM/YYYY', () => {
  assert.equal(parseStatementDate('2026-03-05'), '2026-03-05');
  assert.equal(parseStatementDate('05/03/2026'), '2026-03-05');
});

test('parseStatementAmount handles Brazilian thousand/decimal separators and negatives', () => {
  assert.deepEqual(parseStatementAmount('R$ 1.234,56'), { value: 1234.56, isNegative: false });
  assert.deepEqual(parseStatementAmount('-89,90'), { value: 89.9, isNegative: true });
});

test('mapRowsToParsedTransactions maps a Nubank PT-BR row and auto-matches the category by keyword', () => {
  const rows = [{ Data: '10/03/2026', Descrição: 'Uber Viagem', Valor: '-45,00' }];
  const parsed = mapRowsToParsedTransactions(rows, ['Data', 'Descrição', 'Valor'], categories);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].date, '2026-03-10');
  assert.equal(parsed[0].amount, 45);
  assert.equal(parsed[0].type, 'EXPENSE');
  assert.equal(parsed[0].categoryId, 'cat-uber');
});

test('mapRowsToParsedTransactions skips zero-value rows', () => {
  const rows = [{ Data: '10/03/2026', Descrição: 'Estorno', Valor: '0' }];
  const parsed = mapRowsToParsedTransactions(rows, ['Data', 'Descrição', 'Valor'], categories);
  assert.equal(parsed.length, 0);
});

test('markPossibleDuplicates flags rows matching an existing transaction by date+amount+description', () => {
  const existing: Transaction[] = [
    { id: 'tx-1', description: 'Uber Viagem', amount: 45, type: 'EXPENSE', categoryId: 'cat-uber', date: '2026-03-10', createdAt: '2026-03-10' },
  ];
  const rows = mapRowsToParsedTransactions(
    [{ Data: '10/03/2026', Descrição: 'Uber Viagem', Valor: '-45,00' }],
    ['Data', 'Descrição', 'Valor'],
    categories
  );
  const marked = markPossibleDuplicates(rows, existing);
  assert.equal(marked[0].possibleDuplicate, true);
});
