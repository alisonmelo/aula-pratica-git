const API_URL = 'https://api-qa-fap2026.onrender.com/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
const cartKey = 'lojaqa_cart';
const PAGE_SIZE = 5;
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
const adminState = { users: [], stores: [], products: [], pages: { users: 1, stores: 1, products: 1 } };

if (!token || !user) window.location.replace('login.html');

function api(path, options = {}) {
    return fetch(`${API_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers || {}) } }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `A API respondeu ${response.status}.`);
        return data;
    });
}

function configurePanel() {
    document.getElementById('userSummary').textContent = `${user.name || user.email} · ${user.role}`;
    document.getElementById('roleBadge').textContent = user.role.toUpperCase();
    document.getElementById('panelTitle').textContent = user.role === 'admin' ? 'Central administrativa' : user.role === 'seller' ? 'Painel do lojista' : 'Minha conta';
    const links = [{ id: 'profileSection', label: 'Perfil' }];
    if (user.role === 'user') links.push({ id: 'ordersSection', label: 'Meus pedidos' });
    if (user.role === 'seller') links.push({ id: 'sellerSection', label: 'Minha loja' });
    if (user.role === 'admin') links.push({ id: 'adminSection', label: 'Administração' });
    document.getElementById('panelNav').innerHTML = links.map(link => `<a href="#${link.id}">${link.label}</a>`).join('');
    document.getElementById('profileMetrics').innerHTML = `<article><span>Nome</span><strong>${escapeHtml(user.name || 'Não informado')}</strong></article><article><span>E-mail</span><strong>${escapeHtml(user.email)}</strong></article><article><span>Perfil</span><strong>${user.role}</strong></article>`;
    if (user.role === 'user') document.getElementById('ordersSection').classList.remove('hidden');
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
        window.sellerProducts = products;
        document.getElementById('sellerProducts').innerHTML = products.length ? products.map(product => `<article class="data-row"><div><strong>${escapeHtml(product.name)}</strong><span>${escapeHtml(product.category)} · ${product.stock} em estoque</span></div><strong>${money(product.price)}</strong><button class="ghost-button" onclick="editProduct('${product._id}')">Editar</button></article>`).join('') : '<div class="empty">Cadastre o primeiro produto da sua loja.</div>';
        document.getElementById('sellerOrders').innerHTML = orders.length ? orders.map(order => `<article class="data-row"><div><strong>#${order._id.slice(-6).toUpperCase()}</strong><span>${order.customerId?.name || order.customerId?.email || 'Cliente'}</span></div><strong>${money(order.total)}</strong><span class="status">${order.status}</span></article>`).join('') : '<div class="empty">Nenhum pedido para sua loja.</div>';
    } catch (error) { showNotice(error.message, true); }
}

function resetProductForm() { document.getElementById('productForm').reset(); document.getElementById('productId').value = ''; document.getElementById('productForm').classList.add('hidden'); }
function editProduct(id) { const product = window.sellerProducts.find(item => item._id === id); if (!product) return; document.getElementById('productForm').classList.remove('hidden'); document.getElementById('productId').value = product._id; document.getElementById('productName').value = product.name; document.getElementById('productCategory').value = product.category; document.getElementById('productPrice').value = product.price; document.getElementById('productStock').value = product.stock; document.getElementById('productDescription').value = product.description || ''; document.getElementById('productImage').value = product.image || ''; }
async function saveProduct(event) { event.preventDefault(); const id = document.getElementById('productId').value; const body = { name: document.getElementById('productName').value, category: document.getElementById('productCategory').value, price: document.getElementById('productPrice').value, stock: document.getElementById('productStock').value, description: document.getElementById('productDescription').value, image: document.getElementById('productImage').value }; try { await api(id ? `/seller/products/${id}` : '/seller/products', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); resetProductForm(); loadSellerData(); showNotice('Produto salvo com sucesso.'); } catch (error) { showNotice(error.message, true); } }

function filteredUsers() { const query = document.getElementById('adminUserSearch').value.toLowerCase(); const role = document.getElementById('adminUserRole').value; return adminState.users.filter(item => (!query || `${item.name || ''} ${item.email}`.toLowerCase().includes(query)) && (role === 'all' || item.role === role)); }
function filteredStores() { const query = document.getElementById('storeSearch').value.toLowerCase(); const status = document.getElementById('storeStatus').value; return adminState.stores.filter(item => (!query || `${item.name || ''} ${item.email} ${item.storeName || ''}`.toLowerCase().includes(query)) && (status === 'all' || (status === 'blocked' ? item.role === 'blocked' : item.role === 'seller'))); }
function filteredProducts() { const query = document.getElementById('productSearch').value.toLowerCase(); const category = document.getElementById('productCategoryFilter').value; const stock = document.getElementById('productStockFilter').value; return adminState.products.filter(item => (!query || `${item.name} ${item.category} ${item.sellerId?.storeName || ''}`.toLowerCase().includes(query)) && (category === 'all' || item.category === category) && (stock === 'all' || (stock === 'empty' ? item.stock === 0 : item.stock > 0))); }
function renderPagination(id, total, page, key, render) { const pages = Math.max(1, Math.ceil(total / PAGE_SIZE)); adminState.pages[key] = Math.min(page, pages); document.getElementById(id).innerHTML = pages > 1 ? `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="${render.name}(${page - 1})">Anterior</button><span>Página ${page} de ${pages}</span><button class="pagination-btn" ${page === pages ? 'disabled' : ''} onclick="${render.name}(${page + 1})">Próxima</button>` : ''; }
function renderUsers(page = adminState.pages.users) { const items = filteredUsers(); const start = (page - 1) * PAGE_SIZE; document.getElementById('adminUsers').innerHTML = items.slice(start, start + PAGE_SIZE).map(item => `<article class="data-row admin-row"><div><strong>${escapeHtml(item.name || 'Sem nome')}</strong><span>${escapeHtml(item.email)} · ${item.role}</span></div><select onchange="changeUserRole('${item._id}', this.value)"><option value="user" ${item.role === 'user' ? 'selected' : ''}>Cliente</option><option value="seller" ${item.role === 'seller' ? 'selected' : ''}>Lojista</option><option value="admin" ${item.role === 'admin' ? 'selected' : ''}>Admin</option><option value="blocked" ${item.role === 'blocked' ? 'selected' : ''}>Bloqueado</option></select></article>`).join('') || '<div class="empty">Nenhum usuário encontrado.</div>'; renderPagination('adminUserPagination', items.length, page, 'users', renderUsers); }
function renderStores(page = adminState.pages.stores) { const items = filteredStores(); const start = (page - 1) * PAGE_SIZE; document.getElementById('adminStores').innerHTML = items.slice(start, start + PAGE_SIZE).map(item => `<article class="data-row"><div><strong>${escapeHtml(item.storeName || 'Loja sem nome')}</strong><span>${escapeHtml(item.name || '')} · ${escapeHtml(item.email)}</span></div><span class="status">${item.role === 'blocked' ? 'bloqueada' : 'ativa'}</span></article>`).join('') || '<div class="empty">Nenhuma loja encontrada.</div>'; renderPagination('storePagination', items.length, page, 'stores', renderStores); }
function renderProducts(page = adminState.pages.products) { const items = filteredProducts(); const start = (page - 1) * PAGE_SIZE; document.getElementById('adminProducts').innerHTML = items.slice(start, start + PAGE_SIZE).map(item => `<article class="data-row admin-row"><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)} · ${item.stock} em estoque · ${escapeHtml(item.sellerId?.storeName || 'Loja')}</span></div><strong>${money(item.price)}</strong><button class="ghost-button" onclick="editAdminProduct('${item._id}')">Editar</button></article>`).join('') || '<div class="empty">Nenhum produto encontrado.</div>'; renderPagination('productPagination', items.length, page, 'products', renderProducts); }

async function openAdminModule(module) { const article = document.querySelector(`[data-module="${module}"]`); const content = article.querySelector('.module-content'); const button = article.querySelector('.module-toggle'); const opening = content.classList.contains('hidden'); document.querySelectorAll('.admin-module .module-content').forEach(item => item.classList.add('hidden')); document.querySelectorAll('.module-toggle').forEach(item => { item.setAttribute('aria-expanded', 'false'); item.querySelector('.module-icon').textContent = '+'; }); if (!opening) return; content.classList.remove('hidden'); button.setAttribute('aria-expanded', 'true'); button.querySelector('.module-icon').textContent = '−'; try { if (module === 'users' && !adminState.users.length) { adminState.users = await api('/users'); adminState.stores = adminState.users.filter(item => item.role === 'seller' || item.role === 'blocked'); } if (module === 'stores' && !adminState.users.length) { adminState.users = await api('/users'); adminState.stores = adminState.users.filter(item => item.role === 'seller' || item.role === 'blocked'); } if (module === 'products' && !adminState.products.length) { adminState.products = await api('/seller/products'); const categories = [...new Set(adminState.products.map(item => item.category))].sort(); document.getElementById('productCategoryFilter').innerHTML = '<option value="all">Todas as categorias</option>' + categories.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join(''); } if (module === 'users') renderUsers(); if (module === 'stores') renderStores(); if (module === 'products') renderProducts(); } catch (error) { content.querySelector('.data-list').innerHTML = `<div class="empty">${error.message}</div>`; } }
async function changeUserRole(id, role) { const password = prompt(`Digite a senha atual do administrador para definir o perfil ${role}:`); if (!password) return; try { await api(`/users/${id}`, { method: 'PUT', body: JSON.stringify({ role, adminPassword: password }) }); adminState.users = await api('/users'); adminState.stores = adminState.users.filter(item => item.role === 'seller' || item.role === 'blocked'); renderUsers(); renderStores(); showNotice('Perfil atualizado.'); } catch (error) { showNotice(error.message, true); } }
function editAdminProduct(id) { const product = adminState.products.find(item => item._id === id); if (!product) return showNotice('Produto não carregado.', true); const price = prompt(`Novo preço para ${product.name}:`, product.price); if (price === null) return; const stock = prompt('Novo estoque:', product.stock); if (stock === null) return; api(`/seller/products/${id}`, { method: 'PUT', body: JSON.stringify({ price: Number(price), stock: Number(stock) }) }).then(() => { adminState.products = []; openAdminModule('products'); showNotice('Produto atualizado.'); }).catch(error => showNotice(error.message, true)); }
function showNotice(message, error = false) { const notice = document.getElementById('notice'); notice.textContent = message; notice.className = `notice ${error ? 'error' : 'success'}`; setTimeout(() => notice.className = 'notice', 3000); }

document.getElementById('logoutButton').addEventListener('click', () => { localStorage.clear(); sessionStorage.clear(); window.location.replace('loja.html'); });
document.getElementById('checkoutForm').addEventListener('submit', submitCheckout);
document.getElementById('newProductButton').addEventListener('click', () => document.getElementById('productForm').classList.remove('hidden'));
document.getElementById('cancelProductButton').addEventListener('click', resetProductForm);
document.getElementById('productForm').addEventListener('submit', saveProduct);
document.querySelectorAll('.module-toggle').forEach(button => button.addEventListener('click', () => openAdminModule(button.closest('.admin-module').dataset.module)));
['adminUserSearch', 'adminUserRole'].forEach(id => document.getElementById(id).addEventListener('input', () => renderUsers(1)));
['storeSearch', 'storeStatus'].forEach(id => document.getElementById(id).addEventListener('input', () => renderStores(1)));
['productSearch', 'productCategoryFilter', 'productStockFilter'].forEach(id => document.getElementById(id).addEventListener('input', () => renderProducts(1)));
configurePanel();
if (user.role === 'user') loadOrders();
if (user.role === 'seller') loadSellerData();
if (user.role === 'admin' && window.location.hash === '#admin-users') openAdminModule('users');
if (user.role === 'admin' && window.location.hash === '#admin-stores') openAdminModule('stores');
if (user.role === 'admin' && window.location.hash === '#admin-products') openAdminModule('products');
if (user.role === 'user' && window.location.hash === '#checkout') document.getElementById('checkoutSection').classList.remove('hidden');
