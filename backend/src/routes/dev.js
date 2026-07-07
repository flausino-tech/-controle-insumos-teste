const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const prisma = require('../db/client');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireRole('GESTOR'));

const UNIDADES = ['kg', 'g', 'L', 'mL', 'un', 'cx', 'pct', 'sc'];
const CATEGORIAS = ['Matéria-Prima', 'Embalagem', 'Corante/Aditivo', 'Etiqueta', 'Insumo de Limpeza', 'Outro'];
const TIPO_MAP = { entrada: 'ENTRADA', saida: 'SAIDA', ajuste: 'AJUSTE' };

function txt(v, max) { return String(v ?? '').slice(0, max || 500); }

// Importa um backup JSON gerado pelo piloto anterior (localStorage) ou por
// este próprio sistema. Tratado como dado não confiável: todo campo é
// validado, e os IDs do arquivo nunca são usados diretamente — servem só
// para religar insumo <-> movimentação durante a importação.
router.post('/import', async (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.insumos)) {
    return res.status(400).json({ erro: 'Formato inválido (esperado um backup exportado por este sistema).' });
  }
  let ignorados = 0;
  const idRemap = new Map();

  for (const raw of data.insumos) {
    const codigo = txt(raw.codigo, 60).trim();
    const descricao = txt(raw.descricao, 200).trim();
    if (!codigo || !descricao) { ignorados++; continue; }
    const existente = await prisma.insumo.findUnique({ where: { codigo } });
    if (existente) { idRemap.set(raw.id, existente.id); continue; }
    const novo = await prisma.insumo.create({
      data: {
        codigo, descricao,
        categoria: CATEGORIAS.includes(raw.categoria) ? raw.categoria : 'Outro',
        unidade: UNIDADES.includes(raw.unidade) ? raw.unidade : 'un',
        estoqueMinimo: Number(raw.estoqueMinimo) || 0,
        saldoAtual: Number(raw.saldoAtual) || 0,
        fornecedor: txt(raw.fornecedor, 120),
        observacoes: txt(raw.obs ?? raw.observacoes, 1000),
        ativo: raw.ativo !== false,
      },
    });
    idRemap.set(raw.id, novo.id);
  }

  const existentes = await prisma.movimentacao.findMany({
    select: { insumoId: true, tipo: true, dataHora: true, quantidade: true, saldoAnterior: true, saldoResultante: true, documento: true },
  });
  const chave = m => [m.insumoId, m.tipo, new Date(m.dataHora).toISOString(), String(m.quantidade), String(m.saldoAnterior), String(m.saldoResultante), m.documento].join('|');
  const chaves = new Set(existentes.map(chave));

  for (const raw of (Array.isArray(data.movimentacoes) ? data.movimentacoes : [])) {
    const tipo = TIPO_MAP[raw.tipo];
    const insumoId = idRemap.get(raw.insumoId);
    const quantidade = Number(raw.quantidade);
    const dataHora = new Date(raw.data);
    if (!tipo || !insumoId || !Number.isFinite(quantidade) || isNaN(dataHora.getTime())) { ignorados++; continue; }
    const registro = {
      insumoId, tipo, dataHora,
      quantidade, saldoAnterior: Number(raw.saldoAnterior) || 0, saldoResultante: Number(raw.saldoResultante) || 0,
      documento: txt(raw.documento, 120),
    };
    const key = chave(registro);
    if (chaves.has(key)) continue;
    await prisma.movimentacao.create({
      data: {
        ...registro,
        parceiro: txt(raw.parceiro, 120),
        observacao: txt(raw.obs ?? raw.observacao, 1000),
        usuarioId: req.user.sub,
        nf: txt(raw.nf, 60), lote: txt(raw.lote, 60),
        finalidade: txt(raw.finalidade, 60),
        modoAjuste: txt(raw.modo ?? raw.modoAjuste, 20),
        motivoAjuste: txt(raw.motivoAjuste ?? raw.motivo, 60),
      },
    });
    chaves.add(key);
  }

  res.json({ ok: true, ignorados });
});

router.post('/seed-demo', async (req, res) => {
  const demo = [
    { codigo: 'MP-0001', descricao: 'Farinha de Trigo Big Bag', categoria: 'Matéria-Prima', unidade: 'kg', estoqueMinimo: 500, saldoAtual: 1200, fornecedor: 'Moinho Real' },
    { codigo: 'EMB-0010', descricao: 'Embalagem 10 kg', categoria: 'Embalagem', unidade: 'un', estoqueMinimo: 200, saldoAtual: 150, fornecedor: 'Emplast Ltda' },
    { codigo: 'EMB-0025', descricao: 'Embalagem 25 kg', categoria: 'Embalagem', unidade: 'un', estoqueMinimo: 100, saldoAtual: 340, fornecedor: 'Emplast Ltda' },
    { codigo: 'ADT-0001', descricao: 'Corante Urucum', categoria: 'Corante/Aditivo', unidade: 'kg', estoqueMinimo: 20, saldoAtual: 8, fornecedor: 'Cores & Cia' },
    { codigo: 'ADT-0002', descricao: 'Corante Caramelo', categoria: 'Corante/Aditivo', unidade: 'kg', estoqueMinimo: 15, saldoAtual: 42, fornecedor: 'Cores & Cia' },
    { codigo: 'ETQ-0001', descricao: 'Etiqueta Padrão', categoria: 'Etiqueta', unidade: 'un', estoqueMinimo: 5000, saldoAtual: 3200, fornecedor: 'GraphLabel' },
  ];
  const criados = {};
  for (const d of demo) {
    const insumo = await prisma.insumo.upsert({ where: { codigo: d.codigo }, update: {}, create: { ...d, observacoes: '' } });
    criados[d.codigo] = insumo;
  }
  const diasAtras = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
  const movs = [
    { insumo: criados['MP-0001'], tipo: 'ENTRADA', quantidade: 1000, saldoAnterior: 200, saldoResultante: 1200, dias: 6, documento: 'NF-5521', parceiro: 'Moinho Real', nf: '5521', lote: 'L001' },
    { insumo: criados['EMB-0010'], tipo: 'SAIDA', quantidade: 50, saldoAnterior: 200, saldoResultante: 150, dias: 4, documento: 'REQ-1002', parceiro: 'Produção - Linha 1', finalidade: 'Produção' },
    { insumo: criados['ADT-0002'], tipo: 'ENTRADA', quantidade: 10, saldoAnterior: 32, saldoResultante: 42, dias: 3, documento: 'NF-8890', parceiro: 'Cores & Cia', nf: '8890' },
    { insumo: criados['ADT-0001'], tipo: 'SAIDA', quantidade: 2, saldoAnterior: 10, saldoResultante: 8, dias: 1, documento: 'REQ-1010', parceiro: 'Produção - Linha 2', finalidade: 'Produção' },
    { insumo: criados['ETQ-0001'], tipo: 'AJUSTE', quantidade: 3200, saldoAnterior: 5000, saldoResultante: 3200, dias: 2, parceiro: 'Inventário', motivoAjuste: 'Inventário', modoAjuste: 'definir', observacao: 'Contagem física de fechamento de mês' },
  ];
  for (const m of movs) {
    await prisma.movimentacao.create({
      data: {
        tipo: m.tipo, insumoId: m.insumo.id, quantidade: m.quantidade,
        saldoAnterior: m.saldoAnterior, saldoResultante: m.saldoResultante,
        dataHora: diasAtras(m.dias), documento: m.documento || '', parceiro: m.parceiro || '',
        observacao: m.observacao || '', usuarioId: req.user.sub,
        nf: m.nf || '', lote: m.lote || '', finalidade: m.finalidade || '',
        modoAjuste: m.modoAjuste || '', motivoAjuste: m.motivoAjuste || '',
      },
    });
  }
  res.json({ ok: true });
});

const wipeSchema = z.object({ senha: z.string().min(1), confirmacao: z.literal('APAGAR TUDO') });

router.delete('/wipe', async (req, res) => {
  const parsed = wipeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ erro: 'Digite sua senha e a confirmação exata "APAGAR TUDO".' });
  }
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  const ok = await bcrypt.compare(parsed.data.senha, user.senhaHash);
  if (!ok) return res.status(401).json({ erro: 'Senha incorreta.' });
  await prisma.movimentacao.deleteMany({});
  await prisma.insumo.deleteMany({});
  res.json({ ok: true });
});

module.exports = router;
