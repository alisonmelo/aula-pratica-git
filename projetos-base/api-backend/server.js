require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_fap2026_qa';

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro no MongoDB:', err));

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    name: String
});
const User = mongoose.model('User', UserSchema);

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

// --- MIDDLEWARES ---
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(403).json({ error: "Token não fornecido." });

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: "Token inválido ou expirado." });
        req.user = decoded; 
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Acesso negado." });
    next();
};

// --- ROTAS ---

// 1. LOGIN
app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Usuário e senha são obrigatórios." });

        if (email === 'slow@system.com') await new Promise(r => setTimeout(r, 1800));

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "Erro: usuário não encontrado." });
        if (user.password !== password) return res.status(401).json({ error: "Credenciais inválidas." });

        const token = jwt.sign({ id: user._id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({
            message: "Autenticado com sucesso",
            token,
            user: { email: user.email, name: user.name, role: user.role }
        });
    } catch (error) {
        next(error); 
    }
});

// 2. CADASTRO DE NOVO USUÁRIO (Nova Feature)
app.post('/api/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "A senha deve conter no mínimo 8 caracteres." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "Já existe um usuário cadastrado com este e-mail." });
        }

        const newUser = new User({ name, email, password, role: 'user' });
        await newUser.save();

        res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    } catch (error) {
        next(error);
    }
});

// 3. RECUPERAÇÃO DE SENHA (Nova Feature)
app.post('/api/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "O e-mail é obrigatório." });

        // Regra de Negócio da Atividade: Mensagem genérica independentemente de o usuário existir
        // Não fazemos validação se o e-mail existe na base propositalmente.
        res.status(200).json({ 
            message: "Se o e-mail existir em nossa base, um link de recuperação será enviado." 
        });
    } catch (error) {
        next(error);
    }
});

// 4. LISTAR USUÁRIOS
app.get('/api/users', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const users = await User.find({}, '-password');
        res.status(200).json(users);
    } catch (error) {
        next(error);
    }
});

// --- MIDDLEWARE DE ERRO GLOBAL ---
app.use((err, req, res, next) => {
    console.error('Erro Capturado:', err.message);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));