const bcrypt = require('bcryptjs');
const prisma = require('./client');

async function upsertUser(nome, usuario, senha, papel) {
  const senhaHash = await bcrypt.hash(senha, 10);
  await prisma.user.upsert({
    where: { usuario },
    update: {},
    create: { nome, usuario, senhaHash, papel },
  });
  console.log(`Usuário "${usuario}" (${papel}) pronto.`);
}

async function main() {
  await upsertUser('Gestor Padrão', 'gestor', 'troque-esta-senha', 'GESTOR');
  await upsertUser('Operador Padrão', 'operador', 'troque-esta-senha', 'OPERADOR');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
