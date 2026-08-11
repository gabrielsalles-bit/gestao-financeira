# Gestão da Livinha — Redesenho Manual-First (v2)

Data: 2026-08-10
Status: Aprovado pelo usuário, pronto para virar plano de execução.

## 1. Contexto

O app "Gestão da Livinha" é um sistema pessoal de finanças (Next.js 14 + Tailwind,
hospedado na Vercel, com PWA configurada) feito para uso da namorada do usuário,
que hoje organiza as finanças dela numa planilha Excel. A versão atual tentou
automatizar a importação de extratos via Open Finance (Pluggy), o que passou a
gerar cobrança. O usuário quer eliminar essa dependência paga e transformar o
app num sistema **100% manual**, com o registro consciente de cada gasto como
o comportamento central, mantendo apenas o banco de dados (Supabase, gratuito)
para sincronizar entre celular e computador.

Junto disso, o usuário pediu uma reformulação visual completa — priorizando
clareza, organização da informação e consistência entre mobile e desktop — e
autorizou simplificar ou remover qualquer parte da interface que hoje seja
confusa, redundante ou não funcional, usando julgamento de UX.

## 2. Descobertas da auditoria do código atual

- **Bug de sincronização**: `storage.ts` grava `user_id: 'livinha-app-user-v1'`
  (string) numa coluna `UUID` que referencia `auth.users(id)`. Todo `upsert` ao
  Supabase falha silenciosamente (erro só vai pro `console.warn`). Além disso,
  os métodos `getCategories`/`getTransactions`/`getUserPrefs` **nunca leem do
  Supabase** — só do `localStorage`. Ou seja, hoje a sincronização entre
  dispositivos não existe de fato, apesar do código sugerir que sim.
- **Segredos no código-fonte**: `src/app/api/pluggy-sync/route.ts` tem
  `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET`/`PLUGGY_DEFAULT_ITEM_ID` reais como
  valor *fallback* hardcoded, e `AppSecurityLock.tsx` tem a senha padrão
  `'marrenta1234'` hardcoded. Ambos precisam sair do código-fonte.
- **Dado fictício disfarçado de real**: `ReportsView.tsx` tem um array
  `monthlyData` com números de Maio–Agosto **inventados no código**, exibidos
  como se fossem o histórico real da usuária.
- **`.env.local` e `node_modules`/`.next` quase foram versionados** por engano
  no primeiro commit do repositório git recém-criado — já corrigido antes
  deste documento (`.gitignore` agora exclui `node_modules`, `.next`,
  `.env*.local`).

## 3. Objetivos

1. Remover toda dependência de API externa paga (Pluggy/Open Finance, Resend).
2. Corrigir a sincronização real entre dispositivos via Supabase.
3. Tornar o registro manual de lançamentos a ação central e mais visível do
   app, em toda tela.
4. Substituir números fictícios por cálculos reais baseados no histórico
   armazenado (comparação entre meses, projeção de fechamento, taxa de
   poupança, saldo acumulado).
5. Redesenhar a interface para ser mais clara, consistente e simples —
   igualmente bem cuidada no celular e no computador — removendo qualquer
   botão, aba ou texto que hoje seja redundante, confuso ou não funcional.
6. Preparar o terreno para a carga dos dados reais da planilha Excel (a ser
   enviada separadamente pelo usuário).

## 4. Fora de escopo

- Autenticação real de usuários (login/senha via Supabase Auth). A trava de
  PIN continua sendo o único controle de acesso — é suficiente para um app de
  uso pessoal/casal.
- Qualquer importação automática de banco (Open Finance, screen scraping,
  etc.) — está fora por definição do objetivo do projeto.
- Suíte de testes automatizados — não existe hoje no projeto; verificação
  será manual (checklist ao final deste documento), para não inflar o escopo.

## 5. O que é removido

| Item | Motivo |
|---|---|
| `src/components/OpenFinanceView.tsx` | Tela inteira de Open Finance/Pluggy |
| `src/app/api/pluggy-sync/route.ts` | Endpoint da API paga |
| `src/app/api/send-alert/route.ts` | Endpoint de e-mail (Resend) |
| Dependência `resend` no `package.json` | Não usada mais |
| Badge "Nubank Conectado (100% Automático)" + botão de sync no `Navigation.tsx`/`Header.tsx` | Simulação falsa (`setTimeout`), linguagem incompatível com "manual-first" |
| `handleQuickSync` em `page.tsx` | Gerava transação fake |
| Seção de disparo de e-mail em `HealthTipsView.tsx` | Dependia da Resend |
| Aba "Nubank Sync" na navegação | Tela removida |
| `INITIAL_TRANSACTIONS` fictício em `storage.ts` | Dado de teste, será substituído por carga real |
| `monthlyData` fake em `ReportsView.tsx` | Substituído por cálculo real |
| Chaves Pluggy hardcoded + PIN hardcoded | Risco de segurança |
| Variáveis de ambiente `PLUGGY_*` e `RESEND_API_KEY` | Não usadas mais |

## 6. O que é mantido e como muda

### 6.1 Importador de planilha (CSV/Excel)
Continua existindo — reduz trabalho manual sem abrir mão de controle, e a
etapa de pré-visualização (editar descrição/nicho/valor antes de confirmar)
já é a proteção contra dado mal importado. Mudanças:
- Passa a aceitar `.xlsx`/`.xls` além de `.csv` (biblioteca `xlsx`/SheetJS,
  que roda 100% no navegador, sem chamada de rede — continua sendo "sem API
  externa").
- Detecção simples de possível duplicata: antes de confirmar, linhas com
  mesma data + valor + descrição de um lançamento já existente aparecem
  marcadas com aviso "possível duplicata", mas continuam editáveis/removíveis
  pela usuária — a decisão final é sempre manual.
- Reposicionado: deixa de estar "dentro" de uma aba de Open Finance e passa a
  ser acessível a partir do Extrato (botão secundário "Importar planilha"),
  coerente com ser uma ferramenta de apoio, não o fluxo principal.

### 6.2 Nichos/envelopes com limite
Mantido como está — é o conceito central vindo da planilha da usuária.

### 6.3 Trava de PIN
Mantida, mas sem senha hardcoded: se nenhum PIN foi configurado ainda, a
primeira tela pede para criar um (em vez de vir com senha padrão pronta). O
PIN fica salvo via Supabase (`user_preferences`) + cache local, não mais um
literal no código.

### 6.4 Botão de adicionar lançamento
Vira a ação primária mais visível da interface (ver seção 9) em vez de um
ícone pequeno rotulado "Opcional" — porque com o fim da automação, ele é a
*única* forma de entrada de dado no dia a dia.

## 7. Arquitetura de dados e sincronização

- **Fonte de verdade**: Supabase. `localStorage` passa a ser só um cache para
  abrir o app instantaneamente e funcionar offline — nunca a fonte principal.
- **Fluxo de leitura**: ao abrir o app, mostra o cache local imediatamente
  (sem tela em branco), busca do Supabase em paralelo e reconcilia — dado do
  Supabase sempre vence quando há conflito.
- **Fluxo de escrita**: toda alteração grava no Supabase primeiro; em caso de
  falha de rede, grava no cache local e marca como "pendente de
  sincronização" para reenviar quando a conexão voltar.
- **Correção de schema**: `supabase_schema.sql` é reescrito para remover a
  dependência de `auth.users`/tipo `UUID` no `user_id` (não há login real —
  o controle de acesso é o PIN, não RLS por usuário autenticado). As tabelas
  passam a usar uma política permissiva simples, já que o acesso à Supabase é
  protegido pela própria chave anônima do projeto + PIN da aplicação.
- **Indicador de estado**: um indicador discreto (não um badge grande como
  hoje) mostra "sincronizado" / "sincronizando" / "offline — dados salvos
  localmente, sincroniza ao reconectar".

## 8. Motor de cálculo financeiro

Novo módulo de cálculo (`utils/insights.ts`) que opera sobre **todo o
histórico de transações armazenado**, não só o mês corrente:

1. **Comparação com meses anteriores** — por nicho, compara o gasto do mês
   atual com a média dos últimos 3 meses anteriores com dados; mostra
   variação percentual e direção (subindo/descendo/estável).
2. **Projeção de fechamento do mês** — usa a razão gasto-atual / dias-já-
   passados (reaproveitando a lógica já existente em
   `calculateFinancialHealth`) para projetar o total estimado ao fim do mês e
   comparar com o limite total dos nichos.
3. **Taxa de poupança** — `(receita − despesa − investimento) / receita` por
   mês, com a evolução dos últimos meses disponíveis.
4. **Saldo acumulado** — soma progressiva do saldo mensal ao longo de todos
   os meses com dados, mostrando a evolução total no tempo.

Essas quatro métricas populam a aba unificada de Análise (seção 9). Todas
usam gráficos simples em CSS/SVG feitos à mão (barras, linha), sem adicionar
biblioteca de gráficos — mantém a filosofia de poucas dependências.

## 9. Navegação e organização da informação

Simplificação de 6 para **4 abas** — "Saúde & Dicas" deixava de ter conteúdo
próprio relevante depois de remover a seção de e-mail, e sobrepunha
"Análise" (as duas eram, no fundo, diagnóstico). Unificar reduz a carga
cognitiva de "onde eu acho isso":

1. **Início** — cartão de saldo do mês, grade de nichos, lançamentos
   recentes, botão de adicionar sempre visível.
2. **Extrato** — lista completa filtrável, edição de categoria, ponto de
   entrada para importar planilha.
3. **Análise** — uma tela só, em seções empilhadas (não sub-abas): KPIs do
   mês → tendência/projeção/poupança/saldo acumulado (novo, seção 8) →
   distribuição por nicho → maiores lançamentos → diagnóstico e dicas
   personalizadas (o que antes era "Saúde & Dicas", sem a parte de e-mail).
4. **Ajustes** — perfil, salário base, nichos, PIN, opção de limpar dados.

Isso também melhora a barra inferior no celular (4 itens grandes e claros em
vez de 6 apertados).

## 10. Redesenho visual

Mantém a identidade visual atual (cards escuros "obsidian", roxo de marca
`#8257E5`, sistema de semáforo verde/amarelo/vermelho, o toque pessoal "Feito
por Mozão") — já tem personalidade e foi pensado para ela. O que muda é a
**consistência de execução**:

- **Componente `Card` único** reaproveitado em todas as telas (hoje cada
  arquivo repete `rounded-3xl border border-gray-100 shadow-sm p-6` com
  pequenas variações) — garante que todo cartão do sistema tenha o mesmo
  espaçamento e comportamento em qualquer tela, incluindo o `Salvar
  Alterações`/`Editar Nichos`.
- **Escala tipográfica única** documentada (hoje há uso solto de
  `text-[10px]`, `text-[11px]` etc. espalhado) — reduz para um conjunto
  pequeno e consistente de tamanhos.
- **Estados vazios cuidados**: como o app passa a nascer sem dados fictícios,
  cada tela (Início, Extrato, Análise) ganha um estado vazio com ilustração
  simples + call-to-action clara para o primeiro lançamento, em vez de listas
  em branco.
- **Skeleton de carregamento** na abertura do app enquanto busca do Supabase,
  em vez do "flash" de conteúdo vazio.
- **Layout desktop mais aproveitado**: no Início, cartão de saldo e grade de
  nichos passam a dividir a largura em telas grandes (hoje tudo fica numa
  coluna central estreita, subutilizando espaço no computador).
- **Botão de adicionar lançamento como ação primária**: maior, com cor de
  destaque, sempre visível — no topo no desktop, flutuante no celular (já
  existe a versão mobile; a versão desktop hoje é um ícone pequeno e
  secundário rotulado "Opcional", que deixa de fazer sentido).
- **Remoção de elementos redundantes**: rótulo de "Receita Base" duplicado
  entre o cartão principal e Ajustes ganha copy mais clara para deixar
  explícito que é o mesmo valor editável em dois lugares por conveniência, e
  os rótulos "Saldo Restante no Mês" vs "Saldo Final Livre" ganham descrição
  curta inline para deixar claro que o segundo já desconta os investimentos
  do primeiro — hoje isso não é explicado em lugar nenhum.
- **Acessibilidade básica**: alvos de toque ≥44px no mobile, área segura para
  notch/gestos na barra inferior.

## 11. Migração e carga de dados reais

1. Ao publicar a v2, os dados fictícios atuais (Jan–Ago de teste) são
   apagados do Supabase e do `localStorage` (nova chave de versão de
   storage, para não ressuscitar cache antigo).
2. Quando o usuário enviar a planilha Excel da namorada, será escrito um
   script único de carga (fora da interface, rodado uma vez) que lê a
   planilha e insere o histórico real no Supabase, mapeando para os nichos
   existentes ou criando novos conforme necessário.
3. O app em si nunca mais expõe dado de exemplo — instalação nova = tela
   vazia com convite para o primeiro lançamento.

## 12. Tratamento de erros e casos-limite

- Supabase inacessível: cai para cache local, mostra indicador discreto de
  offline, tenta ressincronizar automaticamente ao voltar a conexão.
- Importação de planilha com linhas inválidas: já ignoradas com aviso
  (comportamento atual mantido), mais a marcação de possível duplicata
  (seção 6.1).
- Primeiro uso sem PIN configurado: fluxo de criação de PIN em vez de senha
  pronta.
- Sem nichos configurados: tela de Início orienta a criar o primeiro nicho
  antes de mostrar a grade vazia.

## 13. Plano de verificação (manual, sem suíte automatizada)

- [ ] Adicionar, editar e excluir lançamento manualmente.
- [ ] Trocar de mês e conferir que os totais recalculam certo.
- [ ] Criar/editar/excluir nicho e ver limite e semáforo reagirem.
- [ ] Importar um CSV e um XLSX de teste, confirmar preview + duplicata.
- [ ] Configurar PIN do zero, sair e voltar a acessar.
- [ ] Abrir o app em duas abas/dispositivos diferentes e confirmar que um
      lançamento feito em um aparece no outro após sincronizar.
- [ ] Derrubar a rede (DevTools offline) e confirmar fallback pro cache local
      com indicador correto.
- [ ] Conferir responsivo em mobile (375px), tablet (768px) e desktop
      (1280px+) nas 4 abas.
- [ ] Rodar `next build` sem erros e sem nenhuma referência a `PLUGGY_*`/
      `RESEND_API_KEY` restando no código.

## 14. Passos manuais fora do código (ficam com o usuário)

- Rodar a nova `supabase_schema.sql` no painel do Supabase (schema sem
  dependência de `auth.users`).
- Remover as variáveis `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`,
  `PLUGGY_DEFAULT_ITEM_ID` e `RESEND_API_KEY` do projeto na Vercel (não são
  mais lidas pelo código, mas é bom limpar).
- Enviar a planilha Excel da namorada para a carga de dados reais (seção 11).
