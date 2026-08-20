const API_URL = 'https://api-qa-fap2026.onrender.com/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
const cartKey = 'lojaqa_cart';
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

if (!token || !user) window.location.replace('login.html');

function api(path, options = {}) {
    return fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
        return data;
    });
}

function configurePanel() {
    document.getElementById('userSummary').textContent = `${user.name || user.email} · ${user.role}`;
    document.getElementById('roleBadge').textContent = user.role.toUpperCase();
    document.getElementById('panelTitle').textContent = user.role === 'admin' ? 'Central da plataforma' : user.role === 'seller' ? 'Painel do lojista' : 'Minha conta';
    const links = [{ id: 'profileSection', label: 'Perfil' }, { id: 'ordersSection', label: user.role === 'user' ? 'Meus pedidos' : 'Pedidos' }];
    if (user.role === 'seller' || user.role === 'admin') links.push({ id: user.role === 'seller' ? 'sellerSection' : 'adminSection', label: user.role === 'seller' ? 'Minha loja' : 'Administração global' });
    document.getElementById('panelNav').innerHTML = links.map(link => `<a href="#${link.id}">${link.label}</a>`).join('');
    document.getElementById('profileMetrics').innerHTML = `<article><span>Nome</span><strong>${escapeHtml(user.name || 'Não informado')}</strong></article><article><span>E-mail</span><strong>${escapeHtml(user.email)}</strong></article><article><span>Perfil</span><strong>${user.role}</strong></article>`;
    if (user.role === 'seller') document.getElementById('sellerSection').classList.remove('hidden');
    if (user.role === 'admin') document.getElementById('adminSection').classList.remove('hidden');
}

async function loadOrders() {
    try {
        const orders = await api('/orders/me');
        document.getElementById('ordersList').innerHTML = orders.length ? orders.map(order => `<article class="data-row"><div><strong>Pedido #${order._id.slice(-6).toUpperCase()}</strong><span>${new Date(order.createdAt).toLocaleDateString('pt-BR')} · ${order.items.length} item(ns)</span></div><strong>${money(order.total)}</strong><span class="status">${order.status}</span></article>`).join('') : '<div class="empty">Você ainda não fez pedidos.</div>';
    } catch (error) { document.getElementById('ordersList').innerHTML = `<div class="empty">${error.message}</div>`; }
}

async function submitCheckout(event) {
    event.preventDefault();
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    if (!cart.length) return showNotice('Seu carrinho está vazio.', true);
    try {
        await api('/orders', { method: 'POST', body: JSON.stringify({ shippingAddress: document.getElementById('shippingAddress').value, items: cart.map(item => ({ productId: item.productId, quantity: item.quantity })) }) });
        localStorage.removeItem(cartKey);
        document.getElementById('checkoutSection').classList.add('hidden');
        showNotice('Pedido criado com sucesso.');
        loadOrders();
    } catch (error) { showNotice(error.message, true); }
}

async function loadSellerData() {
    try {
        const [products, orders] = await Promise.all([api('/seller/products'), api('/seller/orders')]);
        document.getElementById('sellerProducts').innerHTML = products.length ? products.map(product => `<article class="data-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.category)} · ${product.stock} em estoque</span></div><strong>${money(product.price)}</strong><button class="ghost-button" onclick="editProduct('${product._id}')">Editar</button></article>`).join('') : '<div class="empty">Cadastre o primeiro produto da sua loja.</div>';
        document.getElementById('sellerOrders').innerHTML = orders.length ? orders.map(order => `<article class="data-row"><div><strong>#${order._id.slice(-6).toUpperCase()}</strong><span>${order.customerId?.name || order.customerId?.email || 'Cliente'}</span></div><strong>${money(order.total)}</strong><span class="status">${order.status}</span></article>`).join('') : '<div class="empty">Nenhum pedido para sua loja.</div>';
        window.sellerProducts = products;
    } catch (error) { showNotice(error.message, true); }
}

function resetProductForm() { document.getElementById('productForm').reset(); document.getElementById('productId').value = ''; document.getElementById('productForm').classList.add('hidden'); }
function editProduct(id) { const product = window.sellerProducts.find(item => item._id === id); if (!product) return; document.getElementById('productForm').classList.remove('hidden'); document.getElementById('productId').value = product._id; document.getElementById('productName').value = product.name; document.getElementById('productCategory').value = product.category; document.getElementById('productPrice').value = product.price; document.getElementById('productStock').value = product.stock; document.getElementById('productDescription').value = product.description || ''; document.getElementById('productImage').value = product.image || ''; }
async function saveProduct(event) { event.preventDefault(); const id = document.getElementById('productId').value; const body = { name: document.getElementById('productName').value, category: document.getElementById('productCategory').value, price: document.getElementById('productPrice').value, stock: document.getElementById('productStock').value, description: document.getElementById('productDescription').value, image: document.getElementById('productImage').value }; try { await api(id ? `/seller/products/${id}` : '/seller/products', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); resetProductForm(); loadSellerData(); showNotice('Produto salvo com sucesso.'); } catch (error) { showNotice(error.message, true); } }

async function loadAdminData() {
    try { const [users, products] = await Promise.all([api('/users'), api('/seller/products')]); document.getElementById('adminMetrics').innerHTML = `<article><span>Usuários</span><strong>${users.length}</strong></article><article><span>Produtos</span><strong>${products.length}</strong></article><article><span>Lojistas</span><strong>${users.filter(item => item.role === 'seller').length}</strong></article>`; document.getElementById('adminUsers').innerHTML = users.map(item => `<article class="data-row"><div><strong>${escapeHtml(item.name || 'Sem nome')}</strong><span>${escapeHtml(item.email)}</span></div><span class="status">${item.role}</span></article>`).join(''); document.getElementById('adminProducts').innerHTML = products.map(item => `<article class="data-row"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)}</span></div><strong>${money(item.price)}</strong></article>`).join(''); } catch (error) { showNotice(error.message, true); }
}
function showNotice(message, error = false) { const notice = document.getElementById('notice'); notice.textContent = message; notice.className = `notice ${error ? 'error' : 'success'}`; setTimeout(() => notice.className = 'notice', 3000); }

document.getElementById('logoutButton').addEventListener('click', () => { localStorage.clear(); sessionStorage.clear(); window.location.replace('loja.html'); });
document.getElementById('checkoutForm').addEventListener('submit', submitCheckout);
document.getElementById('newProductButton').addEventListener('click', () => document.getElementById('productForm').classList.remove('hidden'));
document.getElementById('cancelProductButton').addEventListener('click', resetProductForm);
document.getElementById('productForm').addEventListener('submit', saveProduct);
configurePanel();
loadOrders();
if (user.role === 'seller') loadSellerData();
if (user.role === 'admin') loadAdminData();
if (window.location.hash === '#checkout') document.getElementById('checkoutSection').classList.remove('hidden');
