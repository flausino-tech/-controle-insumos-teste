const prisma = require('../db/client');

const TIPOS = ['ENTRADA', 'SAIDA', 'AJUSTE'];

function isPerda(mov) {
  if (mov.tipo === 'SAIDA' && mov.finalidade === 'Perda') return true;
  if (mov.tipo === 'AJUSTE' && ['Perda', 'Quebra'].includes(mov.motivoAjuste)
      && Number(mov.saldoResultante) < Number(mov.saldoAnterior)) return true;
  return false;
}

// Cria a movimentação e atualiza o saldo do insumo dentro de uma única
// transação com lock de linha (SELECT ... FOR UPDATE), para que duas
// movimentações simultâneas no mesmo insumo nunca se sobrescrevam
// (era exatamente o problema documentado no piloto em localStorage).
async function registrarMovimentacao({ tipo, insumoId, quantidade, dataHora, documento, obs, usuarioId, extra }) {
  return prisma.$transaction(async tx => {
    const [insumo] = await tx.$queryRaw`SELECT * FROM insumos WHERE id = ${insumoId} FOR UPDATE`;
    if (!insumo) { const e = new Error('Insumo não encontrado.'); e.status = 404; throw e; }
    if (!insumo.ativo) { const e = new Error('Insumo está inativo.'); e.status = 400; throw e; }

    const saldoAnterior = Number(insumo.saldo_atual);
    let saldoResultante;

    if (tipo === 'ENTRADA') {
      saldoResultante = saldoAnterior + quantidade;
    } else if (tipo === 'SAIDA') {
      if (quantidade > saldoAnterior) {
        const e = new Error(`Saldo insuficiente. Saldo atual: ${saldoAnterior} ${insumo.unidade}`);
        e.status = 409; throw e;
      }
      saldoResultante = saldoAnterior - quantidade;
    } else { // AJUSTE
      saldoResultante = extra.modo === 'definir' ? quantidade : saldoAnterior + quantidade;
      if (saldoResultante < 0) { const e = new Error('O saldo resultante não pode ser negativo.'); e.status = 400; throw e; }
    }

    const quantidadeRegistrada = tipo === 'AJUSTE' ? Math.abs(saldoResultante - saldoAnterior) : quantidade;

    await tx.insumo.update({ where: { id: insumoId }, data: { saldoAtual: saldoResultante } });

    const mov = await tx.movimentacao.create({
      data: {
        tipo, insumoId, quantidade: quantidadeRegistrada,
        saldoAnterior, saldoResultante,
        dataHora: dataHora || new Date(),
        documento: documento || '', observacao: obs || '',
        usuarioId,
        parceiro: extra.parceiro || '',
        nf: extra.nf || '', lote: extra.lote || '',
        finalidade: extra.finalidade || '', modoAjuste: extra.modo || '',
        motivoAjuste: extra.motivoAjuste || '',
      },
    });
    return mov;
  });
}

async function excluirMovimentacaoMaisRecente(movimentacaoId) {
  return prisma.$transaction(async tx => {
    const mov = await tx.movimentacao.findUnique({ where: { id: movimentacaoId } });
    if (!mov) { const e = new Error('Movimentação não encontrada.'); e.status = 404; throw e; }

    // Trava a linha do insumo primeiro: serializa qualquer exclusão/lançamento
    // concorrente nesse mesmo insumo antes de decidir se ainda é a mais recente.
    await tx.$queryRaw`SELECT * FROM insumos WHERE id = ${mov.insumoId} FOR UPDATE`;

    const [ultima] = await tx.$queryRaw`
      SELECT id FROM movimentacoes WHERE insumo_id = ${mov.insumoId}
      ORDER BY data_hora DESC LIMIT 1`;
    if (!ultima || ultima.id !== mov.id) {
      const e = new Error('Só é possível excluir a movimentação mais recente do insumo.');
      e.status = 409; throw e;
    }

    await tx.insumo.update({ where: { id: mov.insumoId }, data: { saldoAtual: mov.saldoAnterior } });
    await tx.movimentacao.delete({ where: { id: mov.id } });
  });
}

module.exports = { TIPOS, isPerda, registrarMovimentacao, excluirMovimentacaoMaisRecente };
