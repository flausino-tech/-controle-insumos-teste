const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const prisma = require('../db/client');
const { requireAuth, COOKIE_NAME } = require('../middleware/auth');

const router = express.Router();

const loginSchema = z.object({
  usuario: z.string().min(1).max(60),
  senha: z.string().min(1).max(200),
});

// Limite simples de tentativas por usuário, em memória (suficiente para um único
// processo servindo uma fábrica; não sobrevive a reinício ou múltiplas réplicas).
const tentativas = new Map();
const MAX_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;

function bloqueado(usuario) {
  const registro = tentativas.get(usuario);
  if (!registro) return false;
  if (Date.now() - registro.desde > JANELA_MS) { tentativas.delete(usuario); return false; }
  return registro.count >= MAX_TENTATIVAS;
}
function registrarFalha(usuario) {
  const registro = tentativas.get(usuario) || { count: 0, desde: Date.now() };
  registro.count += 1;
  tentativas.set(usuario, registro);
}
function limparFalhas(usuario) { tentativas.delete(usuario); }

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Usuário e senha são obrigatórios.' });
  const { usuario, senha } = parsed.data;

  if (bloqueado(usuario)) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  }

  const user = await prisma.user.findUnique({ where: { usuario } });
  if (!user || !user.ativo) {
    registrarFalha(usuario);
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  const ok = await bcrypt.compare(senha, user.senhaHash);
  if (!ok) {
    registrarFalha(usuario);
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  limparFalhas(usuario);

  const token = jwt.sign(
    { sub: user.id, usuario: user.usuario, nome: user.nome, papel: user.papel },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Independente de NODE_ENV: numa fábrica o acesso costuma ser
    // http://IP-do-servidor na rede local, sem HTTPS. Se "secure" ficasse
    // amarrado a NODE_ENV=production, o navegador aceitaria o cookie no
    // login mas nunca o enviaria de volta por não ser HTTPS — login parece
    // funcionar e cai sozinho na primeira ação. Só marque true (via
    // COOKIE_SECURE=true no .env) quando houver HTTPS de verdade na frente.
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 12 * 60 * 60 * 1000,
  });
  res.json({ usuario: user.usuario, nome: user.nome, papel: user.papel });
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ usuario: req.user.usuario, nome: req.user.nome, papel: req.user.papel });
});

const senhaSchema = z.object({
  senhaAtual: z.string().min(1).max(200),
  novaSenha: z.string().min(6).max(200),
});

router.post('/senha', requireAuth, async (req, res) => {
  const parsed = senhaSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: 'Informe a senha atual e uma nova senha com pelo menos 6 caracteres.' });
  }
  const { senhaAtual, novaSenha } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(401).json({ erro: 'Sessão inválida.' });

  const ok = await bcrypt.compare(senhaAtual, user.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Senha atual incorreta.' });

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await prisma.user.update({ where: { id: user.id }, data: { senhaHash } });
  res.json({ ok: true });
});

module.exports = router;
