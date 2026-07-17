const bcrypt = require('bcryptjs');
const prisma = require('./client');

// Modo de recuperação de emergência: se TODOS os Gestores ficarem trancados
// fora do sistema (esqueceram a senha e não há mais ninguém pra redefinir
// pelo painel de Usuários), defina a variável de ambiente RESET_SENHAS=true
// no Render e reinicie o serviço — isso força a senha de "gestor" e
// "operador" de volta pro valor padrão abaixo. Tire a variável assim que
// conseguir entrar de novo, senão ela volta a resetar a cada reinício.
const RESET = process.env.RESET_SENHAS === 'true';

async function upsertUser(nome, usuario, senha, papel) {
  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.user.upsert({
    where: { usuario },
    update: RESET ? { senhaHash, ativo: true } : {},
    create: { nome, usuario, senhaHash, papel },
  });
  console.log(`Usuário "${usuario}" (${papel}) pronto.${RESET ? ' [senha redefinida por RESET_SENHAS]' : ''}`);
}

async function main() {
  if (RESET) console.warn('AVISO: RESET_SENHAS=true — senhas de gestor/operador voltando ao padrão.');
  await upsertUser('Gestor Padrão', 'gestor', 'troque-esta-senha', 'GESTOR');
  await upsertUser('Operador Padrão', 'operador', 'troque-esta-senha', 'OPERADOR');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
