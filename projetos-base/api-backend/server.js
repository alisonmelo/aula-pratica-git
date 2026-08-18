require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_fap2026_qa';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500/projetos-base/01-sistema-login';

function createEmailTransport() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
}

const transporter = createEmailTransport();

async function sendPasswordRecoveryEmail(email, resetLink) {
    if (!transporter) {
        console.log(`Recuperação de senha para ${email}: ${resetLink}`);
        return;
    }

    await transporter.sendMail({
        from: process.env.SMTP_FROM || 'no-reply@example.com',
        to: email,
        subject: 'Redefinição de senha',
        html: `
            <p>Olá,</p>
            <p>Recebemos uma solicitação para redefinir sua senha. Clique no link abaixo para criar uma nova senha:</p>
            <p><a href="${resetLink}">${resetLink}</a></p>
            <p>Se você não solicitou esta alteração, ignore esta mensagem.</p>
        `
    });
}

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Conectado ao MongoDB!'))
    .catch(err => console.error('❌ Erro no MongoDB:', err));

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'user' },
    name: String,
    passwordResetToken: String,
    passwordResetExpires: Date
});
const User = mongoose.model('User', UserSchema);
const VALID_ROLES = ['user', 'admin', 'blocked'];

async function seedDatabase() {
    const defaultUsers = [
        { email: "admin@system.com", password: "AdminPassword123", role: "admin", name: "Administrador" },
        { email: "user@system.com", password: "UserPassword123", role: "user", name: "Usuário Padrão" },
        { email: "blocked@system.com", password: "Blocked123", role: "blocked", name: "Usuário Bloqueado" },
        { email: "slow@system.com", password: "SlowPass123", role: "user", name: "Usuário Lento" }
    ];

    for (const userData of defaultUsers) {
        const existing = await User.findOne({ email: userData.email });

        if (!existing) {
            await User.create({
                email: userData.email,
                password: userData.password,
                role: userData.role,
                name: userData.name
            });
        } else {
            await User.updateOne(
                { _id: existing._id },
                {
                    $set: {
                        password: userData.password,
                        role: userData.role,
                        name: userData.name
                    }
                }
            );
        }
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
        if (user.role === 'blocked') return res.status(403).json({ error: "Usuário bloqueado." });

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

        const user = await User.findOne({ email: email.trim().toLowerCase() });
        if (user) {
            const token = crypto.randomBytes(20).toString('hex');
            const expires = Date.now() + 3600000; // 1 hora

            user.passwordResetToken = token;
            user.passwordResetExpires = new Date(expires);
            await user.save();

            const resetLink = `${FRONTEND_URL}/reset-password.html?token=${token}&email=${encodeURIComponent(user.email)}`;
            await sendPasswordRecoveryEmail(user.email, resetLink);
        }

        res.status(200).json({
            message: "Se o e-mail existir em nossa base, um link de recuperação será enviado." 
        });
    } catch (error) {
        next(error);
    }
});

app.post('/api/reset-password', async (req, res, next) => {
    try {
        const { email, token, password } = req.body;
        if (!email || !token || !password) {
            return res.status(400).json({ error: "E-mail, token e nova senha são obrigatórios." });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: "A senha deve conter no mínimo 8 caracteres." });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase(), passwordResetToken: token });
        if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
            return res.status(400).json({ error: "Token inválido ou expirado." });
        }

        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Senha redefinida com sucesso." });
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

// 5. ATUALIZAR USUÁRIO (e-mail, nome, senha, role)
app.put('/api/users/:id', verifyToken, isAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { email, role, name, password, adminPassword } = req.body;
        const update = {};

        if (email !== undefined && email !== '') {
            update.email = email.trim().toLowerCase();
        }

        if (name !== undefined) {
            update.name = name.trim();
        }

        if (password) {
            update.password = password;
        }

        if (role !== undefined) {
            if (!VALID_ROLES.includes(role)) {
                return res.status(400).json({ error: "Role inválida. Use user, admin ou blocked." });
            }

            if (role === 'admin') {
                const adminUser = await User.findById(req.user.id);
                if (!adminUser || adminUser.password !== (adminPassword || '')) {
                    return res.status(401).json({ error: "Senha do administrador inválida para promover alguém a admin." });
                }
            }

            update.role = role;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ error: "Nenhuma alteração enviada." });
        }

        if (update.email) {
            const existingUser = await User.findOne({ email: update.email });
            if (existingUser && existingUser._id.toString() !== id) {
                return res.status(409).json({ error: "Já existe um usuário cadastrado com este e-mail." });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true });

        if (!updatedUser) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        res.status(200).json({
            message: "Usuário atualizado com sucesso.",
            user: { id: updatedUser._id, email: updatedUser.email, role: updatedUser.role, name: updatedUser.name }
        });
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