const API_URL = 'https://api-qa-fap2026.onrender.com/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
const cartKey = 'lojaqa_cart';
const PAGE_SIZE = 5;

const TEST_USERS = ['admin@system.com', 'user@system.com', 'blocked@system.com', 'slow@system.com'];

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

// --- FORMATADORES DE ID PERSONALIZÁVEIS ---
// Você pode alterar os prefixos ('PRD-', 'PED-') ou a lógica dos IDs aqui:
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

const adminState = { 
    users: [], 
    stores: [], 
    products: [], 
    pages: { users: 1, stores: 1, products: 1 },
    currentTab: 'users'
};

if (!token || !user) {
    window.location.replace('login.html');
}

function api(path, options = {}) {
    return fetch(`${API_URL}${path}`, { 
        ...options, 
        headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${token}`, 
            ...(options.headers || {}) 
        } 
    }).then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `A API respondeu com erro ${response.status}.`);
        return data;
    });
}

function showNotice(message, error = false) {
    const notice = document.getElementById('notice');
    if (!notice) return;
    notice.textContent = message;
    notice.className = `notice ${error ? 'error' : 'success'}`;
    setTimeout(() => { notice.className = 'notice'; }, 4000);
}

function toggleCard(card) {
    if (card) card.classList.toggle('is-open');
}

// --- CONFIGURAÇÃO INICIAL DO PAINEL ---
function configurePanel() {
    document.getElementById('userSummary').textContent = `${user.name || user.email} · ${user.role.toUpperCase()}`;
    document.getElementById('roleBadge').textContent = user.role.toUpperCase();
    document.getElementById('panelTitle').textContent = user.role === 'admin' ? 'Painel Administrativo' : user.role === 'seller' ? 'Painel do Lojista' : 'Minha Conta';
    
    const links = [{ id: 'profileSection', label: 'Meu Perfil' }];
    if (user.role === 'user') links.push({ id: 'ordersSection', label: 'Meus Pedidos' });
    if (user.role === 'seller') links.push({ id: 'sellerSection', label: 'Minha Loja' });
    if (user.role === 'admin') links.push({ id: 'adminSection', label: 'Administração' });
    
    document.getElementById('panelNav').innerHTML = links.map(link => `<a href="#${link.id}">${link.label}</a>`).join('');
    
    document.getElementById('profileMetrics').innerHTML = `
        <article>
            <span>Nome Completo</span>
            <strong>${escapeHtml(user.name || 'Não informado')}</strong>
        </article>
        <article>
            <span>E-mail</span>
            <strong>${escapeHtml(user.email)}</strong>
        </article>
        <article>
            <span>Perfil de Acesso</span>
            <strong>${user.role.toUpperCase()}</strong>
        </article>
    `;
    
    if (user.role === 'user') document.getElementById('ordersSection').classList.remove('hidden');
    if (user.role === 'seller') document.getElementById('sellerSection').classList.remove('hidden');
    if (user.role === 'admin') {
        document.getElementById('adminSection').classList.remove('hidden');
        loadAdminData();
    }
}

// --- ESTADO E CONFIGURAÇÕES DO CHECKOUT & SIMULAÇÃO QA ---
const checkoutState = {
    freightOptions: [],
    selectedFreight: null,
    discount: 0,
    discountType: null,
    discountLabel: '',
    couponCode: '',
    paymentMethod: 'credit',
    installments: 1
};

const AVAILABLE_COUPONS = {
    'QA10': { type: 'percent', value: 10, label: 'Cupom QA10 (10% OFF)' },
    'QA20': { type: 'percent', value: 20, label: 'Cupom QA20 (20% OFF)' },
    'FRETEGRATIS': { type: 'freight', value: 100, label: 'Cupom Frete Grátis' },
    'ALUNOQA': { type: 'fixed', value: 30.00, label: 'Cupom Aluno QA (R$ 30 OFF)' }
};

// Algoritmo Real de Validação de CPF (Módulo 11) - Excelente para testes de QA
function validateCPF(cpf) {
    cpf = String(cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i), 10) * (10 - i);
    let rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.charAt(9), 10)) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i), 10) * (11 - i);
    rest = (sum * 10) % 11;
    if (rest === 10 || rest === 11) rest = 0;
    if (rest !== parseInt(cpf.charAt(10), 10)) return false;
    
    return true;
}

// Identificador de Bandeira de Cartão
function detectCardBrand(num) {
    const clean = String(num || '').replace(/\D/g, '');
    if (/^4/.test(clean)) return { name: 'Visa', icon: '💳 Visa' };
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: 'Mastercard', icon: '💳 Mastercard' };
    if (/^(401178|401179|438935|457631|457632|504175|627780|636297|636368)/.test(clean)) return { name: 'Elo', icon: '💳 Elo' };
    if (/^3[47]/.test(clean)) return { name: 'Amex', icon: '💳 Amex' };
    if (/^(606282|3841)/.test(clean)) return { name: 'Hipercard', icon: '💳 Hipercard' };
    return { name: 'Desconhecido', icon: '💳' };
}

// Persistência local de metadados ricos dos pedidos (para visualização completa)
function getOrdersMeta() {
    try {
        return JSON.parse(localStorage.getItem('lojaqa_orders_meta_' + (user?.email || 'default')) || '{}');
    } catch {
        return {};
    }
}

function saveOrderMeta(orderId, meta) {
    const metas = getOrdersMeta();
    metas[orderId] = meta;
    localStorage.setItem('lojaqa_orders_meta_' + (user?.email || 'default'), JSON.stringify(metas));
}

// Calcula data estimada com base em dias úteis a partir de hoje
function getSimulatedDeliveryDate(baseDate, minDays, maxDays) {
    const dateMin = new Date(baseDate || Date.now());
    const dateMax = new Date(baseDate || Date.now());
    dateMin.setDate(dateMin.getDate() + minDays);
    dateMax.setDate(dateMax.getDate() + (maxDays || minDays + 3));
    
    const options = { day: '2-digit', month: '2-digit' };
    return `${dateMin.toLocaleDateString('pt-BR', options)} e ${dateMax.toLocaleDateString('pt-BR', options)}`;
}

// --- PEDIDOS DO CLIENTE & VISUALIZAÇÃO DETALHADA ---
async function loadOrders() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    try {
        const orders = await api('/orders/me');
        window.clientOrders = orders;
        const metas = getOrdersMeta();

        list.innerHTML = orders.length 
            ? orders.map(order => {
                const meta = metas[order._id] || {};
                const orderVisualId = formatOrderId(order._id);
                const itemsCount = meta.items ? meta.items.length : (order.items ? order.items.length : 1);
                const paymentInfo = meta.paymentMethodName || 'Cartão / PIX';
                const forecast = meta.deliveryForecast ? ` · 🚚 Previsão: ${meta.deliveryForecast}` : '';

                return `
                    <article class="data-row" style="cursor: pointer;" onclick="openOrderModal('${order._id}')">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <strong style="font-size: 16px; color: var(--ink);">${orderVisualId}</strong>
                                <span class="badge id">${order._id}</span>
                            </div>
                            <span>${new Date(order.createdAt).toLocaleDateString('pt-BR')} às ${new Date(order.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})} · ${itemsCount} item(ns) · ${paymentInfo}${forecast}</span>
                        </div>
                        <strong style="font-size: 17px; font-family: 'Space Grotesk', sans-serif;">${money(order.total)}</strong>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="status">${(order.status || 'aprovado').toUpperCase()}</span>
                            <button class="ghost-button" type="button" onclick="event.stopPropagation(); openOrderModal('${order._id}')">
                                👁️ Detalhes
                            </button>
                        </div>
                    </article>
                `;
            }).join('') 
            : '<div class="empty">Você ainda não realizou nenhum pedido. Visite a vitrine e comece a comprar!</div>';
    } catch (error) { 
        list.innerHTML = `<div class="empty">${error.message}</div>`; 
    }
}

// --- MODAL DE DETALHES DO PEDIDO ---
function openOrderModal(orderId) {
    const order = (window.clientOrders || []).find(o => o._id === orderId);
    if (!order) {
        return showNotice('Pedido não encontrado na lista atual.', true);
    }
    
    const metas = getOrdersMeta();
    const meta = metas[orderId] || {};
    
    document.getElementById('modalOrderVisualId').textContent = `Pedido ${formatOrderId(order._id)}`;
    document.getElementById('modalOrderRawId').textContent = order._id;
    document.getElementById('modalOrderDate').textContent = `${new Date(order.createdAt).toLocaleDateString('pt-BR')} às ${new Date(order.createdAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
    
    const statusText = (order.status || 'aprovado').toUpperCase();
    document.getElementById('modalOrderStatusBadge').textContent = statusText;
    
    // Atualiza Stepper de Rastreio com base no status
    const stepper = document.getElementById('modalTrackingStepper');
    if (stepper) {
        const isDelivered = statusText === 'ENTREGUE';
        const isShipped = statusText === 'ENVIADO' || isDelivered;
        stepper.innerHTML = `
            <div class="step is-done"><span class="dot"></span><span>1. Pedido Criado</span></div>
            <div class="step is-done"><span class="dot"></span><span>2. Pagamento Aprovado</span></div>
            <div class="step ${isShipped ? 'is-done' : 'is-active'}"><span class="dot"></span><span>3. Em Preparação</span></div>
            <div class="step ${isDelivered ? 'is-done' : isShipped ? 'is-active' : ''}"><span class="dot"></span><span>4. A Caminho</span></div>
            <div class="step ${isDelivered ? 'is-done is-active' : ''}"><span class="dot"></span><span>5. Entregue</span></div>
        `;
    }
    
    // Previsão de Entrega
    const deliveryForecast = meta.deliveryForecast || getSimulatedDeliveryDate(order.createdAt, 5, 8);
    document.getElementById('modalOrderDelivery').textContent = deliveryForecast;
    document.getElementById('modalOrderShippingType').textContent = `Modalidade: ${meta.shippingName || 'Correios PAC (Econômico)'}`;
    
    // Forma de Pagamento
    document.getElementById('modalOrderPayment').textContent = meta.paymentMethodName || 'Cartão de Crédito';
    document.getElementById('modalOrderPaymentDetail').textContent = meta.paymentDetail || '1x sem juros (Aprovado)';
    
    // Endereço
    document.getElementById('modalOrderAddress').textContent = meta.fullAddress || order.shippingAddress || 'Endereço registrado no momento da compra';
    
    // Itens Comprados
    const items = meta.items || order.items || [];
    const itemsContainer = document.getElementById('modalOrderItemsList');
    itemsContainer.innerHTML = items.length ? items.map(item => {
        const prdId = item.productId?._id || item.productId || 'PRD-00000';
        const name = item.name || item.productId?.name || 'Produto Tech Selecionado';
        const img = item.image || item.productId?.image || '';
        const price = item.price || item.productId?.price || (order.total / (items.length || 1));
        const qty = item.quantity || 1;
        const totalItem = price * qty;
        
        return `
            <div class="order-item-modal-row">
                <div class="order-item-left">
                    <div class="thumb">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}">` : '<span>TECH</span>'}</div>
                    <div>
                        <strong>${escapeHtml(name)}</strong>
                        <span>Código: <code>${formatProductId(prdId)}</code> · Qtd: ${qty} unid.</span>
                    </div>
                </div>
                <div class="order-item-right">
                    <strong>${money(totalItem)}</strong>
                    <span>${money(price)} cada</span>
                </div>
            </div>
        `;
    }).join('') : '<div class="empty">Nenhum item detalhado disponível para este pedido.</div>';
    
    // Totais Discriminados
    const subtotal = meta.subtotal !== undefined ? meta.subtotal : order.total;
    const freight = meta.freight !== undefined ? meta.freight : 0;
    const discount = meta.discount !== undefined ? meta.discount : 0;
    
    document.getElementById('modalOrderSubtotal').textContent = money(subtotal);
    document.getElementById('modalOrderFreight').textContent = freight === 0 ? 'Grátis (R$ 0,00)' : money(freight);
    
    const discRow = document.getElementById('modalOrderDiscountRow');
    if (discount > 0) {
        discRow.style.display = 'flex';
        document.getElementById('modalOrderDiscount').textContent = `- ${money(discount)} (${meta.couponCode || 'Desconto'})`;
    } else {
        discRow.style.display = 'none';
    }
    
    document.getElementById('modalOrderTotal').textContent = money(order.total);
    
    document.getElementById('orderDetailModal').classList.remove('hidden');
}

function closeOrderModal() {
    const modal = document.getElementById('orderDetailModal');
    if (modal) modal.classList.add('hidden');
}

function printOrderReceipt() {
    window.print();
}

function copyPixCode() {
    const input = document.getElementById('pixCopyCode');
    if (input) {
        navigator.clipboard?.writeText(input.value);
        showNotice('Código PIX copiado para a área de transferência!');
    }
}

function copyBoletoCode() {
    const input = document.getElementById('boletoCode');
    if (input) {
        navigator.clipboard?.writeText(input.value);
        showNotice('Código de barras do boleto copiado!');
    }
}

// --- FLUXO DO NOVO CHECKOUT REALISTA ---
function toggleCheckoutCard(cardBodyId) {
    const body = document.getElementById(cardBodyId);
    if (!body) return;
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? 'block' : 'none';
}

function cancelCheckout() {
    document.getElementById('checkoutSection').classList.add('hidden');
    window.location.href = 'loja.html';
}

function initCheckout() {
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    if (!cart.length) {
        showNotice('Seu carrinho está vazio. Adicione produtos na vitrine primeiro.', true);
        setTimeout(() => window.location.href = 'loja.html', 1200);
        return;
    }
    
    // Preenche dados do comprador se disponíveis
    const nameInput = document.getElementById('checkoutName');
    const emailInput = document.getElementById('checkoutEmail');
    if (nameInput && !nameInput.value) nameInput.value = user.name || '';
    if (emailInput && !emailInput.value) emailInput.value = user.email || '';
    
    // Configura máscaras de input
    setupCheckoutMasks();
    
    // Renderiza itens do carrinho
    renderCheckoutCart();
    
    // Calcula fretes iniciais padrão
    calculateFreightOptions('SP');
}

function setupCheckoutMasks() {
    const cpfInput = document.getElementById('checkoutCpf');
    const cepInput = document.getElementById('checkoutCep');
    const phoneInput = document.getElementById('checkoutPhone');
    const cardNum = document.getElementById('cardNum');
    const cardExpiry = document.getElementById('cardExpiry');
    const cardCvv = document.getElementById('cardCvv');
    
    if (cpfInput && !cpfInput.dataset.masked) {
        cpfInput.dataset.masked = 'true';
        cpfInput.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, '$1.$2')
                 .replace(/(\d{3})(\d)/, '$1.$2')
                 .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = v;
            
            // Feedback de validação instantânea para QA
            const badge = document.getElementById('cpfValidationBadge');
            const help = document.getElementById('cpfHelpText');
            const cleanCpf = e.target.value.replace(/\D/g, '');
            if (cleanCpf.length === 11) {
                const isValid = validateCPF(cleanCpf);
                if (isValid) {
                    badge.className = 'validation-badge valid';
                    badge.textContent = '✅ Válido';
                    help.textContent = 'CPF válido pelo cálculo oficial de dígitos verificadores.';
                } else {
                    badge.className = 'validation-badge invalid';
                    badge.textContent = '❌ Inválido';
                    help.textContent = 'Dígitos verificadores do CPF inválidos (cenário de teste QA).';
                }
            } else {
                badge.className = 'validation-badge';
                badge.textContent = '';
                help.textContent = 'Digite os 11 dígitos do CPF para validar.';
            }
        });
    }
    
    if (cepInput && !cepInput.dataset.masked) {
        cepInput.dataset.masked = 'true';
        cepInput.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            v = v.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = v;
            if (v.replace(/\D/g, '').length === 8) {
                searchCep();
            }
        });
    }
    
    if (phoneInput && !phoneInput.dataset.masked) {
        phoneInput.dataset.masked = 'true';
        phoneInput.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            if (v.length > 10) {
                v = v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            } else if (v.length > 5) {
                v = v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
            } else if (v.length > 2) {
                v = v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
            }
            e.target.value = v;
        });
    }
    
    if (cardNum && !cardNum.dataset.masked) {
        cardNum.dataset.masked = 'true';
        cardNum.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 16) v = v.slice(0, 16);
            v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
            e.target.value = v;
            
            // Detecta bandeira
            const brand = detectCardBrand(v);
            const brandBadge = document.getElementById('cardBrandBadge');
            if (brandBadge) brandBadge.textContent = brand.icon;
        });
    }
    
    if (cardExpiry && !cardExpiry.dataset.masked) {
        cardExpiry.dataset.masked = 'true';
        cardExpiry.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 4) v = v.slice(0, 4);
            if (v.length >= 2) v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
            e.target.value = v;
        });
    }
    
    if (cardCvv && !cardCvv.dataset.masked) {
        cardCvv.dataset.masked = 'true';
        cardCvv.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }
}

function renderCheckoutCart() {
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const container = document.getElementById('checkoutCartList');
    const countBadge = document.getElementById('checkoutItemsCount');
    if (countBadge) countBadge.textContent = cart.reduce((sum, i) => sum + i.quantity, 0);
    
    if (!container) return;
    
    if (!cart.length) {
        container.innerHTML = '<div class="empty">Seu carrinho está vazio.</div>';
        return;
    }
    
    container.innerHTML = cart.map(item => `
        <div class="checkout-item-row">
            <div class="checkout-item-info">
                <strong>${escapeHtml(item.name)}</strong>
                <span>ID: <code>${formatProductId(item.productId)}</code> · Preço: ${money(item.price)} cada</span>
            </div>
            <div class="checkout-item-qty">
                <button type="button" onclick="changeCheckoutQty('${item.productId}', -1)">−</button>
                <b>${item.quantity}</b>
                <button type="button" onclick="changeCheckoutQty('${item.productId}', 1)">+</button>
                <strong style="margin-left: 12px; font-family: 'Space Grotesk', sans-serif;">${money(item.price * item.quantity)}</strong>
            </div>
        </div>
    `).join('');
    
    updateCheckoutSummary();
}

function changeCheckoutQty(productId, amount) {
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const item = cart.find(entry => entry.productId === productId);
    if (!item) return;
    
    item.quantity += amount;
    if (item.quantity <= 0) {
        const filtered = cart.filter(entry => entry.productId !== productId);
        localStorage.setItem(cartKey, JSON.stringify(filtered));
    } else {
        if (item.stock && item.quantity > item.stock) item.quantity = item.stock;
        localStorage.setItem(cartKey, JSON.stringify(cart));
    }
    
    renderCheckoutCart();
    calculateFreightOptions(document.getElementById('checkoutState')?.value || 'SP');
}

// --- CONSULTA VIACEP OFICIAL COM TRATAMENTO QA ---
async function searchCep() {
    const cepInput = document.getElementById('checkoutCep');
    const feedback = document.getElementById('cepFeedback');
    if (!cepInput || !feedback) return;
    
    const cleanCep = cepInput.value.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
        feedback.innerHTML = '<span class="text-danger">⚠️ Digite um CEP com 8 números para consultar.</span>';
        return;
    }
    
    feedback.innerHTML = '<span class="text-loading">🔍 Consultando ViaCEP...</span>';
    try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        
        if (data.erro) {
            feedback.innerHTML = '<span class="text-danger">❌ CEP não encontrado na base oficial dos Correios.</span>';
            return;
        }
        
        document.getElementById('checkoutStreet').value = data.logradouro || '';
        document.getElementById('checkoutNeighborhood').value = data.bairro || '';
        document.getElementById('checkoutCity').value = data.localidade || '';
        document.getElementById('checkoutState').value = data.uf || '';
        feedback.innerHTML = `<span class="text-success">✅ ${data.localidade} - ${data.uf} (${data.bairro || 'Localizado'})</span>`;
        
        document.getElementById('checkoutNumber')?.focus();
        
        // Atualiza frete baseado no estado
        calculateFreightOptions(data.uf);
    } catch (err) {
        feedback.innerHTML = '<span class="text-danger">⚠️ Falha na consulta automática. Preencha os campos manualmente.</span>';
    }
}

// --- CÁLCULO E OPÇÕES DE FRETE ---
function calculateFreightOptions(uf = 'SP') {
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    const stateUpper = String(uf || 'SP').toUpperCase();
    const isSoutheast = ['SP', 'RJ', 'MG', 'ES'].includes(stateUpper);
    const isSouth = ['PR', 'SC', 'RS'].includes(stateUpper);
    const isNortheast = ['BA', 'PE', 'CE', 'RN', 'PB', 'AL', 'SE', 'MA', 'PI'].includes(stateUpper);
    
    let basePac = isSoutheast ? 15.90 : isSouth ? 22.90 : isNortheast ? 27.90 : 34.90;
    let baseSedex = isSoutheast ? 28.90 : isSouth ? 37.90 : isNortheast ? 45.90 : 56.90;
    
    const pacDays = isSoutheast ? '3 a 5 dias úteis' : '5 a 8 dias úteis';
    const sedexDays = isSoutheast ? '1 a 2 dias úteis' : '2 a 4 dias úteis';
    
    const hasFreeShipping = subtotal >= 250 || checkoutState.discountType === 'freight';
    
    const options = [
        {
            id: 'pac',
            name: 'Correios PAC (Econômico)',
            price: hasFreeShipping ? 0 : basePac,
            originalPrice: basePac,
            days: pacDays,
            forecast: getSimulatedDeliveryDate(null, 3, 6),
            isFree: hasFreeShipping,
            badge: hasFreeShipping ? 'FRETE GRÁTIS' : 'ECONÔMICO'
        },
        {
            id: 'sedex',
            name: 'Correios SEDEX (Expresso)',
            price: baseSedex,
            originalPrice: baseSedex,
            days: sedexDays,
            forecast: getSimulatedDeliveryDate(null, 1, 2),
            isFree: false,
            badge: 'MAIS RÁPIDO'
        },
        {
            id: 'pickup',
            name: 'Retirada Expressa no Hub QA',
            price: 0,
            originalPrice: 0,
            days: 'Disponível em 24h úteis',
            forecast: getSimulatedDeliveryDate(null, 1, 1),
            isFree: true,
            badge: 'GRÁTIS'
        }
    ];
    
    checkoutState.freightOptions = options;
    if (!checkoutState.selectedFreight || !options.find(o => o.id === checkoutState.selectedFreight.id)) {
        checkoutState.selectedFreight = options[0];
    }
    
    renderShippingOptions();
    updateCheckoutSummary();
}

function renderShippingOptions() {
    const container = document.getElementById('shippingOptionsContainer');
    if (!container) return;
    
    container.innerHTML = checkoutState.freightOptions.map(opt => {
        const isSelected = checkoutState.selectedFreight && checkoutState.selectedFreight.id === opt.id;
        return `
            <div class="shipping-option-card ${isSelected ? 'selected' : ''}" onclick="selectShippingOption('${opt.id}')">
                <div class="shipping-opt-left">
                    <input type="radio" name="shippingOpt" ${isSelected ? 'checked' : ''} style="width: auto;">
                    <div class="shipping-opt-details">
                        <strong>
                            ${escapeHtml(opt.name)}
                            <span class="shipping-badge ${opt.price === 0 ? 'free' : ''}">${opt.badge}</span>
                        </strong>
                        <span>Prazo: ${opt.days} (Previsão: ${opt.forecast})</span>
                    </div>
                </div>
                <div class="shipping-opt-price">
                    <strong>${opt.price === 0 ? 'GRÁTIS' : money(opt.price)}</strong>
                </div>
            </div>
        `;
    }).join('');
}

function selectShippingOption(optionId) {
    const opt = checkoutState.freightOptions.find(o => o.id === optionId);
    if (opt) {
        checkoutState.selectedFreight = opt;
        renderShippingOptions();
        updateCheckoutSummary();
    }
}

// --- FORMAS DE PAGAMENTO & CUPOM ---
function selectPaymentMethod(method) {
    checkoutState.paymentMethod = method;
    
    document.querySelectorAll('.payment-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.method === method);
    });
    
    document.getElementById('paymentCreditForm')?.classList.toggle('hidden', method !== 'credit');
    document.getElementById('paymentPixForm')?.classList.toggle('hidden', method !== 'pix');
    document.getElementById('paymentBoletoForm')?.classList.toggle('hidden', method !== 'boleto');
    
    updateCheckoutSummary();
}

function applyCoupon() {
    const input = document.getElementById('couponCodeInput');
    const feedback = document.getElementById('couponFeedback');
    if (!input || !feedback) return;
    
    const code = input.value.trim().toUpperCase();
    if (!code) {
        checkoutState.discount = 0;
        checkoutState.discountType = null;
        checkoutState.couponCode = '';
        feedback.innerHTML = '<span class="text-danger">Informe um código de cupom.</span>';
        updateCheckoutSummary();
        return;
    }
    
    const coupon = AVAILABLE_COUPONS[code];
    if (coupon) {
        checkoutState.couponCode = code;
        checkoutState.discountType = coupon.type;
        feedback.innerHTML = `<span class="text-success">✅ ${coupon.label} aplicado com sucesso!</span>`;
        if (coupon.type === 'freight') {
            calculateFreightOptions(document.getElementById('checkoutState')?.value || 'SP');
        }
    } else {
        checkoutState.discount = 0;
        checkoutState.discountType = null;
        checkoutState.couponCode = '';
        feedback.innerHTML = '<span class="text-danger">❌ Cupom inválido ou expirado (teste com QA10, QA20, FRETEGRATIS ou ALUNOQA).</span>';
    }
    
    updateCheckoutSummary();
}

// --- ATUALIZAÇÃO DO RESUMO FINANCEIRO DO CHECKOUT ---
function updateCheckoutSummary() {
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const freight = checkoutState.selectedFreight ? checkoutState.selectedFreight.price : 0;
    
    let discount = 0;
    let discountLabel = '';
    
    // Desconto de cupom
    if (checkoutState.couponCode && AVAILABLE_COUPONS[checkoutState.couponCode]) {
        const c = AVAILABLE_COUPONS[checkoutState.couponCode];
        if (c.type === 'percent') {
            discount = subtotal * (c.value / 100);
            discountLabel = `Cupom ${checkoutState.couponCode} (-${c.value}%)`;
        } else if (c.type === 'fixed') {
            discount = Math.min(c.value, subtotal);
            discountLabel = `Cupom ${checkoutState.couponCode}`;
        } else if (c.type === 'freight') {
            discountLabel = 'Cupom Frete Grátis';
        }
    }
    
    // Desconto extra de 5% se for PIX
    if (checkoutState.paymentMethod === 'pix') {
        const pixDiscount = (subtotal - discount) * 0.05;
        discount += pixDiscount;
        discountLabel = discountLabel ? `${discountLabel} + PIX 5% OFF` : 'Desconto PIX (5% OFF)';
    }
    
    checkoutState.discount = discount;
    const finalTotal = Math.max(0, subtotal + freight - discount);
    
    // Atualiza elementos na tela
    const subtotalEl = document.getElementById('summarySubtotal');
    const itemsCountEl = document.getElementById('summaryItemsTotalCount');
    const freightEl = document.getElementById('summaryFreight');
    const freightNameEl = document.getElementById('summaryFreightName');
    const discountRow = document.getElementById('summaryDiscountRow');
    const discountEl = document.getElementById('summaryDiscount');
    const discountLabelEl = document.getElementById('summaryDiscountLabel');
    const totalEl = document.getElementById('summaryTotal');
    const deliveryForecastEl = document.getElementById('summaryDeliveryEstimate');
    
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (itemsCountEl) itemsCountEl.textContent = cart.reduce((s, i) => s + i.quantity, 0);
    if (freightEl) freightEl.textContent = freight === 0 ? 'GRÁTIS' : money(freight);
    if (freightNameEl) freightNameEl.textContent = checkoutState.selectedFreight ? checkoutState.selectedFreight.name.split(' ')[1] || 'Padrão' : 'Padrão';
    
    if (discountRow) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            if (discountEl) discountEl.textContent = `- ${money(discount)}`;
            if (discountLabelEl) discountLabelEl.textContent = discountLabel;
        } else {
            discountRow.style.display = 'none';
        }
    }
    
    if (totalEl) totalEl.textContent = money(finalTotal);
    
    if (deliveryForecastEl) {
        if (checkoutState.selectedFreight) {
            deliveryForecastEl.innerHTML = `📅 Previsão estimada: <strong>${checkoutState.selectedFreight.forecast}</strong> (${checkoutState.selectedFreight.days})`;
        } else {
            deliveryForecastEl.innerHTML = '📅 Previsão: <strong>Informe seu CEP</strong>';
        }
    }
    
    // Atualiza opções do dropdown de parcelamento
    updateInstallmentsDropdown(finalTotal);
}

function updateInstallmentsDropdown(total) {
    const select = document.getElementById('cardInstallments');
    if (!select) return;
    
    const currentVal = select.value || '1';
    let html = '';
    for (let i = 1; i <= 12; i++) {
        const val = total / i;
        const jurosText = i <= 6 ? 'sem juros' : 'c/ juros 1.5% a.m.';
        html += `<option value="${i}" ${i == currentVal ? 'selected' : ''}>${i}x de ${money(val)} (${jurosText})</option>`;
    }
    select.innerHTML = html;
}

// --- FINALIZAÇÃO DO PEDIDO (COMPATÍVEL COM API DO BACKEND) ---
async function processOrderCheckout() {
    if (user.role !== 'user') {
        return showNotice('Apenas contas de Cliente podem finalizar pedidos.', true);
    }
    
    const cart = JSON.parse(localStorage.getItem(cartKey) || '[]');
    if (!cart.length) {
        return showNotice('Seu carrinho está vazio.', true);
    }
    
    // 1. Validação de Dados Pessoais & CPF
    const name = document.getElementById('checkoutName')?.value.trim();
    const email = document.getElementById('checkoutEmail')?.value.trim();
    const cpf = document.getElementById('checkoutCpf')?.value.trim();
    
    if (!name) return showNotice('Por favor, informe seu nome completo.', true);
    if (!email || !email.includes('@')) return showNotice('Informe um e-mail válido.', true);
    if (!cpf || !validateCPF(cpf)) {
        return showNotice('CPF inválido! Digite um CPF válido para simulação.', true);
    }
    
    // 2. Validação de Endereço
    const cep = document.getElementById('checkoutCep')?.value.trim();
    const street = document.getElementById('checkoutStreet')?.value.trim();
    const number = document.getElementById('checkoutNumber')?.value.trim();
    const complement = document.getElementById('checkoutComplement')?.value.trim();
    const neighborhood = document.getElementById('checkoutNeighborhood')?.value.trim();
    const city = document.getElementById('checkoutCity')?.value.trim();
    const state = document.getElementById('checkoutState')?.value.trim();
    
    if (!cep || !street || !number || !neighborhood || !city || !state) {
        return showNotice('Preencha todos os campos obrigatórios do endereço de entrega.', true);
    }
    
    // 3. Validação de Pagamento
    let paymentMethodName = 'Cartão de Crédito';
    let paymentDetail = '1x sem juros';
    
    if (checkoutState.paymentMethod === 'credit') {
        const cardNum = document.getElementById('cardNum')?.value.replace(/\D/g, '');
        const cardHolder = document.getElementById('cardHolder')?.value.trim();
        const cardExpiry = document.getElementById('cardExpiry')?.value.trim();
        const cardCvv = document.getElementById('cardCvv')?.value.trim();
        const inst = document.getElementById('cardInstallments')?.value || '1';
        
        if (!cardNum || cardNum.length < 13) return showNotice('Informe um número de cartão de crédito válido.', true);
        if (!cardHolder) return showNotice('Informe o nome impresso no cartão.', true);
        if (!cardExpiry || cardExpiry.length < 5) return showNotice('Informe a validade do cartão (MM/AA).', true);
        if (!cardCvv || cardCvv.length < 3) return showNotice('Informe o código CVV do cartão.', true);
        
        const brand = detectCardBrand(cardNum);
        paymentMethodName = `Cartão de Crédito (${brand.name} final ${cardNum.slice(-4)})`;
        paymentDetail = `${inst}x parcelado`;
    } else if (checkoutState.paymentMethod === 'pix') {
        paymentMethodName = 'PIX (À vista com 5% de desconto)';
        paymentDetail = 'Pagamento Instantâneo Confirmado';
    } else if (checkoutState.paymentMethod === 'boleto') {
        paymentMethodName = 'Boleto Bancário Registrado';
        paymentDetail = 'Vencimento em 3 dias úteis';
    }
    
    const freightName = checkoutState.selectedFreight ? checkoutState.selectedFreight.name : 'PAC (Padrão)';
    const freightPrice = checkoutState.selectedFreight ? checkoutState.selectedFreight.price : 0;
    const deliveryForecast = checkoutState.selectedFreight ? checkoutState.selectedFreight.forecast : getSimulatedDeliveryDate(null, 4, 7);
    
    // Constrói a string rica de endereço compatível com o backend
    const fullAddress = `${street}, ${number}${complement ? ` (${complement})` : ''} - ${neighborhood}, ${city}/${state.toUpperCase()} (CEP: ${cep})`;
    const formattedShippingString = `${fullAddress} | Frete: ${freightName} (${money(freightPrice)}) | Pagamento: ${paymentMethodName} | CPF: ${cpf}`;
    
    const submitBtn = document.getElementById('btnSubmitOrder');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processando pedido...';
    }
    
    try {
        const orderResponse = await api('/orders', {
            method: 'POST',
            body: JSON.stringify({
                shippingAddress: formattedShippingString,
                items: cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
            })
        });
        
        // Salva os metadados ricos para visualização detalhada posterior
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        saveOrderMeta(orderResponse._id, {
            subtotal,
            freight: freightPrice,
            discount: checkoutState.discount,
            couponCode: checkoutState.couponCode,
            shippingName: freightName,
            deliveryForecast,
            paymentMethodName,
            paymentDetail,
            fullAddress,
            cpf,
            items: cart.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            }))
        });
        
        // Limpa o carrinho
        localStorage.removeItem(cartKey);
        
        // Oculta checkout e exibe aviso de sucesso
        document.getElementById('checkoutSection').classList.add('hidden');
        showNotice('🎉 Pedido realizado com sucesso! Comprovante e detalhes disponíveis abaixo.');
        
        // Recarrega lista de pedidos e abre o modal imediatamente
        await loadOrders();
        openOrderModal(orderResponse._id);
        
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '🔒 Confirmar e Finalizar Pedido';
        }
    }
}

// --- PAINEL DO LOJISTA (COM ID VISUAL DE PRODUTO) ---
async function loadSellerData() {
    try {
        const [products, orders] = await Promise.all([api('/seller/products'), api('/seller/orders')]);
        window.sellerProducts = products;
        
        document.getElementById('sellerProducts').innerHTML = products.length 
            ? products.map(product => `
                <article class="data-row">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                            <span class="product-id-tag">${formatProductId(product._id)}</span>
                            <strong>${escapeHtml(product.name)}</strong>
                        </div>
                        <span>Código: <code>${product._id}</code> · ${escapeHtml(product.category)} · ${product.stock} em estoque</span>
                    </div>
                    <strong>${money(product.price)}</strong>
                    <button class="ghost-button" onclick="editProduct('${product._id}')">Editar</button>
                </article>
            `).join('') 
            : '<div class="empty">Cadastre o primeiro produto da sua loja.</div>';
            
        document.getElementById('sellerOrders').innerHTML = orders.length 
            ? orders.map(order => `
                <article class="data-row">
                    <div>
                        <strong>${formatOrderId(order._id)}</strong>
                        <span>${escapeHtml(order.customerId?.name || order.customerId?.email || 'Cliente')} · ID: <code>${order._id}</code></span>
                    </div>
                    <strong>${money(order.total)}</strong>
                    <span class="status">${order.status.toUpperCase()}</span>
                </article>
            `).join('') 
            : '<div class="empty">Nenhum pedido recebido para sua loja até o momento.</div>';
    } catch (error) { 
        showNotice(error.message, true); 
    }
}

function resetProductForm() { 
    document.getElementById('productForm').reset(); 
    document.getElementById('productId').value = ''; 
    document.getElementById('productForm').classList.add('hidden'); 
}

function editProduct(id) { 
    const product = window.sellerProducts.find(item => item._id === id); 
    if (!product) return; 
    document.getElementById('productForm').classList.remove('hidden'); 
    document.getElementById('productId').value = product._id; 
    document.getElementById('productName').value = product.name; 
    document.getElementById('productCategory').value = product.category; 
    document.getElementById('productPrice').value = product.price; 
    document.getElementById('productStock').value = product.stock; 
    document.getElementById('productDescription').value = product.description || ''; 
    document.getElementById('productImage').value = product.image || ''; 
}

async function saveProduct(event) { 
    event.preventDefault(); 
    const id = document.getElementById('productId').value; 
    const body = { 
        name: document.getElementById('productName').value, 
        category: document.getElementById('productCategory').value, 
        price: Number(document.getElementById('productPrice').value), 
        stock: Number(document.getElementById('productStock').value), 
        description: document.getElementById('productDescription').value, 
        image: document.getElementById('productImage').value 
    }; 
    
    try { 
        await api(id ? `/seller/products/${id}` : '/seller/products', { 
            method: id ? 'PUT' : 'POST', 
            body: JSON.stringify(body) 
        }); 
        resetProductForm(); 
        loadSellerData(); 
        showNotice('Produto salvo com sucesso!'); 
    } catch (error) { 
        showNotice(error.message, true); 
    } 
}

// ========================================================
// --- MÓDULO ADMINISTRATIVO (ESTILO DASHBOARD + LOJAS + PRODUTOS) ---
// ========================================================

async function loadAdminData() {
    try {
        const [users, products] = await Promise.all([
            api('/users'),
            api('/seller/products')
        ]);
        
        adminState.users = users;
        adminState.stores = users.filter(item => item.role === 'seller' || (item.storeName && item.storeName.trim()));
        adminState.products = products;
        
        document.getElementById('userCountBadge').textContent = adminState.users.length;
        document.getElementById('storeCountBadge').textContent = adminState.stores.length;
        document.getElementById('productCountBadge').textContent = adminState.products.length;
        
        // Popula filtro de lojas
        const storeSelect = document.getElementById('productStoreFilter');
        if (storeSelect) {
            storeSelect.innerHTML = '<option value="all">Todas as lojas / vendedores</option>' + 
                adminState.stores.map(store => `<option value="${store._id}">${escapeHtml(store.storeName || store.name || 'Loja')} (${escapeHtml(store.email)})</option>`).join('');
        }

        // Popula filtro de categorias
        const categories = [...new Set(adminState.products.map(item => item.category).filter(Boolean))].sort();
        const catSelect = document.getElementById('productCategoryFilter');
        if (catSelect) {
            catSelect.innerHTML = '<option value="all">Todas as categorias</option>' + categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
        }
        
        renderUsers(1);
        renderStores(1);
        renderProducts(1);
    } catch (error) {
        showNotice('Erro ao carregar dados administrativos: ' + error.message, true);
    }
}

function switchAdminTab(tabName) {
    adminState.currentTab = tabName;
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.getElementById('adminTabUsers').classList.toggle('hidden', tabName !== 'users');
    document.getElementById('adminTabStores').classList.toggle('hidden', tabName !== 'stores');
    document.getElementById('adminTabProducts').classList.toggle('hidden', tabName !== 'products');
    
    if (tabName === 'users') renderUsers();
    if (tabName === 'stores') renderStores();
    if (tabName === 'products') renderProducts();
}

function filterProductsByStore(storeId) {
    switchAdminTab('products');
    const storeSelect = document.getElementById('productStoreFilter');
    if (storeSelect) {
        storeSelect.value = storeId;
        renderProducts(1);
    }
}

function renderPagination(id, total, page, key, renderFunc) {
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    adminState.pages[key] = Math.min(page, pages);
    const container = document.getElementById(id);
    if (!container) return;
    
    if (pages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = `
        <button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="${renderFunc.name}(${page - 1})">← Anterior</button>
        <span>Página <strong>${page}</strong> de <strong>${pages}</strong></span>
        <button class="pagination-btn" ${page === pages ? 'disabled' : ''} onclick="${renderFunc.name}(${page + 1})">Próxima →</button>
    `;
}

// 1. ABA DE USUÁRIOS
function filteredUsers() { 
    const query = document.getElementById('adminUserSearch').value.toLowerCase().trim(); 
    const role = document.getElementById('adminUserRole').value; 
    return adminState.users.filter(item => {
        const matchesQuery = !query || `${item.name || ''} ${item.email || ''} ${item.storeName || ''}`.toLowerCase().includes(query);
        const matchesRole = role === 'all' || item.role === role;
        return matchesQuery && matchesRole;
    }); 
}

function renderUsers(page = adminState.pages.users) {
    const items = filteredUsers();
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    
    document.getElementById('adminUsersSummary').textContent = `${items.length} usuário(s) encontrado(s)`;
    document.getElementById('userCountBadge').textContent = adminState.users.length;
    
    if (!pageItems.length) {
        document.getElementById('adminUsersList').innerHTML = '<div class="empty">Nenhum usuário encontrado para os filtros selecionados.</div>';
        renderPagination('adminUserPagination', items.length, page, 'users', renderUsers);
        return;
    }
    
    document.getElementById('adminUsersList').innerHTML = pageItems.map(userItem => {
        const badgeClass = userItem.role === 'admin' ? 'badge admin' : userItem.role === 'blocked' ? 'badge blocked' : userItem.role === 'seller' ? 'badge seller' : 'badge user';
        const roleLabel = userItem.role === 'admin' ? 'ADMIN' : userItem.role === 'seller' ? 'LOJISTA' : userItem.role === 'blocked' ? 'BLOQUEADO' : 'CLIENTE';
        const selectedRole = userItem.role || 'user';
        const isBlocked = userItem.role === 'blocked';
        const isTestUser = TEST_USERS.includes((userItem.email || '').toLowerCase());
        const disabledAttribute = isTestUser ? 'disabled' : '';
        const disabledClass = isTestUser ? 'disabled-card' : '';
        
        return `
            <article class="user-card ${disabledClass}">
                <button class="user-card-toggle" type="button" onclick="toggleCard(this.closest('.user-card'))">
                    <div>
                        <strong>${escapeHtml(userItem.name || 'Sem nome')}</strong>
                        <div class="user-card-email">${escapeHtml(userItem.email || '-')}</div>
                    </div>
                    <div class="user-card-meta">
                        <span class="${badgeClass}">${roleLabel}</span>
                        <span class="toggle-icon">▸</span>
                    </div>
                </button>
                <div class="user-card-body">
                    ${isTestUser ? '<div class="user-card-note">⚠️ Usuário de teste – edição desabilitada para preservação de massa de testes de QA.</div>' : ''}
                    <div class="user-card-grid">
                        <label>
                            <span>Nome completo</span>
                            <input data-field="name" type="text" value="${escapeHtml(userItem.name || '')}" placeholder="Nome" ${disabledAttribute}>
                        </label>
                        <label>
                            <span>E-mail</span>
                            <input data-field="email" type="email" value="${escapeHtml(userItem.email || '')}" placeholder="E-mail" ${disabledAttribute}>
                        </label>
                        <label>
                            <span>Perfil de acesso</span>
                            <select data-field="role" ${disabledAttribute}>
                                <option value="user" ${selectedRole === 'user' ? 'selected' : ''}>Cliente</option>
                                <option value="seller" ${selectedRole === 'seller' ? 'selected' : ''}>Lojista</option>
                                <option value="admin" ${selectedRole === 'admin' ? 'selected' : ''}>Administrador</option>
                                <option value="blocked" ${selectedRole === 'blocked' ? 'selected' : ''}>Bloqueado</option>
                            </select>
                        </label>
                        <label>
                            <span>Nome da loja</span>
                            <input data-field="storeName" type="text" value="${escapeHtml(userItem.storeName || '')}" placeholder="Ex.: Minha Tech Store" ${disabledAttribute}>
                        </label>
                        <label>
                            <span>Nova senha do usuário</span>
                            <input data-field="password" type="password" placeholder="Preencha apenas para alterar" ${disabledAttribute}>
                        </label>
                        <label>
                            <span>Sua senha de administrador</span>
                            <input data-field="adminPassword" type="password" placeholder="Necessária para promover a Admin ou Lojista" ${disabledAttribute}>
                        </label>
                    </div>
                    <div class="user-card-actions">
                        <button class="primary-button btn-small" type="button" onclick="saveAdminUser('${userItem._id}', this)" ${isTestUser ? 'disabled' : ''}>Salvar Alterações</button>
                        ${(!isTestUser && isBlocked) ? `<button class="primary-button btn-small btn-success" type="button" onclick="unlockAdminUser('${userItem._id}', this)">Desbloquear Conta</button>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    renderPagination('adminUserPagination', items.length, page, 'users', renderUsers);
}

async function saveAdminUser(userId, button) {
    const card = button.closest('.user-card');
    const nameInput = card.querySelector('input[data-field="name"]');
    const emailInput = card.querySelector('input[data-field="email"]');
    const roleSelect = card.querySelector('select[data-field="role"]');
    const storeNameInput = card.querySelector('input[data-field="storeName"]');
    const passwordInput = card.querySelector('input[data-field="password"]');
    const adminPasswordInput = card.querySelector('input[data-field="adminPassword"]');
    
    const email = emailInput.value.trim().toLowerCase();
    if (TEST_USERS.includes(email)) {
        showNotice('Este usuário de teste não pode ser alterado.', true);
        return;
    }
    
    const role = roleSelect.value;
    const adminPassword = adminPasswordInput.value;
    
    if ((role === 'admin' || role === 'seller') && !adminPassword) {
        showNotice('Informe a senha do administrador para salvar o perfil de Admin ou Lojista.', true);
        adminPasswordInput.focus();
        return;
    }
    
    button.disabled = true;
    button.textContent = 'Salvando...';
    
    try {
        const payload = {
            name: nameInput.value.trim(),
            email: email,
            role: role,
            storeName: storeNameInput ? storeNameInput.value.trim() : ''
        };
        
        if (passwordInput.value) {
            payload.password = passwordInput.value;
        }
        
        if (adminPassword) {
            payload.adminPassword = adminPassword;
        }
        
        const response = await api(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        
        showNotice(response.message || 'Usuário atualizado com sucesso!');
        adminState.users = await api('/users');
        adminState.stores = adminState.users.filter(item => item.role === 'seller' || (item.storeName && item.storeName.trim()));
        renderUsers();
        renderStores();
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Alterações';
    }
}

async function unlockAdminUser(userId, button) {
    const card = button.closest('.user-card');
    const nameInput = card.querySelector('input[data-field="name"]');
    const emailInput = card.querySelector('input[data-field="email"]');
    
    button.disabled = true;
    button.textContent = 'Desbloqueando...';
    
    try {
        await api(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({
                name: nameInput.value.trim(),
                email: emailInput.value.trim().toLowerCase(),
                role: 'user'
            })
        });
        
        showNotice('Usuário desbloqueado com sucesso!');
        adminState.users = await api('/users');
        adminState.stores = adminState.users.filter(item => item.role === 'seller' || (item.storeName && item.storeName.trim()));
        renderUsers();
        renderStores();
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        button.disabled = false;
        button.textContent = 'Desbloquear Conta';
    }
}

// 2. ABA DE LOJAS COM SUBMENU / PRODUTOS POR LOJISTA
function filteredStores() { 
    const query = document.getElementById('storeSearch').value.toLowerCase().trim(); 
    const status = document.getElementById('storeStatus').value; 
    return adminState.stores.filter(item => {
        const matchesQuery = !query || `${item.name || ''} ${item.email || ''} ${item.storeName || ''}`.toLowerCase().includes(query);
        const matchesStatus = status === 'all' || (status === 'blocked' ? item.role === 'blocked' : item.role === 'seller');
        return matchesQuery && matchesStatus;
    }); 
}

function renderStores(page = adminState.pages.stores) {
    const items = filteredStores();
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    
    document.getElementById('adminStoresSummary').textContent = `${items.length} loja(s) encontrada(s)`;
    document.getElementById('storeCountBadge').textContent = adminState.stores.length;
    
    if (!pageItems.length) {
        document.getElementById('adminStoresList').innerHTML = '<div class="empty">Nenhuma loja encontrada para os filtros selecionados.</div>';
        renderPagination('storePagination', items.length, page, 'stores', renderStores);
        return;
    }
    
    document.getElementById('adminStoresList').innerHTML = pageItems.map(store => {
        const isBlocked = store.role === 'blocked';
        const badgeClass = isBlocked ? 'badge blocked' : 'badge seller';
        const statusLabel = isBlocked ? 'BLOQUEADA' : 'ATIVA';
        
        // Produtos cadastrados especificamente para esta loja
        const storeProducts = adminState.products.filter(p => {
            const sId = (typeof p.sellerId === 'object' && p.sellerId !== null) ? p.sellerId._id : p.sellerId;
            return sId === store._id || p.sellerId?.storeName === store.storeName;
        });
        
        return `
            <article class="user-card">
                <button class="user-card-toggle" type="button" onclick="toggleCard(this.closest('.user-card'))">
                    <div>
                        <strong>🏪 ${escapeHtml(store.storeName || 'Loja sem nome')}</strong>
                        <div class="user-card-email">Responsável: ${escapeHtml(store.name || 'Sem nome')} (${escapeHtml(store.email)}) · <strong>${storeProducts.length} produto(s)</strong></div>
                    </div>
                    <div class="user-card-meta">
                        <span class="${badgeClass}">${statusLabel}</span>
                        <span class="toggle-icon">▸</span>
                    </div>
                </button>
                <div class="user-card-body">
                    <div class="user-card-grid">
                        <label>
                            <span>Nome da loja</span>
                            <input data-field="storeName" type="text" value="${escapeHtml(store.storeName || '')}" placeholder="Nome comercial">
                        </label>
                        <label>
                            <span>Responsável</span>
                            <input data-field="name" type="text" value="${escapeHtml(store.name || '')}" placeholder="Nome do proprietário">
                        </label>
                        <label>
                            <span>E-mail de contato</span>
                            <input data-field="email" type="email" value="${escapeHtml(store.email || '')}" placeholder="E-mail">
                        </label>
                        <label>
                            <span>Status da loja</span>
                            <select data-field="role">
                                <option value="seller" ${store.role === 'seller' ? 'selected' : ''}>Ativa (Lojista)</option>
                                <option value="blocked" ${store.role === 'blocked' ? 'selected' : ''}>Bloqueada</option>
                            </select>
                        </label>
                    </div>

                    <!-- SUBMENU: PRODUTOS DESTA LOJA EM ESPECÍFICO -->
                    <div class="store-products-container">
                        <div class="store-products-header">
                            <h4>📦 Produtos Cadastrados desta Loja (${storeProducts.length})</h4>
                            <button class="ghost-button" type="button" onclick="filterProductsByStore('${store._id}')">🔍 Ver no Catálogo Geral</button>
                        </div>
                        <div class="store-products-list">
                            ${storeProducts.length ? storeProducts.map(p => `
                                <div class="store-product-item">
                                    <div class="prod-info">
                                        <span class="product-id-tag">${formatProductId(p._id)}</span>
                                        <span class="prod-name">${escapeHtml(p.name)}</span>
                                        <span style="color:var(--muted);">(${escapeHtml(p.category)})</span>
                                    </div>
                                    <div style="display:flex; align-items:center; gap:12px;">
                                        <strong>${money(p.price)}</strong>
                                        <span class="${p.stock > 0 ? 'badge admin' : 'badge blocked'}">${p.stock} em estoque</span>
                                        <button class="ghost-button" style="padding:4px 8px; font-size:12px;" onclick="filterProductsByStore('${store._id}')">Editar</button>
                                    </div>
                                </div>
                            `).join('') : '<div style="font-size:13px; color:var(--muted); padding:10px 0;">Esta loja ainda não possui produtos cadastrados.</div>'}
                        </div>
                    </div>

                    <div class="user-card-actions">
                        <button class="primary-button btn-small" type="button" onclick="saveAdminUser('${store._id}', this)">Salvar Dados da Loja</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    renderPagination('storePagination', items.length, page, 'stores', renderStores);
}

// 3. ABA DE PRODUTOS COM ID VISUAL E FILTRO POR LOJA
function filteredProducts() { 
    const query = document.getElementById('productSearch').value.toLowerCase().trim(); 
    const storeFilter = document.getElementById('productStoreFilter')?.value || 'all';
    const category = document.getElementById('productCategoryFilter').value; 
    const stock = document.getElementById('productStockFilter').value; 
    
    return adminState.products.filter(item => {
        const formattedId = formatProductId(item._id).toLowerCase();
        const fullId = (item._id || '').toLowerCase();
        const sellerId = (typeof item.sellerId === 'object' && item.sellerId !== null) ? item.sellerId._id : item.sellerId;
        const storeName = item.sellerId?.storeName || '';
        
        const matchesQuery = !query || 
            item.name.toLowerCase().includes(query) || 
            item.category.toLowerCase().includes(query) || 
            storeName.toLowerCase().includes(query) ||
            formattedId.includes(query) ||
            fullId.includes(query);
            
        const matchesStore = storeFilter === 'all' || sellerId === storeFilter;
        const matchesCategory = category === 'all' || item.category === category;
        const matchesStock = stock === 'all' || (stock === 'empty' ? item.stock === 0 : item.stock > 0);
        
        return matchesQuery && matchesStore && matchesCategory && matchesStock;
    }); 
}

function renderProducts(page = adminState.pages.products) {
    const items = filteredProducts();
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);
    
    document.getElementById('adminProductsSummary').textContent = `${items.length} produto(s) encontrado(s)`;
    document.getElementById('productCountBadge').textContent = adminState.products.length;
    
    if (!pageItems.length) {
        document.getElementById('adminProductsList').innerHTML = '<div class="empty">Nenhum produto encontrado para os filtros selecionados.</div>';
        renderPagination('productPagination', items.length, page, 'products', renderProducts);
        return;
    }
    
    document.getElementById('adminProductsList').innerHTML = pageItems.map(product => {
        const visualId = formatProductId(product._id);
        const storeName = product.sellerId?.storeName || product.sellerId?.name || 'Loja Oficial';
        const stockBadge = product.stock > 0 ? `<span class="badge admin">${product.stock} em estoque</span>` : `<span class="badge blocked">Esgotado</span>`;
        
        return `
            <article class="user-card">
                <button class="user-card-toggle" type="button" onclick="toggleCard(this.closest('.user-card'))">
                    <div>
                        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px; flex-wrap:wrap;">
                            <span class="product-id-tag">${visualId}</span>
                            <strong>${escapeHtml(product.name)}</strong>
                            <span class="badge seller">🏪 ${escapeHtml(storeName)}</span>
                        </div>
                        <div class="user-card-email">Código: <code>${visualId}</code> (${product._id}) · Categoria: ${escapeHtml(product.category)} · <strong>${money(product.price)}</strong></div>
                    </div>
                    <div class="user-card-meta">
                        ${stockBadge}
                        <span class="toggle-icon">▸</span>
                    </div>
                </button>
                <div class="user-card-body">
                    <div class="user-card-grid">
                        <label>
                            <span>ID Visual do Produto</span>
                            <input type="text" value="${visualId} (${product._id})" readonly style="background:#f8fafc; font-family:monospace; color:var(--muted);">
                        </label>
                        <label>
                            <span>Nome do produto</span>
                            <input data-field="name" type="text" value="${escapeHtml(product.name)}">
                        </label>
                        <label>
                            <span>Categoria</span>
                            <input data-field="category" type="text" value="${escapeHtml(product.category)}">
                        </label>
                        <label>
                            <span>Preço (R$)</span>
                            <input data-field="price" type="number" step="0.01" min="0" value="${product.price}">
                        </label>
                        <label>
                            <span>Quantidade em Estoque</span>
                            <input data-field="stock" type="number" min="0" step="1" value="${product.stock}">
                        </label>
                        <label>
                            <span>Loja Proprietária</span>
                            <input type="text" value="${escapeHtml(storeName)}" readonly style="background:#f8fafc; color:var(--muted);">
                        </label>
                        <label style="grid-column: 1 / -1;">
                            <span>URL da imagem</span>
                            <input data-field="image" type="url" value="${escapeHtml(product.image || '')}" placeholder="https://exemplo.com/imagem.jpg">
                        </label>
                        <label style="grid-column: 1 / -1;">
                            <span>Descrição do produto</span>
                            <textarea data-field="description" rows="3">${escapeHtml(product.description || '')}</textarea>
                        </label>
                    </div>
                    <div class="user-card-actions">
                        <button class="primary-button btn-small" type="button" onclick="saveAdminProduct('${product._id}', this)">Salvar Produto</button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    renderPagination('productPagination', items.length, page, 'products', renderProducts);
}

async function saveAdminProduct(productId, button) {
    const card = button.closest('.user-card');
    const name = card.querySelector('input[data-field="name"]').value.trim();
    const category = card.querySelector('input[data-field="category"]').value.trim();
    const price = Number(card.querySelector('input[data-field="price"]').value);
    const stock = Number(card.querySelector('input[data-field="stock"]').value);
    const image = card.querySelector('input[data-field="image"]').value.trim();
    const description = card.querySelector('textarea[data-field="description"]').value.trim();
    
    if (!name || !category || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
        showNotice('Preencha os campos obrigatórios com valores válidos.', true);
        return;
    }
    
    button.disabled = true;
    button.textContent = 'Salvando...';
    
    try {
        await api(`/seller/products/${productId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, category, price, stock, image, description })
        });
        
        showNotice('Produto atualizado com sucesso!');
        adminState.products = await api('/seller/products');
        renderProducts();
        renderStores();
    } catch (error) {
        showNotice(error.message, true);
    } finally {
        button.disabled = false;
        button.textContent = 'Salvar Produto';
    }
}

// --- EVENT LISTENERS ---
document.getElementById('logoutButton').addEventListener('click', () => { 
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    window.location.replace('loja.html'); 
});

document.getElementById('newProductButton')?.addEventListener('click', () => document.getElementById('productForm').classList.remove('hidden'));
document.getElementById('cancelProductButton')?.addEventListener('click', resetProductForm);
document.getElementById('productForm')?.addEventListener('submit', saveProduct);

// Filtros em tempo real
['adminUserSearch', 'adminUserRole'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => renderUsers(1));
});

['storeSearch', 'storeStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => renderStores(1));
});

['productSearch', 'productStoreFilter', 'productCategoryFilter', 'productStockFilter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => renderProducts(1));
    if (el) el.addEventListener('change', () => renderProducts(1));
});

// Trata navegação para o Checkout via Hash
function handleHashNavigation() {
    if (window.location.hash === '#checkout') {
        if (user.role === 'user') {
            document.getElementById('checkoutSection').classList.remove('hidden');
            initCheckout();
            document.getElementById('checkoutSection').scrollIntoView({ behavior: 'smooth' });
        } else {
            showNotice('Seu perfil (' + (user.role === 'seller' ? 'Lojista' : 'Administrador') + ') tem permissão apenas para gerenciamento e não pode realizar compras.', true);
        }
    }
}

window.addEventListener('hashchange', handleHashNavigation);

// Inicialização
configurePanel();
if (user.role === 'user') loadOrders();
if (user.role === 'seller') loadSellerData();
handleHashNavigation();

