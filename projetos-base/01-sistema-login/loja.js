const API_URL = 'https://api-qa-fap2026.onrender.com/api';
const cartKey = 'lojaqa_cart';
const state = { products: [], cart: JSON.parse(localStorage.getItem(cartKey) || '[]') };

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

// --- FORMATADORES DE ID PERSONALIZÁVEIS ---
// Você pode alterar o prefixo (ex.: 'PRD-', 'SKU-', 'PROD-') ou a lógica aqui:
const formatProductId = id => {
    if (!id) return 'PRD-00000';
    const num = Math.abs(parseInt(String(id).slice(-6), 16) % 90000) + 10000;
    return `PRD-${num}`;
};

const formatOrderId = id => {
    if (!id) return 'PED-00000';
    const num = Math.abs(parseInt(String(id).slice(-6), 16) % 90000) + 10000;
    return `PED-${num}`;
};

// --- CONTROLE DE SESSÃO NO HEADER DA LOJA ---
function configureStoreUser() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const userNav = document.getElementById('userNav');
    const loginLink = document.getElementById('loginLink');
    const userGreeting = document.getElementById('userGreeting');
    const accountLink = document.getElementById('accountLink');
    const navLogoutBtn = document.getElementById('navLogoutBtn');
    const cartButton = document.getElementById('cartButton');

    if (token && user) {
        if (loginLink) loginLink.style.display = 'none';
        if (userNav) userNav.style.display = 'inline-flex';
        
        const roleLabel = user.role === 'admin' ? 'ADMIN' : user.role === 'seller' ? 'LOJISTA' : 'CLIENTE';
        const roleClass = user.role === 'admin' ? 'admin' : user.role === 'seller' ? 'seller' : 'user';
        
        if (userGreeting) {
            userGreeting.innerHTML = `Olá, <strong>${escapeHtml(user.name ? user.name.split(' ')[0] : 'Usuário')}</strong> <span class="header-role-badge ${roleClass}">${roleLabel}</span>`;
        }
        
        if (accountLink) {
            accountLink.href = 'painel.html';
            accountLink.textContent = user.role === 'admin' ? 'Painel Admin' : user.role === 'seller' ? 'Minha Loja' : 'Meu Painel';
        }
        
        if (cartButton && (user.role === 'seller' || user.role === 'admin')) {
            cartButton.title = `Perfil ${roleLabel}: Acesso apenas para visualização do catálogo`;
        }
        
        if (navLogoutBtn) {
            navLogoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('isAuthenticated');
                window.location.reload();
            });
        }
    } else {
        if (loginLink) loginLink.style.display = 'inline';
        if (userNav) userNav.style.display = 'none';
    }
}

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
    const maxPriceVal = Number(document.getElementById('maxPrice')?.value || 0);
    
    // BUG PEDAGÓGICO QA: Utiliza `<` estrito em vez de `<=` ao filtrar por preço máximo na renderização
    let productsToRender = state.products;
    if (maxPriceVal > 0) {
        productsToRender = productsToRender.filter(p => p.price < maxPriceVal);
    }
    
    document.getElementById('resultsSummary').textContent = `${productsToRender.length} produto(s) encontrado(s)`;
    
    if (!productsToRender.length) {
        grid.innerHTML = '<div class="empty-state">Nenhum produto encontrado para os filtros atuais.</div>';
        return;
    }
    
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isSeller = user && user.role === 'seller';
    const isAdmin = user && user.role === 'admin';
    
    grid.innerHTML = productsToRender.map(product => {
        const visualId = formatProductId(product._id);
        const storeName = product.sellerId?.storeName || product.sellerId?.name || 'Loja Parceira';
        
        let actionButtonHtml = '';
        if (isSeller) {
            actionButtonHtml = `
                <button class="primary-button btn-view-only" type="button" onclick="showToast('Perfil Lojista: permitido apenas visualização. Compras são exclusivas de clientes.')" title="Perfil Lojista: Apenas visualização de catálogo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 5px;"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    Modo Lojista (Visualização)
                </button>
            `;
        } else if (isAdmin) {
            actionButtonHtml = `
                <button class="primary-button btn-view-only" type="button" onclick="showToast('Perfil Administrador: permitido apenas visualização. Compras são exclusivas de clientes.')" title="Perfil Administrador: Apenas visualização de catálogo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 5px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Modo Admin (Visualização)
                </button>
            `;
        } else {
            actionButtonHtml = `
                <button class="primary-button" type="button" onclick="addToCart('${product._id}')" ${product.stock < 1 ? 'disabled' : ''}>
                    ${product.stock ? 'Adicionar ao carrinho' : 'Fora de estoque'}
                </button>
            `;
        }
        
        return `
            <article class="product-card">
                <div class="product-image">
                    ${product.image ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">` : '<span>TECH</span>'}
                    <span class="product-id-badge" title="ID do Produto: ${visualId}">${visualId}</span>
                </div>
                <div class="product-content">
                    <div class="product-meta-header">
                        <span class="product-category">${escapeHtml(product.category)}</span>
                        <span class="product-store-badge" title="Loja: ${escapeHtml(storeName)}"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -1px; margin-right: 3px;"><rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>${escapeHtml(storeName)}</span>
                    </div>
                    <h3>${escapeHtml(product.name)}</h3>
                    <div class="product-full-id">Código: <code>${visualId}</code> <span style="font-size:10px; color:#94a3b8;">(${product._id})</span></div>
                    <p>${escapeHtml(product.description || 'Produto selecionado para seu setup.')}</p>
                    <div class="product-bottom">
                        <strong>${money(product.price)}</strong>
                        <span class="${product.stock > 0 ? 'stock-available' : 'stock-empty'}">${product.stock > 0 ? `${product.stock} em estoque` : 'Esgotado'}</span>
                    </div>
                    ${actionButtonHtml}
                </div>
            </article>
        `;
    }).join('');
}

function persistCart() {
    localStorage.setItem(cartKey, JSON.stringify(state.cart));
    renderCart();
}

function addToCart(productId) {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (user && user.role === 'seller') {
        return showToast('Lojistas possuem acesso apenas para visualização do catálogo e não podem comprar.');
    }
    if (user && user.role === 'admin') {
        return showToast('Administradores possuem acesso apenas para visualização e não podem comprar.');
    }

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
    showToast(`"${product.name}" (${formatProductId(productId)}) adicionado ao carrinho.`);
}

function changeQuantity(productId, amount) {
    const item = state.cart.find(entry => entry.productId === productId);
    if (!item) return;
    item.quantity += amount;
    if (item.quantity <= 0) {
        state.cart = state.cart.filter(entry => entry.productId !== productId);
    } else {
        const product = state.products.find(entry => entry._id === productId);
        if (product && item.quantity > product.stock) item.quantity = product.stock;
    }
    persistCart();
}

function renderCart() {
    const count = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const isSellerOrAdmin = user && (user.role === 'seller' || user.role === 'admin');

    document.getElementById('cartCount').textContent = count;
    document.getElementById('cartTotal').textContent = money(total);
    
    const checkoutBtn = document.getElementById('checkoutButton');
    if (checkoutBtn) {
        if (isSellerOrAdmin) {
            checkoutBtn.disabled = true;
            checkoutBtn.textContent = user.role === 'seller' ? 'Indisponível para Lojistas' : 'Indisponível para Administradores';
            checkoutBtn.title = 'Apenas contas de Clientes podem finalizar pedidos.';
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.textContent = 'Continuar para checkout';
            checkoutBtn.title = '';
        }
    }
    
    document.getElementById('cartItems').innerHTML = state.cart.length ? state.cart.map(item => `
        <div class="cart-item">
            <div>
                <strong>${escapeHtml(item.name)}</strong>
                <div class="cart-item-id">ID: <code>${formatProductId(item.productId)}</code></div>
                <span>${money(item.price)} cada</span>
            </div>
            <div class="quantity">
                <button type="button" onclick="changeQuantity('${item.productId}', -1)">−</button>
                <b>${item.quantity}</b>
                <button type="button" onclick="changeQuantity('${item.productId}', 1)">+</button>
            </div>
        </div>
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
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (user && user.role === 'seller') {
        return showToast('Conta de Lojista: você pode visualizar produtos, mas não realizar compras.');
    }
    if (user && user.role === 'admin') {
        return showToast('Conta de Administrador: você pode visualizar produtos, mas não realizar compras.');
    }
    if (!state.cart.length) return showToast('Adicione pelo menos um produto para continuar.');
    if (!localStorage.getItem('token')) {
        showToast('Faça login para finalizar a compra.');
        setTimeout(() => window.location.href = 'login.html?return=checkout', 700);
        return;
    }
    window.location.href = 'checkout.html';
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

configureStoreUser();
loadCategories();
loadCatalog();
renderCart();
