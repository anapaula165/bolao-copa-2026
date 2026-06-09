# 🏆 Bolão da Copa do Mundo 2026 — Serviços Internacionais IBBA

Site de bolão com **login real por e-mail e senha**, palpites da fase de grupos,
chaveamento interativo do mata-mata (IDs oficiais da FIFA), palpites especiais,
ranking que atualiza sozinho e painel de administrador.

- **Frontend:** React + Vite
- **Backend:** Node + Express
- **Banco:** PostgreSQL
- **Login:** e-mail + senha (senha com hash `bcrypt`, sessão via `JWT`)

---

## ✅ O que você vai precisar

1. **Node.js 18 ou superior** — https://nodejs.org
2. **Um banco PostgreSQL.** Recomendo o **Neon** (grátis e **não expira**): https://neon.tech
   > ⚠️ O Postgres grátis do **Render expira em ~30 dias**. Como a Copa dura mais de 30 dias
   > (11/jun a 19/jul), **use o Neon** para não perder o ranking no meio do torneio.
   > O Render entra só para hospedar o site.

---

## 💻 Rodar no seu computador (VSCode)

1. Descompacte o projeto e abra a pasta no VSCode.

2. Crie um banco no Neon (ou use um Postgres local) e copie a **connection string**.
   No Neon: *Dashboard → Connection string* (algo como
   `postgresql://usuario:senha@ep-xxx.neon.tech/neondb?sslmode=require`).

3. Crie o arquivo de configuração: copie `.env.example` para `.env` e preencha:
   ```
   DATABASE_URL=postgresql://...           (a string do passo 2)
   JWT_SECRET=uma-frase-bem-longa-e-aleatoria
   ADMIN_EMAIL=seu-email@empresa.com       (quem criar conta com este e-mail vira admin)
   DEADLINE=2026-06-11T12:00
   PORT=3001
   ```

4. Instale as dependências (duas pastas):
   ```bash
   npm install
   npm install --prefix client
   ```

5. Rode em **dois terminais**:
   ```bash
   # Terminal 1 — backend (porta 3001)
   npm run dev

   # Terminal 2 — frontend (porta 5173)
   npm --prefix client run dev
   ```
   Abra **http://localhost:5173**. O frontend já manda as chamadas `/api` para o backend.

6. Clique em **Criar conta** e cadastre-se **com o mesmo e-mail do `ADMIN_EMAIL`** —
   essa conta vira o administrador e enxerga o painel na aba **Perfil**.

### Testar o modo de produção localmente (opcional)
```bash
npm run build      # builda o frontend
npm start          # sobe tudo junto na porta 3001
```
Abra **http://localhost:3001**.

---

## 🚀 Publicar no Render

1. Suba o projeto para um repositório no **GitHub**.

2. Garanta um **PostgreSQL** (recomendado: Neon, do passo anterior). Tenha a `DATABASE_URL` em mãos.

3. No Render: **New → Web Service → Connect** seu repositório. Configure:
   - **Language/Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

4. Em **Environment**, adicione as variáveis:
   | Chave | Valor |
   |---|---|
   | `DATABASE_URL` | sua string do Neon |
   | `JWT_SECRET` | uma frase longa e aleatória |
   | `ADMIN_EMAIL` | seu e-mail (vira admin) |
   | `DEADLINE` | `2026-06-11T12:00` |

   > O Render define a variável `PORT` sozinho — não precisa criar.

5. Clique em **Deploy**. Ao final, você recebe uma URL tipo
   `https://bolao-copa-2026.onrender.com`. **Esse é o link que você manda para a equipe.**

6. Acesse a URL, **crie sua conta com o `ADMIN_EMAIL`** e pronto.

### Observações do plano grátis do Render
- O serviço **hiberna após ~15 min sem uso** e leva 30–60s para "acordar" no primeiro acesso. Normal no plano grátis.
- Por isso o banco fica no **Neon** (persistente), e não no Postgres do Render (que expira em 30 dias).

---

## ✏️ Como editar depois (sem perder o ranking)

Como os palpites e o ranking ficam **no banco (separado do código)**, você pode mudar o site
e fazer deploy de novo à vontade — os dados continuam intactos. Para atualizar: edite os
arquivos, dê `git push`, e o Render reimplanta sozinho.

Arquivos úteis:
- **`client/src/data.js`** — times, tabela dos 72 jogos (`GM`), chaveamento e **pontuação** (`POINTS`).
  Cada linha de `GM` é `[id, grupo, mandante, visitante, rodada, data, dia, hora, estádio]`.
- **`client/src/App.jsx`** — telas e abas.
- **`server/index.js`** — API (auth, palpites, ranking, admin).

---

## 🧮 Pontuação

| Item | Pontos |
|---|---|
| Placar exato (grupos) | 3 |
| Resultado certo (grupos) | 1 |
| Acertar quem avança (cada confronto do mata-mata) | 3 |
| Placar do mata-mata (bônus, se acertar) | 1 |
| Campeão | 8 |
| Vice | 5 |
| 3º lugar | 3 |
| Artilheiro | 5 |
| Melhor jogador | 5 |

O **administrador** lança os resultados na aba **Perfil → painel do admin**
(resultados de grupos, quem avançou no mata-mata e os especiais), e o ranking recalcula sozinho.

---

## 🔒 Sobre o login por e-mail

O login usa **e-mail + senha** (senha guardada com hash, nunca em texto puro).
Não há envio de e-mail de confirmação — o e-mail serve como identificador da conta.
Se quiser adicionar confirmação por e-mail no futuro, dá para integrar um provedor de e-mail
(ex.: `nodemailer` + SMTP) no `server/index.js`, sem mexer no resto.

---

Feito para o bolão da equipe. Bom torneio! 🇧🇷⚽

---

## Novidades desta versão

### 1. "Esqueci minha senha"
Na tela de login há o link **"Esqueci minha senha"**. A pessoa informa o e-mail e recebe um link para criar uma nova senha (válido por 1 hora, uso único).

Há **dois caminhos**, e o recurso funciona mesmo sem configurar e-mail:

- **Com e-mail configurado (SMTP):** o link chega automaticamente no e-mail da pessoa. Preencha as variáveis `SMTP_*` e `APP_URL` (veja `.env.example`). Para Gmail, gere uma *senha de app* em https://myaccount.google.com/apppasswords e use-a em `SMTP_PASS`.
- **Sem e-mail configurado:** o administrador abre **Perfil → painel do admin → Participantes**, clica em **"gerar link"** na pessoa, copia o link e envia (WhatsApp, etc.). O link também aparece no log do servidor.

### 2. Mata-mata bloqueado até a hora certa
A aba **Palpites → Mata-mata** começa **bloqueada**. Quando a fase de grupos terminar:
1. Vá em **painel do admin → "Liberar mata-mata"**.
2. Preencha os **32 classificados** (os países que avançaram) nos campos dos 32-avos e clique em **"Salvar classificados"**.
3. Marque **"Liberar o mata-mata"**. Agora o pessoal palpita quem avança em cada confronto (e o placar, opcional) **até a final**.
4. Antes do 1º jogo do mata-mata, marque **"Travar os palpites do mata-mata"** para congelar os palpites.

Os participantes **não escolhem mais** os times dos 32-avos — eles já vêm dos classificados oficiais que você cadastrou. Eles só marcam quem avança.

### 3. Apostas dos grupos em ordem cronológica + trava por jogo
A fase de grupos agora aparece em **ordem cronológica** (agrupada por dia), e **não trava mais tudo de uma vez**. Cada jogo **fecha sozinho 30 minutos antes do apito**. Assim dá para ir preenchendo aos poucos, acompanhando o desempenho das seleções.

- O antigo prazo único (11/06 12h) agora vale **apenas para os palpites especiais** (campeão, artilheiro, etc.). Você ajusta esse prazo em **painel do admin → "Prazos & trava"**.
- A **trava geral** (no mesmo lugar) é só para emergência: congela tudo na hora.
- A trava por jogo é validada também **no servidor** — ninguém consegue alterar um jogo depois que ele fechou.

> Observação importante: a trava usa o relógio do servidor. Hospedando no Render, o horário fica em UTC, mas o código já considera o fuso de Brasília (UTC−3) ao calcular o "30 minutos antes". Não precisa configurar nada.
