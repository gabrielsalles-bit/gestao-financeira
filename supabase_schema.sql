-- SCRIPT SQL DE MIGRAÇÃO SUPABASE PARA O PROJETO GESTÃO DA LIVINHA
-- Execute este script no SQL Editor do seu projeto Supabase (https://app.supabase.com)

-- 1. Tabela de Categorias / Nichos
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT 'Tag',
    color TEXT,
    monthly_limit NUMERIC(10,2) NOT NULL DEFAULT 50.00,
    keywords TEXT[] DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Lançamentos / Transações
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT CHECK (type IN ('INCOME', 'EXPENSE', 'INVESTMENT')) NOT NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Preferências da Usuária
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT DEFAULT 'Livinha',
    base_salary NUMERIC(10,2) DEFAULT 1000.00,
    hide_values BOOLEAN DEFAULT false,
    alert_email TEXT DEFAULT 'livinha@exemplo.com',
    enable_email_alerts BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS) para Segurança
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso RLS (Leitura e Escrita do usuário logado)
CREATE POLICY "Usuário acessa suas próprias categorias" ON public.categories
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Usuário acessa suas próprias transações" ON public.transactions
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Usuário acessa suas próprias preferências" ON public.user_preferences
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);
