const API_URL = 'https://api-qa-fap2026.onrender.com/api';
const cartKey = 'lojaqa_cart';
const state = { products: [], cart: JSON.parse(localStorage.getItem(cartKey) || '[]') };

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

async function loadCatalog() {
    const params = new URLSearchParams();
    const search = document.getElementById('searchInput').value.trim();
    const category = document.getElementById('categoryFilter').value;
    const maxPrice = document.getElementById('maxPrice').value;
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    if (maxPrice) params.set('maxPrice', maxPrice);

    const grid = document.getElementById('productGrid');
    grid.innerHTML = '<div class="loading-state">Carregando vitrine...</div>';
    try {
        const response = await fetch(`${API_URL}/products?${params}`);
        if (response.status === 404) throw new Error('API_DESATUALIZADA');
        if (!response.ok) throw new Error('Falha ao carregar produtos');
        state.products = await response.json();
        renderProducts();
    } catch (error) {
        grid.innerHTML = error.message === 'API_DESATUALIZADA'
            ? '<div class="empty-state"><strong>Catálogo aguardando publicação da API nova.</strong><br>Faça o redeploy do backend no Render usando o branch com a LojaQA.</div>'
            : '<div class="empty-state">A vitrine está temporariamente indisponível.</div>';
    }
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/products/categories`);
        const categories = await response.json();
        document.getElementById('categoryFilter').insertAdjacentHTML('beforeend', categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(''));
    } catch (error) {
        // A vitrine continua utilizável mesmo sem categorias.
    }
}

function renderProducts() {
    const grid = document.getElementById('productGrid');
    document.getElementById('resultsSummary').textContent = `${state.products.length} produto(s)`;
    if (!state.products.length) {
        grid.innerHTML = '<div class="empty-state">Nenhum produto encontrado para os filtros atuais.</div>';
        return;
    }
    grid.innerHTML = state.products.map(product => `
        <article class="product-card">
            <div class="product-image">${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<span>TECH</span>'}</div>
            <div class="product-content">
                <span class="product-category">${escapeHtml(product.category)}</span>
                <h3>${escapeHtml(product.name)}</h3>
                <p>${escapeHtml(product.description || 'Produto selecionado para seu setup.')}</p>
                <div class="product-bottom"><strong>${money(product.price)}</strong><span>${product.stock} em estoque</span></div>
                <button class="primary-button" type="button" onclick="addToCart('${product._id}')" ${product.stock < 1 ? 'disabled' : ''}>${product.stock ? 'Adicionar ao carrinho' : 'Fora de estoque'}</button>
            </div>
        </article>
    `).join('');
}

function persistCart() {
    localStorage.setItem(cartKey, JSON.stringify(state.cart));
    renderCart();
}

function addToCart(productId) {
    const product = state.products.find(item => item._id === productId);
    if (!product) return;
    const item = state.cart.find(entry => entry.productId === productId);
    if (item) {
        if (item.quantity >= product.stock) return showToast('Quantidade maior que o estoque disponível.');
        item.quantity += 1;
    } else {
        state.cart.push({ productId, name: product.name, price: product.price, stock: product.stock, quantity: 1 });
    }
    persistCart();
    showToast('Produto adicionado ao carrinho.');
}

function changeQuantity(productId, amount) {
    const item = state.cart.find(entry => entry.productId === productId);
    if (!item) return;
    item.quantity += amount;
    if (item.quantity <= 0) state.cart = state.cart.filter(entry => entry.productId !== productId);
    if (item.quantity > item.stock) item.quantity = item.stock;
    persistCart();
}

function renderCart() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotal').textContent = money(total);
    document.getElementById('cartItems').innerHTML = state.cart.length ? state.cart.map(item => `
        <div class="cart-item"><div><strong>${escapeHtml(item.name)}</strong><span>${money(item.price)} cada</span></div><div class="quantity"><button type="button" onclick="changeQuantity('${item.productId}', -1)">−</button><b>${item.quantity}</b><button type="button" onclick="changeQuantity('${item.productId}', 1)">+</button></div></div>
    `).join('') : '<div class="empty-state">Seu carrinho está vazio.</div>';
}

function openCart() {
    document.getElementById('cartDrawer').classList.add('is-open');
    document.getElementById('drawerBackdrop').classList.add('is-visible');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'false');
}

function closeCart() {
    document.getElementById('cartDrawer').classList.remove('is-open');
    document.getElementById('drawerBackdrop').classList.remove('is-visible');
    document.getElementById('cartDrawer').setAttribute('aria-hidden', 'true');
}

function checkout() {
    if (!state.cart.length) return showToast('Adicione pelo menos um produto para continuar.');
    if (!localStorage.getItem('token')) {
        showToast('Faça login para finalizar a compra.');
        setTimeout(() => window.location.href = 'login.html?return=checkout', 700);
        return;
    }
    window.location.href = 'painel.html#checkout';
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

document.getElementById('searchInput').addEventListener('input', loadCatalog);
document.getElementById('categoryFilter').addEventListener('change', loadCatalog);
document.getElementById('maxPrice').addEventListener('input', loadCatalog);
document.getElementById('cartButton').addEventListener('click', openCart);
document.getElementById('closeCart').addEventListener('click', closeCart);
document.getElementById('drawerBackdrop').addEventListener('click', closeCart);
document.getElementById('checkoutButton').addEventListener('click', checkout);
if (localStorage.getItem('token')) document.getElementById('accountLink').textContent = 'Meu painel';
loadCategories();
loadCatalog();
renderCart();
