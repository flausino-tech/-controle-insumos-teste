const express = require('express');
const { z } = require('zod');
const prisma = require('../db/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const UNIDADES = ['kg', 'g', 'L', 'mL', 'un', 'cx', 'pct', 'sc'];
const CATEGORIAS = ['Matéria-Prima', 'Embalagem', 'Corante/Aditivo', 'Etiqueta', 'Insumo de Limpeza', 'Outro'];

const insumoSchema = z.object({
  codigo: z.string().trim().min(1).max(60),
  descricao: z.string().trim().min(1).max(200),
  categoria: z.enum(CATEGORIAS),
  unidade: z.enum(UNIDADES),
  estoqueMinimo: z.number().finite().min(0).default(0),
  saldoInicial: z.number().finite().min(0).default(0).optional(),
  fornecedor: z.string().trim().max(120).default(''),
  observacoes: z.string().trim().max(1000).default(''),
});

router.get('/', async (req, res) => {
  const insumos = await prisma.insumo.findMany({ orderBy: { codigo: 'asc' } });
  res.json(insumos);
});

router.get('/:id', async (req, res) => {
  const insumo = await prisma.insumo.findUnique({ where: { id: req.params.id } });
  if (!insumo) return res.status(404).json({ erro: 'Insumo não encontrado.' });
  const movimentacoes = await prisma.movimentacao.findMany({
    where: { insumoId: insumo.id },
    orderBy: { dataHora: 'desc' },
    take: 10,
  });
  res.json({ ...insumo, movimentacoes });
});

router.post('/', requireRole('GESTOR'), async (req, res) => {
  const parsed = insumoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: parsed.error.flatten() });
  const { saldoInicial, ...dados } = parsed.data;
  try {
    const insumo = await prisma.insumo.create({
      data: { ...dados, saldoAtual: saldoInicial ?? 0 },
    });
    res.status(201).json(insumo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Já existe um insumo com esse código.' });
    throw err;
  }
});

router.put('/:id', requireRole('GESTOR'), async (req, res) => {
  const parsed = insumoSchema.omit({ saldoInicial: true }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: parsed.error.flatten() });
  try {
    const insumo = await prisma.insumo.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(insumo);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ erro: 'Já existe um insumo com esse código.' });
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Insumo não encontrado.' });
    throw err;
  }
});

router.post('/:id/toggle-ativo', requireRole('GESTOR'), async (req, res) => {
  const insumo = await prisma.insumo.findUnique({ where: { id: req.params.id } });
  if (!insumo) return res.status(404).json({ erro: 'Insumo não encontrado.' });
  const atualizado = await prisma.insumo.update({ where: { id: insumo.id }, data: { ativo: !insumo.ativo } });
  res.json(atualizado);
});

module.exports = router;
