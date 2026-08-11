-- SCRIPT SQL DE MIGRAÇÃO SUPABASE — v2 (app 100% manual, sem Open Finance)
-- Execute no SQL Editor do seu projeto Supabase (https://app.supabase.com).
-- Este script APAGA as tabelas antigas (schema v1 nunca funcionou de verdade:
-- a coluna user_id era UUID ligada a auth.users, mas o app nunca autenticava
-- via Supabase Auth, então todo insert falhava silenciosamente).
-- Não há login real neste app — o controle de acesso é o PIN dentro do app.

drop table if exists public.transactions;
drop table if exists public.categories;
drop table if exists public.user_preferences;

-- 1. Categorias / Nichos
create table public.categories (
    id text primary key,
    name text not null,
    icon text default 'Tag',
    color text,
    monthly_limit numeric(10,2) not null default 50.00,
    keywords text[] default '{}',
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 2. Lançamentos / Transações
create table public.transactions (
    id text primary key,
    description text not null,
    amount numeric(10,2) not null,
    type text check (type in ('INCOME', 'EXPENSE', 'INVESTMENT')) not null,
    category_id text references public.categories(id) on delete set null,
    date date not null,
    created_at timestamptz not null default timezone('utc'::text, now())
);

-- 3. Preferências (linha única — app de uso pessoal, sem múltiplos usuários)
create table public.user_preferences (
    id text primary key default 'default',
    user_name text default 'Livinha',
    base_salary numeric(10,2) default 1000.00,
    hide_values boolean default false,
    pin_hash text,
    updated_at timestamptz not null default timezone('utc'::text, now())
);

-- RLS habilitado, mas com política permissiva — leia com atenção antes de
-- assumir que isso protege alguma coisa:
--
-- (a) A "chave anônima" (NEXT_PUBLIC_SUPABASE_ANON_KEY) NÃO é secreta. O
--     Next.js embute variáveis NEXT_PUBLIC_* no bundle JavaScript enviado ao
--     navegador — qualquer pessoa que abra o site publicado e olhe o código-
--     fonte ou as requisições de rede consegue ler essa chave.
-- (b) Com a policy abaixo ("using (true) with check (true)"), quem tiver
--     essa chave tem acesso total de leitura/escrita/exclusão a todo o banco
--     via API REST do Supabase — direto, sem passar pelo app.
-- (c) O PIN em AppSecurityLock.tsx é só uma trava de interface (esconde a
--     tela até digitar o PIN) — ele NÃO bloqueia chamadas diretas à API do
--     Supabase. Ou seja, hoje, quem descobre a URL publicada e lê o bundle
--     tem acesso irrestrito ao banco, PIN ou não.
-- (d) Isso é uma decisão consciente, não um erro: este é um app pessoal, de
--     uso privado a dois, sem dado além de finanças pessoais, sem divulgação
--     pública da URL e sem listagem/indexação em lugar nenhum — o "segredo"
--     de fato é a própria URL não ser conhecida por ninguém além do casal.
-- (e) Se a URL deste app deixar de ser só dos dois (compartilhar com mais
--     gente, divulgar em algum lugar, etc.), a camada de proteção real a
--     adicionar é fora do banco: por exemplo, senha de acesso ao deployment
--     na Vercel (Vercel Deployment Protection) — o PIN dentro do app não
--     substitui isso.
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.user_preferences enable row level security;

create policy "acesso completo categorias" on public.categories
    for all using (true) with check (true);

create policy "acesso completo transacoes" on public.transactions
    for all using (true) with check (true);

create policy "acesso completo preferencias" on public.user_preferences
    for all using (true) with check (true);
