require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

// Chave secreta para o JWT (em produção, isso fica no .env)
const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_fap2026_qa';

// Conexão Mongo
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro no MongoDB:', err));

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: String,
    name: String
});
const User = mongoose.model('User', UserSchema);

// Popular banco (Setup inicial)
async function seedDatabase() {
    const count = await User.countDocuments();
    if (count === 0) {
        await User.insertMany([
            { email: "admin@system.com", password: "AdminPassword123", role: "admin", name: "Administrador" },
            { email: "user@system.com", password: "UserPassword123", role: "user", name: "Usuário Padrão" },
            { email: "blocked@system.com", password: "Blocked123", role: "user", name: "Usuário Bloqueado" },
            { email: "slow@system.com", password: "SlowPass123", role: "user", name: "Usuário Lento" }
        ]);
    }
}
seedDatabase();

// ---------------------------------------------------------
// MIDDLEWARES
// ---------------------------------------------------------

// Middleware de Autenticação JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: "Token não fornecido." });

    jwt.verify(token.split(" ")[1], JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido ou expirado." });
        req.user = decoded; // Salva os dados do usuário na requisição
        next();
    });
};

// Middleware para verificar se é Admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
    }
    next();
};

// ---------------------------------------------------------
// ROTAS
// ---------------------------------------------------------

// Rota 1: Autenticação (Gera o Token)
app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Usuário e senha são obrigatórios." });

        if (email === 'slow@system.com') await new Promise(r => setTimeout(r, 1800));

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Usuário não encontrado." });
        if (user.password !== password) return res.status(401).json({ error: "Credenciais inválidas." });

        // Gera o Token JWT válido por 1 hora
        const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: "Autenticado com sucesso",
            token,
            user: { email: user.email, name: user.name, role: user.role }
        });
    } catch (error) {
        next(error); // Joga para o middleware de erro
    }
});

// Rota 2: Listar Usuários (Nova Funcionalidade - Protegida JWT + Admin)
app.get('/api/users', verifyToken, isAdmin, async (req, res, next) => {
    try {
        // Retorna todos os usuários, mas sem as senhas por segurança
        const users = await User.find({}, '-password');
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
});

// ---------------------------------------------------------
// MIDDLEWARE DE ERRO GLOBAL
// ---------------------------------------------------------
app.use((err, req, res, next) => {
    console.error('Erro Capturado:', err.message);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));