# Backend — Controle de Insumos

API REST + front-end servido junto (mesma origem) para o Controle de
Insumos: substitui o localStorage do piloto por um banco central em
PostgreSQL, com login individual por usuário (Gestor/Operador).

## Rodando em desenvolvimento (sem Docker)

Requer Node.js 20+ e um PostgreSQL local.

```
cp .env.example .env        # ajuste DATABASE_URL, JWT_SECRET e COOKIE_SECURE
npm install
npm run prisma:migrate      # cria as tabelas
npm run seed                # cria os usuários gestor/operador iniciais
npm run dev                 # sobe em http://localhost:3001
```

Usuários criados pelo seed (**troque a senha assim que possível**):
- `gestor` / `troque-esta-senha` (papel GESTOR)
- `operador` / `troque-esta-senha` (papel OPERADOR)

## Rodando com Docker (recomendado)

```
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
docker compose up -d --build
docker compose exec api npm run seed
```

A API + front-end sobem em `http://localhost:3001` e o Postgres fica
só acessível internamente entre os containers (não exposto na rede).

---

## Rede local da fábrica (PC servidor + tablet do operador)

Diferente do piloto anterior (tablet 100% offline), esta versão usa um
banco central — então o tablet precisa **estar na mesma rede Wi-Fi**
que o computador que roda o backend.

### 1. Escolha a máquina "servidor"

Pode ser o PC do gestor ou um mini-PC dedicado — só precisa ficar
ligado e conectado ao Wi-Fi/rede da fábrica enquanto o pessoal usa o
sistema. Instale o Docker Desktop nela (ou Node.js 20+ e PostgreSQL,
se preferir sem Docker).

### 2. Baixe o código e suba o sistema

```
git clone <url-do-repositório>
cd arthur/backend
echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
echo "COOKIE_SECURE=false" >> .env
docker compose up -d --build
docker compose exec api npm run seed
```

`COOKIE_SECURE=false` é o que permite o login funcionar acessando por
`http://IP:3001` (sem HTTPS) — é o cenário normal de rede local. Veja
a nota de segurança no fim deste guia.

### 3. Descubra o IP local dessa máquina na rede

- Windows: abra o `cmd` e rode `ipconfig` → veja "Endereço IPv4"
  (algo como `192.168.1.50`)
- Mac/Linux: `ifconfig` ou `ip addr` → mesma ideia

### 4. Teste primeiro no próprio servidor

Abra `http://localhost:3001` no navegador da própria máquina e
confirme que o login funciona.

### 5. Teste de outro aparelho na mesma rede

Do seu celular (no mesmo Wi-Fi), abra `http://192.168.1.50:3001`
(troque pelo IP real do passo 3). Se não abrir, o firewall do Windows
provavelmente está bloqueando a porta 3001 — libere-a para a rede
local (Firewall do Windows Defender → Regra de Entrada → Nova Regra →
Porta → TCP 3001 → Permitir).

### 6. Configure o tablet

1. Conecte o tablet no **mesmo Wi-Fi** da fábrica.
2. Abra o Chrome e navegue até `http://192.168.1.50:3001` (o IP do
   passo 3).
3. Faça login com o usuário `operador`.
4. Menu do Chrome (⋮) → **"Adicionar à tela inicial"** — nomeie como
   "Estoque" ou similar, para virar um atalho tipo aplicativo.
5. Opcional (modo quiosque): Configurações do Android → busque
   "Fixar tela" → ative, e depois use "Fixar" no app aberto para
   travar o tablet nessa tela.

### 7. Deixe o IP do servidor fixo

Se o IP do servidor mudar (o roteador pode reatribuir), o atalho
salvo no tablet para de funcionar. Para evitar isso:
- No roteador, reserve um IP fixo para o MAC address da máquina
  servidora (a maioria dos roteadores domésticos/empresariais chama
  isso de "DHCP reservation" ou "IP fixo por dispositivo"); ou
- Configure IP estático diretamente na máquina servidora.

### 8. Nota de segurança sobre a rede

- Isso está rodando em **HTTP simples** (sem criptografia) dentro da
  rede local — aceitável para uma rede interna de confiança, mas as
  senhas trafegam sem criptografia entre tablet e servidor. Se quiser
  fechar esse ponto, o próximo passo é colocar um proxy reverso com
  HTTPS (certificado autoassinado ou de uma CA interna) na frente da
  porta 3001, e então sim ligar `COOKIE_SECURE=true`.
- Não abra a porta 3001 para a internet (sem redirecionamento de porta
  no roteador) — o acesso deve ficar restrito à rede local da fábrica.

---

## Endpoints disponíveis

- `POST /api/v1/auth/login`, `/logout`, `GET /auth/me`
- `GET/POST /api/v1/insumos`, `GET/PUT /api/v1/insumos/:id`,
  `POST /api/v1/insumos/:id/toggle-ativo` (GESTOR para escrita)
- `GET/POST /api/v1/movimentacoes`, `DELETE /api/v1/movimentacoes/:id`
  (GESTOR e OPERADOR lançam; só GESTOR exclui)
- `POST /api/v1/dev/import`, `POST /api/v1/dev/seed-demo`,
  `DELETE /api/v1/dev/wipe` (todos GESTOR-only)
