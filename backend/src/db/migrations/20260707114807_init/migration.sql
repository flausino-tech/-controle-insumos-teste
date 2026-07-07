-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('GESTOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('ENTRADA', 'SAIDA', 'AJUSTE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insumos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "estoque_minimo" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "saldo_atual" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "fornecedor" TEXT NOT NULL DEFAULT '',
    "observacoes" TEXT NOT NULL DEFAULT '',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insumos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "insumo_id" TEXT NOT NULL,
    "quantidade" DECIMAL(65,30) NOT NULL,
    "saldo_anterior" DECIMAL(65,30) NOT NULL,
    "saldo_resultante" DECIMAL(65,30) NOT NULL,
    "data_hora" TIMESTAMP(3) NOT NULL,
    "documento" TEXT NOT NULL DEFAULT '',
    "parceiro" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "usuario_id" TEXT NOT NULL,
    "nf" TEXT NOT NULL DEFAULT '',
    "lote" TEXT NOT NULL DEFAULT '',
    "finalidade" TEXT NOT NULL DEFAULT '',
    "motivo_ajuste" TEXT NOT NULL DEFAULT '',
    "modo_ajuste" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_usuario_key" ON "users"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "insumos_codigo_key" ON "insumos"("codigo");

-- CreateIndex
CREATE INDEX "movimentacoes_insumo_id_idx" ON "movimentacoes"("insumo_id");

-- CreateIndex
CREATE INDEX "movimentacoes_data_hora_idx" ON "movimentacoes"("data_hora");

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
