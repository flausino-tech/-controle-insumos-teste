const express = require('express');
const { z } = require('zod');
const prisma = require('../db/client');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isPerda, isDivergenciaInventario, registrarMovimentacao, excluirMovimentacaoMaisRecente } = require('../services/estoque');

const router = express.Router();
router.use(requireAuth);

const TIPO_MAP = { entrada: 'ENTRADA', saida: 'SAIDA', ajuste: 'AJUSTE' };

const criarSchema = z.object({
  tipo: z.enum(['entrada', 'saida', 'ajuste']),
  insumoId: z.string().min(1),
  quantidade: z.number().finite(),
  data: z.string().datetime().optional().or(z.literal('')),
  documento: z.string().trim().max(120).default(''),
  obs: z.string().trim().max(1000).default(''),
  fornecedor: z.string().trim().max(120).default(''),
  nf: z.string().trim().max(60).default(''),
  loteEntrada: z.string().trim().max(60).default(''),
  requisitante: z.string().trim().max(120).default(''),
  finalidade: z.enum(['Produção', 'Amostra', 'Perda', 'Outro']).default('Produção'),
  loteSaida: z.string().trim().max(60).default(''),
  motivo: z.enum(['Inventário', 'Perda', 'Quebra', 'Sobra', 'Correção']).default('Inventário'),
  modo: z.enum(['definir', 'delta']).default('definir'),
});

function toApi(mov) {
  return {
    id: mov.id,
    tipo: Object.keys(TIPO_MAP).find(k => TIPO_MAP[k] === mov.tipo),
    insumoId: mov.insumoId,
    quantidade: Number(mov.quantidade),
    saldoAnterior: Number(mov.saldoAnterior),
    saldoResultante: Number(mov.saldoResultante),
    data: mov.dataHora,
    documento: mov.documento,
    parceiro: mov.parceiro,
    observacao: mov.observacao,
    usuarioId: mov.usuarioId,
    nf: mov.nf,
    lote: mov.lote,
    finalidade: mov.finalidade,
    motivoAjuste: mov.motivoAjuste,
    modoAjuste: mov.modoAjuste,
    perda: isPerda(mov),
    divergenciaInventario: isDivergenciaInventario(mov),
  };
}

router.get('/', async (req, res) => {
  const { tipo, de, ate, busca } = req.query;
  const where = {};
  if (tipo && TIPO_MAP[tipo]) where.tipo = TIPO_MAP[tipo];
  if (de || ate) {
    where.dataHora = {};
    if (de) where.dataHora.gte = new Date(de + 'T00:00:00.000Z');
    if (ate) where.dataHora.lte = new Date(ate + 'T23:59:59.999Z');
  }
  if (busca) {
    where.OR = [
      { documento: { contains: String(busca), mode: 'insensitive' } },
      { insumo: { codigo: { contains: String(busca), mode: 'insensitive' } } },
      { insumo: { descricao: { contains: String(busca), mode: 'insensitive' } } },
    ];
  }
  const movimentacoes = await prisma.movimentacao.findMany({
    where, orderBy: { dataHora: 'desc' },
    include: { insumo: true, usuario: { select: { usuario: true, nome: true } } },
  });
  res.json(movimentacoes.map(m => ({
    ...toApi(m),
    insumo: { id: m.insumo.id, codigo: m.insumo.codigo, descricao: m.insumo.descricao, unidade: m.insumo.unidade },
    usuario: m.usuario.nome,
  })));
});

router.post('/', requireRole('GESTOR', 'OPERADOR'), async (req, res) => {
  const parsed = criarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ erro: 'Dados inválidos.', detalhes: parsed.error.flatten() });
  const b = parsed.data;

  if ((b.tipo === 'entrada' || b.tipo === 'saida') && (!b.quantidade || b.quantidade <= 0)) {
    return res.status(400).json({ erro: 'Informe uma quantidade maior que zero.' });
  }
  if (b.tipo === 'ajuste' && !Number.isFinite(b.quantidade)) {
    return res.status(400).json({ erro: 'Informe o valor do ajuste.' });
  }

  const extra = b.tipo === 'entrada'
    ? { parceiro: b.fornecedor, nf: b.nf, lote: b.loteEntrada }
    : b.tipo === 'saida'
    ? { parceiro: b.requisitante, finalidade: b.finalidade, lote: b.loteSaida }
    : { parceiro: b.motivo, motivoAjuste: b.motivo, modo: b.modo };

  try {
    const mov = await registrarMovimentacao({
      tipo: TIPO_MAP[b.tipo],
      insumoId: b.insumoId,
      quantidade: b.quantidade,
      dataHora: b.data ? new Date(b.data) : new Date(),
      documento: b.documento,
      obs: b.obs,
      usuarioId: req.user.sub,
      extra,
    });
    res.status(201).json(toApi(mov));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erro: err.message });
    throw err;
  }
});

router.delete('/:id', requireRole('GESTOR'), async (req, res) => {
  try {
    await excluirMovimentacaoMaisRecente(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erro: err.message });
    throw err;
  }
});

module.exports = router;
