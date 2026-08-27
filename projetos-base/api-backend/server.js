require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || 'chave_secreta_fap2026_qa';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500/projetos-base/01-sistema-login';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- RATE LIMITING ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // 5 tentativas por IP
    message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 tentativas por IP
    message: { error: "Muitas solicitações de recuperação de senha. Tente novamente em 1 hora." },
    standardHeaders: true,
    legacyHeaders: false,
});

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
    storeName: { type: String, default: '' },
    passwordResetToken: String,
    passwordResetExpires: Date
});
const User = mongoose.model('User', UserSchema);
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 1000 },
    category: { type: String, required: true, maxlength: 60 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    image: { type: String, default: '' },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true }
}, { timestamps: true });
const Product = mongoose.model('Product', ProductSchema);

const OrderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        name: String,
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    }],
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'], default: 'pending' },
    shippingAddress: { type: String, required: true, maxlength: 300 }
}, { timestamps: true });
const Order = mongoose.model('Order', OrderSchema);

const VALID_ROLES = ['user', 'seller', 'admin', 'blocked'];

async function seedDatabase() {
    const defaultUsers = [
        { email: "admin@system.com", password: "AdminPassword123", role: "admin", name: "Administrador" },
        { email: "user@system.com", password: "UserPassword123", role: "user", name: "Usuário Padrão" },
        { email: "blocked@system.com", password: "Blocked123", role: "blocked", name: "Usuário Bloqueado" },
        { email: "slow@system.com", password: "SlowPass123", role: "user", name: "Usuário Lento" },
        { email: "lojista@system.com", password: "SellerPass123", role: "seller", name: "LojaQA Oficial", storeName: "Vitrine Tech" }
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
                        name: userData.name,
                        storeName: userData.storeName || ''
                    }
                }
            );
        }
    }

    const seller = await User.findOne({ email: 'lojista@system.com' });
    if (seller && await Product.countDocuments({ sellerId: seller._id }) === 0) {
        await Product.insertMany([
            { name: 'Teclado Mecânico Aurora', description: 'Switches silenciosos e iluminação discreta.', category: 'Periféricos', price: 289.90, stock: 18, sellerId: seller._id },
            { name: 'Mouse Óptico Atlas', description: 'Sensor preciso para trabalho e jogos.', category: 'Periféricos', price: 119.90, stock: 32, sellerId: seller._id },
            { name: 'Headset Nexo', description: 'Microfone removível e áudio confortável.', category: 'Áudio', price: 199.90, stock: 12, sellerId: seller._id }
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

const isSeller = (req, res, next) => {
    if (!['seller', 'admin'].includes(req.user.role)) return res.status(403).json({ error: "Acesso exclusivo para lojistas." });
    next();
};

const isCustomer = (req, res, next) => {
    if (!['user', 'seller', 'admin'].includes(req.user.role)) return res.status(403).json({ error: "Acesso negado." });
    next();
};

// --- ROTAS ---

app.get('/api/health', (req, res) => {
    res.status(200).json({ service: 'lojaqa-api', version: '2.0', status: 'ok' });
});

// 1. LOGIN
app.post('/api/login', loginLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Usuário e senha são obrigatórios." });
        if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: "E-mail inválido." });
        if (password.length < 8 || password.length > 25) return res.status(400).json({ error: "Senha deve ter entre 8 e 25 caracteres." });

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
        const { name, email, password, role = 'user', storeName = '' } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }

        if (name.length > 50) {
            return res.status(400).json({ error: "O nome não pode ter mais de 50 caracteres." });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: "E-mail inválido." });
        }

        if (!['user', 'seller'].includes(role)) {
            return res.status(400).json({ error: "Perfil de cadastro inválido." });
        }

        if (role === 'seller' && (!storeName.trim() || storeName.trim().length > 80)) {
            return res.status(400).json({ error: "Lojistas precisam informar uma loja de até 80 caracteres." });
        }

        if (password.length < 8 || password.length > 25) {
            return res.status(400).json({ error: "A senha deve conter entre 8 e 25 caracteres." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "Já existe um usuário cadastrado com este e-mail." });
        }

        const newUser = new User({ name, email, password, role, storeName: role === 'seller' ? storeName.trim() : '' });
        await newUser.save();

        res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    } catch (error) {
        next(error);
    }
});

// 3. RECUPERAÇÃO DE SENHA (Nova Feature)
app.post('/api/forgot-password', forgotPasswordLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: "O e-mail é obrigatório." });
        if (!EMAIL_REGEX.test(email)) return res.status(400).json({ error: "E-mail inválido." });

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

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ error: "E-mail inválido." });
        }

        if (password.length < 8 || password.length > 25) {
            return res.status(400).json({ error: "A senha deve conter entre 8 e 25 caracteres." });
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

// 4. CATÁLOGO PÚBLICO
app.get('/api/products', async (req, res, next) => {
    try {
        const { search = '', category = '', sellerId = '', minPrice, maxPrice } = req.query;
        const filter = { active: true };
        if (search.trim()) {
            const s = search.trim();
            const orConditions = [
                { name: { $regex: s, $options: 'i' } },
                { description: { $regex: s, $options: 'i' } },
                { category: { $regex: s, $options: 'i' } }
            ];
            if (mongoose.Types.ObjectId.isValid(s)) {
                orConditions.push({ _id: s });
            }
            filter.$or = orConditions;
        }
        if (category) filter.category = category;
        if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) filter.sellerId = sellerId;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }
        const products = await Product.find(filter).populate('sellerId', 'storeName name');
        res.status(200).json(products);
    } catch (error) {
        next(error);
    }
});

app.get('/api/products/categories', async (req, res, next) => {
    try {
        res.status(200).json(await Product.distinct('category', { active: true }));
    } catch (error) {
        next(error);
    }
});

// 5. CHECKOUT E PEDIDOS DO CLIENTE
app.post('/api/orders', verifyToken, isCustomer, async (req, res, next) => {
    try {
        const { items, shippingAddress } = req.body;
        if (!Array.isArray(items) || !items.length || !shippingAddress?.trim()) {
            return res.status(400).json({ error: "Itens e endereço de entrega são obrigatórios." });
        }

        const productIds = items.map(item => item.productId);
        const products = await Product.find({ _id: { $in: productIds }, active: true });
        const productMap = new Map(products.map(product => [product._id.toString(), product]));
        const orderItems = [];

        for (const item of items) {
            const product = productMap.get(item.productId);
            const quantity = Number(item.quantity);
            if (!product || !Number.isInteger(quantity) || quantity < 1) {
                return res.status(400).json({ error: "Produto ou quantidade inválida." });
            }
            if (product.stock < quantity) {
                return res.status(409).json({ error: `Estoque insuficiente para ${product.name}.` });
            }
            orderItems.push({
                productId: product._id,
                name: product.name,
                quantity,
                unitPrice: product.price,
                sellerId: product.sellerId
            });
        }

        const total = orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const order = await Order.create({
            customerId: req.user.id,
            items: orderItems,
            total,
            shippingAddress: shippingAddress.trim()
        });

        await Promise.all(orderItems.map(item => Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: -item.quantity } }
        )));

        res.status(201).json({ message: "Pedido criado com sucesso.", order });
    } catch (error) {
        next(error);
    }
});

app.get('/api/orders/me', verifyToken, isCustomer, async (req, res, next) => {
    try {
        res.status(200).json(await Order.find({ customerId: req.user.id }).sort({ createdAt: -1 }));
    } catch (error) {
        next(error);
    }
});

// 6. PAINEL DO LOJISTA
app.get('/api/seller/products', verifyToken, isSeller, async (req, res, next) => {
    try {
        const filter = req.user.role === 'admin' ? {} : { sellerId: req.user.id };
        res.status(200).json(await Product.find(filter).sort({ createdAt: -1 }));
    } catch (error) {
        next(error);
    }
});

app.post('/api/seller/products', verifyToken, isSeller, async (req, res, next) => {
    try {
        const { name, description, category, price, stock, image } = req.body;
        const sellerId = req.user.role === 'admin' ? req.body.sellerId : req.user.id;
        if (req.user.role === 'admin' && !sellerId) {
            return res.status(400).json({ error: "O administrador deve informar a loja proprietária do produto." });
        }
        if (!name?.trim() || !category?.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) {
            return res.status(400).json({ error: "Nome, categoria, preço e estoque válidos são obrigatórios." });
        }
        const product = await Product.create({
            name: name.trim(), description: description?.trim() || '', category: category.trim(),
            price: Number(price), stock: Number(stock), image: image?.trim() || '', sellerId
        });
        res.status(201).json({ message: "Produto criado com sucesso.", product });
    } catch (error) {
        next(error);
    }
});

app.put('/api/seller/products/:id', verifyToken, isSeller, async (req, res, next) => {
    try {
        const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, sellerId: req.user.id };
        const allowed = ['name', 'description', 'category', 'price', 'stock', 'image', 'active'];
        const update = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
        if (update.price !== undefined) update.price = Number(update.price);
        if (update.stock !== undefined) update.stock = Number(update.stock);
        const product = await Product.findOneAndUpdate(filter, update, { new: true, runValidators: true });
        if (!product) return res.status(404).json({ error: "Produto não encontrado ou sem permissão." });
        res.status(200).json({ message: "Produto atualizado com sucesso.", product });
    } catch (error) {
        next(error);
    }
});

app.get('/api/seller/orders', verifyToken, isSeller, async (req, res, next) => {
    try {
        const filter = req.user.role === 'admin' ? {} : { 'items.sellerId': req.user.id };
        res.status(200).json(await Order.find(filter).populate('customerId', 'name email').sort({ createdAt: -1 }));
    } catch (error) {
        next(error);
    }
});

app.put('/api/seller/orders/:id/status', verifyToken, isSeller, async (req, res, next) => {
    try {
        const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(req.body.status)) return res.status(400).json({ error: "Status de pedido inválido." });
        const filter = req.user.role === 'admin' ? { _id: req.params.id } : { _id: req.params.id, 'items.sellerId': req.user.id };
        const order = await Order.findOneAndUpdate(filter, { status: req.body.status }, { new: true });
        if (!order) return res.status(404).json({ error: "Pedido não encontrado ou sem permissão." });
        res.status(200).json({ message: "Status atualizado.", order });
    } catch (error) {
        next(error);
    }
});

// 7. LISTAR USUÁRIOS
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
        const { email, role, name, password, adminPassword, storeName } = req.body;
        const update = {};

        if (email !== undefined && email !== '') {
            update.email = email.trim().toLowerCase();
        }

        if (name !== undefined) {
            update.name = name.trim();
        }

        if (storeName !== undefined) {
            update.storeName = storeName.trim();
        }

        if (password) {
            update.password = password;
        }

        if (role !== undefined) {
            if (!VALID_ROLES.includes(role)) {
                return res.status(400).json({ error: "Role inválida. Use user, admin ou blocked." });
            }

            if (role === 'admin' || role === 'seller') {
                const adminUser = await User.findById(req.user.id);
                if (!adminUser || adminUser.password !== (adminPassword || '')) {
                    return res.status(401).json({ error: "Senha do administrador inválida para alterar este perfil." });
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
