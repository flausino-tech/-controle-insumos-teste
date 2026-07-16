require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const insumosRoutes = require('./routes/insumos');
const movimentacoesRoutes = require('./routes/movimentacoes');
const devRoutes = require('./routes/dev');

const app = express();

// O front-end (servido pelo mesmo processo, ver abaixo) usa handlers inline
// (onclick=...) por design — por isso 'unsafe-inline' em script-src. connect-src
// 'self' permite os fetch() do front para esta própria API (mesma origem).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));

app.get('/api/v1/health', (req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/insumos', insumosRoutes);
app.use('/api/v1/movimentacoes', movimentacoesRoutes);
app.use('/api/v1/dev', devRoutes);

const frontendDir = path.join(__dirname, '..', '..', 'insumos');
const producaoDir = path.join(__dirname, '..', '..', 'producao');
const hubDir = path.join(__dirname, '..', '..', 'hub');

// Menu central e o piloto do Controle de Produção são servidos
// à parte, sob seus próprios caminhos — precisam vir antes do catch-all do
// Zeta Flow abaixo, que senão intercepta qualquer rota não-API.
app.use('/producao', express.static(producaoDir));
app.use('/menu', express.static(hubDir));

app.use(express.static(frontendDir));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Backend rodando em http://localhost:${port}`));
