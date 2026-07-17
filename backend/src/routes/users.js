const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const prisma = require('../db/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('GESTOR'));

const PAPEIS = ['GESTOR', 'OPERADOR'];

const criarSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  usuario: z.string().trim().min(1).max(60),
  senha: z.string().min(6).max(200),
  papel: z.enum(PAPEIS),
});

const atualizarSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  papel: z.enum(PAPEIS),
  ativo: z.boolean(),
});

const resetSenhaSchema = z.object({
  novaSenha: z.string().min(6).max(200),
});

function toApi(user) {
  return { id: user.id, nome: user.nome, usuario: user.usuario, papel: user.papel, ativo: user.ativo };
}

router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { nome: 'asc' } });
  res.json(users.map(toApi));
});

router.post('/', async (req, res) => {
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: parsed.error.flatten() });
  const { nome, usuario, senha, papel } = parsed.data;
  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await prisma.user.create({ data: { nome, usuario, senhaHash, papel } });
    res.status(201).json(toApi(user));
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Já existe um usuário com esse nome de login.' });
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const parsed = atualizarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: parsed.error.flatten() });
  if (req.params.id === req.user.sub && parsed.data.ativo === false) {
    return res.status(400).json({ erro: 'Você não pode desativar a própria conta.' });
  }
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(toApi(user));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado.' });
    throw err;
  }
});

router.post('/:id/reset-senha', async (req, res) => {
  const parsed = resetSenhaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Informe uma senha com pelo menos 6 caracteres.' });
  try {
    const senhaHash = await bcrypt.hash(parsed.data.novaSenha, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { senhaHash } });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Usuário não encontrado.' });
    throw err;
  }
});

module.exports = router;
