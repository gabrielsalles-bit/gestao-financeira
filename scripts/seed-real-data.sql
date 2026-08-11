-- Carga de dados reais (Jan-Ago/2026) — equivalente SQL de scripts/seed-real-data.mjs
-- Rode isso no SQL Editor do Supabase DEPOIS de já ter rodado supabase_schema.sql.

insert into public.categories (id, name, icon, color, monthly_limit, keywords) values
  ('cat-alimentacao', 'Alimentação', 'Utensils', '#10B981', 150, ARRAY['mercado', 'alimentacao', 'restaurante', 'ifood', 'padaria', 'carrefour']::text[]),
  ('cat-uber', 'Uber', 'Car', '#8257E5', 200, ARRAY['uber', '99', 'corrida']::text[]),
  ('cat-gasolina', 'Gasolina', 'Fuel', '#F59E0B', 100, ARRAY['posto', 'gasolina', 'shell', 'ipiranga', 'combustivel']::text[]),
  ('cat-lavagem', 'Lavagem de Carro', 'Sparkles', '#06B6D4', 50, ARRAY['lavagem', 'lava rapido', 'car wash', 'estetica automotiva']::text[]),
  ('cat-faculdade', 'Faculdade', 'GraduationCap', '#3B82F6', 200, ARRAY['faculdade', 'mensalidade', 'universidade', 'curso']::text[]),
  ('cat-vestimenta', 'Vestimenta', 'Shirt', '#EC4899', 200, ARRAY['vestuario', 'roupa', 'zara', 'renner', 'riachuelo', 'shein', 'loja']::text[]),
  ('cat-lazer', 'Lazer', 'Gift', '#6366F1', 100, ARRAY['cinema', 'bar', 'lazer', 'show', 'ingresso']::text[]),
  ('cat-viagens', 'Viagens', 'Plane', '#EF4444', 100, ARRAY['viagem', 'hotel', 'passagem', 'latam', 'gol', 'booking', 'airbnb']::text[]),
  ('cat-compras', 'Compras', 'ShoppingBag', '#A855F7', 200, ARRAY['compras', 'loja', 'shopping', 'amazon', 'mercado livre']::text[]),
  ('cat-outros', 'Outros', 'HelpCircle', '#94A3B8', 250, ARRAY['outros', 'diversos']::text[])
on conflict (id) do update set name = excluded.name, icon = excluded.icon, color = excluded.color, monthly_limit = excluded.monthly_limit, keywords = excluded.keywords;

insert into public.user_preferences (id, user_name, base_salary, hide_values) values
  ('default', 'Livinha', 1000, false)
on conflict (id) do update set user_name = excluded.user_name, base_salary = excluded.base_salary;

insert into public.transactions (id, description, amount, type, category_id, date) values
  ('tx-seed-2026-01-cat-alimentacao', 'Janeiro (importado da planilha)', 3.5, 'EXPENSE', 'cat-alimentacao', '2026-01-31'),
  ('tx-seed-2026-01-cat-uber', 'Janeiro (importado da planilha)', 67.5, 'EXPENSE', 'cat-uber', '2026-01-31'),
  ('tx-seed-2026-01-cat-compras', 'Janeiro (importado da planilha)', 58.61, 'EXPENSE', 'cat-compras', '2026-01-31'),
  ('tx-seed-2026-01-cat-outros', 'Janeiro (importado da planilha)', 630, 'EXPENSE', 'cat-outros', '2026-01-31'),
  ('tx-seed-2026-02-cat-alimentacao', 'Fevereiro (importado da planilha)', 303.52, 'EXPENSE', 'cat-alimentacao', '2026-02-28'),
  ('tx-seed-2026-02-cat-uber', 'Fevereiro (importado da planilha)', 269, 'EXPENSE', 'cat-uber', '2026-02-28'),
  ('tx-seed-2026-02-cat-vestimenta', 'Fevereiro (importado da planilha)', 69.9, 'EXPENSE', 'cat-vestimenta', '2026-02-28'),
  ('tx-seed-2026-02-cat-compras', 'Fevereiro (importado da planilha)', 348.63, 'EXPENSE', 'cat-compras', '2026-02-28'),
  ('tx-seed-2026-02-cat-outros', 'Fevereiro (importado da planilha)', 105, 'EXPENSE', 'cat-outros', '2026-02-28'),
  ('tx-seed-2026-03-cat-alimentacao', 'Março (importado da planilha)', 42, 'EXPENSE', 'cat-alimentacao', '2026-03-31'),
  ('tx-seed-2026-03-cat-uber', 'Março (importado da planilha)', 223.66, 'EXPENSE', 'cat-uber', '2026-03-31'),
  ('tx-seed-2026-03-cat-compras', 'Março (importado da planilha)', 51.65, 'EXPENSE', 'cat-compras', '2026-03-31'),
  ('tx-seed-2026-03-cat-outros', 'Março (importado da planilha)', 53.4, 'EXPENSE', 'cat-outros', '2026-03-31'),
  ('tx-seed-2026-04-cat-alimentacao', 'Abril (importado da planilha)', 89, 'EXPENSE', 'cat-alimentacao', '2026-04-30'),
  ('tx-seed-2026-04-cat-uber', 'Abril (importado da planilha)', 173.67, 'EXPENSE', 'cat-uber', '2026-04-30'),
  ('tx-seed-2026-04-cat-compras', 'Abril (importado da planilha)', 153.55, 'EXPENSE', 'cat-compras', '2026-04-30'),
  ('tx-seed-2026-04-cat-outros', 'Abril (importado da planilha)', 35.4, 'EXPENSE', 'cat-outros', '2026-04-30'),
  ('tx-seed-2026-05-cat-alimentacao', 'Maio (importado da planilha)', 85.55, 'EXPENSE', 'cat-alimentacao', '2026-05-31'),
  ('tx-seed-2026-05-cat-uber', 'Maio (importado da planilha)', 96.83, 'EXPENSE', 'cat-uber', '2026-05-31'),
  ('tx-seed-2026-05-cat-vestimenta', 'Maio (importado da planilha)', 179.8, 'EXPENSE', 'cat-vestimenta', '2026-05-31'),
  ('tx-seed-2026-05-cat-lazer', 'Maio (importado da planilha)', 60, 'EXPENSE', 'cat-lazer', '2026-05-31'),
  ('tx-seed-2026-05-cat-compras', 'Maio (importado da planilha)', 404.38, 'EXPENSE', 'cat-compras', '2026-05-31'),
  ('tx-seed-2026-05-cat-outros', 'Maio (importado da planilha)', 204.4, 'EXPENSE', 'cat-outros', '2026-05-31'),
  ('tx-seed-2026-06-cat-alimentacao', 'Junho (importado da planilha)', 220.92, 'EXPENSE', 'cat-alimentacao', '2026-06-30'),
  ('tx-seed-2026-06-cat-uber', 'Junho (importado da planilha)', 200.71, 'EXPENSE', 'cat-uber', '2026-06-30'),
  ('tx-seed-2026-06-cat-gasolina', 'Junho (importado da planilha)', 50, 'EXPENSE', 'cat-gasolina', '2026-06-30'),
  ('tx-seed-2026-06-cat-compras', 'Junho (importado da planilha)', 96.37, 'EXPENSE', 'cat-compras', '2026-06-30'),
  ('tx-seed-2026-06-cat-outros', 'Junho (importado da planilha)', 171.17, 'EXPENSE', 'cat-outros', '2026-06-30'),
  ('tx-seed-2026-07-cat-alimentacao', 'Julho (importado da planilha)', 119.75, 'EXPENSE', 'cat-alimentacao', '2026-07-31'),
  ('tx-seed-2026-07-cat-uber', 'Julho (importado da planilha)', 222.78, 'EXPENSE', 'cat-uber', '2026-07-31'),
  ('tx-seed-2026-07-cat-gasolina', 'Julho (importado da planilha)', 117.24, 'EXPENSE', 'cat-gasolina', '2026-07-31'),
  ('tx-seed-2026-07-cat-vestimenta', 'Julho (importado da planilha)', 200, 'EXPENSE', 'cat-vestimenta', '2026-07-31'),
  ('tx-seed-2026-07-cat-compras', 'Julho (importado da planilha)', 127.14, 'EXPENSE', 'cat-compras', '2026-07-31'),
  ('tx-seed-2026-07-cat-outros', 'Julho (importado da planilha)', 161.89, 'EXPENSE', 'cat-outros', '2026-07-31'),
  ('tx-seed-2026-08-cat-uber', 'Agosto (importado da planilha)', 54.87, 'EXPENSE', 'cat-uber', '2026-08-31'),
  ('tx-seed-2026-08-cat-compras', 'Agosto (importado da planilha)', 7.45, 'EXPENSE', 'cat-compras', '2026-08-31')
on conflict (id) do update set description = excluded.description, amount = excluded.amount, category_id = excluded.category_id, date = excluded.date;
