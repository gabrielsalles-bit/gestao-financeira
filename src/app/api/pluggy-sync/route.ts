import { NextResponse } from 'next/server';

const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID || 'abeb29ea-eee5-4c7d-a3ab-57755abc231b';
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET || 'pojIO8tYboJ0uG4bjTYwIOLQIFn0t5ZOGyRm_usaPyk';
const PLUGGY_DEFAULT_ITEM_ID = process.env.PLUGGY_DEFAULT_ITEM_ID || '5c10a9c4-2b33-48a5-95da-bd7fc66acd4b';
const PLUGGY_BASE = 'https://api.pluggy.ai';


// Step 1: Get API Key from Pluggy (valid 2h)
async function getPluggyApiKey(): Promise<string> {
  const res = await fetch(`${PLUGGY_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pluggy auth failed: ${err}`);
  }
  const data = await res.json();
  return data.apiKey as string;
}

// Step 2: List all connected items for this user
async function getItems(apiKey: string): Promise<any[]> {
  const res = await fetch(`${PLUGGY_BASE}/items`, {
    headers: { 'X-API-KEY': apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// Step 3: Get accounts for an item
async function getAccounts(apiKey: string, itemId: string): Promise<any[]> {
  const res = await fetch(`${PLUGGY_BASE}/accounts?itemId=${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// Step 4: Get transactions for an account (last 90 days)
async function getTransactions(apiKey: string, accountId: string): Promise<any[]> {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().split('T')[0];
  const to = today.toISOString().split('T')[0];

  const res = await fetch(
    `${PLUGGY_BASE}/v2/transactions?accountId=${accountId}&from=${from}&to=${to}&pageSize=100`,
    { headers: { 'X-API-KEY': apiKey } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.results || [];
}

// Step 5: Create a connect token (for the Pluggy Connect Widget on the front-end)
async function createConnectToken(apiKey: string): Promise<string | null> {
  const res = await fetch(`${PLUGGY_BASE}/connect_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify({
      clientUserId: 'livinha-app-user-v1',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.accessToken || null;
}

// ─────────────────────────────────────────────────────────────
// GET  /api/pluggy-sync  → returns connectToken for the widget
// ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const apiKey = await getPluggyApiKey();
    const connectToken = await createConnectToken(apiKey);

    return NextResponse.json({
      success: true,
      connectToken,
      message: 'Token de conexão Pluggy gerado com sucesso.',
    });
  } catch (error: any) {
    console.error('[pluggy-sync GET]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/pluggy-sync  → fetches real transactions from all connected items
//   Body (optional): { itemId: string } to use a specific item directly
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const specificItemId: string | undefined = body?.itemId;

    const apiKey = await getPluggyApiKey();

    // If a specific item ID is provided, use it directly (no need to list items)
    let itemIds: string[] = [];

    if (specificItemId) {
      itemIds = [specificItemId];
    } else {
      const items = await getItems(apiKey);
      if (items.length === 0) {
        // Try the default item ID from env (the connected demo item)
        if (PLUGGY_DEFAULT_ITEM_ID) {
          itemIds = [PLUGGY_DEFAULT_ITEM_ID];
        } else {
          const connectToken = await createConnectToken(apiKey);
          return NextResponse.json({
            success: true,
            connected: false,
            connectToken,
            transactions: [],
            message: 'Nenhum banco conectado ainda. Use o widget para conectar o Nubank.',
          });
        }
      } else {
        itemIds = items.map((i: any) => i.id);
      }
    }


    // Gather all transactions from all items + all accounts
    const allTransactions: any[] = [];
    for (const itemId of itemIds) {
      const accounts = await getAccounts(apiKey, itemId);
      for (const account of accounts) {
        const txs = await getTransactions(apiKey, account.id);
        allTransactions.push(
          ...txs.map((t: any) => ({
            providerTransactionId: t.id,
            description: t.description || t.merchant?.name || 'Transação Nubank',
            amount: Math.abs(t.amount),
            type: t.type === 'DEBIT' ? 'EXPENSE' : t.type === 'CREDIT' ? 'INCOME' : 'EXPENSE',
            date: t.date?.split('T')[0] || new Date().toISOString().split('T')[0],
            accountName: account.name,
            itemId,
          }))
        );
      }
    }

    return NextResponse.json({
      success: true,
      connected: true,
      transactions: allTransactions,
      itemCount: itemIds.length,
      message: `${allTransactions.length} transações encontradas em ${itemIds.length} conta(s) conectada(s).`,
    });
  } catch (error: any) {
    console.error('[pluggy-sync POST]', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
