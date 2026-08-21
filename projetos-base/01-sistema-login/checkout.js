const API_URL = 'https://api-qa-fap2026.onrender.com/api';
const token = localStorage.getItem('token');
const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
const cartKey = 'lojaqa_cart';

// Formatações
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
const escapeHtml = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

const formatProductId = id => {
    if (!id) return 'PRD-00000';
    const num = Math.abs(parseInt(String(id).slice(-6), 16) % 90000) + 10000;
    return `PRD-${num}`;
};

// Estado da tela de Checkout
const checkoutState = {
    cart: JSON.parse(localStorage.getItem(cartKey) || '[]'),
    freightOptions: [],
    selectedFreight: null,
    discount: 0,
    discountType: null,
    discountLabel: '',
    couponCode: '',
    paymentMethod: 'credit',
    installments: 1
};

// Cupons de Teste para QA
const QA_COUPONS = {
    'QA10': { type: 'percent', value: 10, label: 'Cupom QA10 (10% OFF)' },
    'QA20': { type: 'percent', value: 20, label: 'Cupom QA20 (20% OFF)' },
    'FRETEGRATIS': { type: 'freight', value: 100, label: 'Cupom Frete Grátis' },
    'ALUNOQA': { type: 'fixed', value: 30.00, label: 'Cupom Aluno QA (R$ 30 OFF)' }
};

// --- GUARDA DE AUTENTICAÇÃO E PERMISSÃO ---
function checkAuthAndPermissions() {
    if (!token || !user) {
        window.location.replace('login.html?return=checkout');
        return false;
    }
    
    if (user.role === 'seller' || user.role === 'admin') {
        alert('Contas de Lojista ou Administrador possuem acesso apenas para visualização e gerenciamento. Compras são exclusivas de Clientes.');
        window.location.replace('loja.html');
        return false;
    }
    
    if (!checkoutState.cart.length) {
        alert('Seu carrinho está vazio. Adicione produtos na vitrine primeiro!');
        window.location.replace('loja.html');
        return false;
    }
    
    return true;
}

// --- VALIDAÇÃO OFICIAL DE CPF (MÓDULO 11) ---
function validateCPF(cpf) {
    cpf = String(cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    
    // BUG FUNCIONAL QA: Não valida todos os dígitos repetidos (ex: aceita 111.111.111-11 como válido)
    if (cpf === '00000000000') return false;
    
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

// Identificador de Bandeira
function detectCardBrand(num) {
    const clean = String(num || '').replace(/\D/g, '');
    if (/^4/.test(clean)) return { name: 'Visa', icon: 'Visa' };
    if (/^(5[1-5]|2[2-7])/.test(clean)) return { name: 'Mastercard', icon: 'Mastercard' };
    if (/^(401178|401179|438935|457631|457632|504175|627780|636297|636368)/.test(clean)) return { name: 'Elo', icon: 'Elo' };
    if (/^3[47]/.test(clean)) return { name: 'Amex', icon: 'Amex' };
    if (/^(606282|3841)/.test(clean)) return { name: 'Hipercard', icon: 'Hipercard' };
    return { name: 'Desconhecido', icon: 'Cartão' };
}

// Data estimada formatada
function getEstimatedDeliveryDate(minDays, maxDays) {
    const dateMin = new Date();
    const dateMax = new Date();
    dateMin.setDate(dateMin.getDate() + minDays);
    dateMax.setDate(dateMax.getDate() + (maxDays || minDays + 3));
    
    const options = { day: '2-digit', month: '2-digit' };
    return `${dateMin.toLocaleDateString('pt-BR', options)} a ${dateMax.toLocaleDateString('pt-BR', options)}`;
}

// Notificações
function showNotice(msg, isError = false) {
    const el = document.getElementById('checkoutNotice');
    if (!el) return;
    el.textContent = msg;
    el.className = `checkout-notice ${isError ? 'error' : 'success'}`;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { el.className = 'checkout-notice'; }, 4500);
}

// --- INICIALIZAÇÃO DA PÁGINA ---
function initPage() {
    if (!checkAuthAndPermissions()) return;
    
    // Saudação no topo
    const greeting = document.getElementById('checkoutUserGreeting');
    if (greeting) {
        greeting.textContent = `Olá, ${user.name ? user.name.split(' ')[0] : 'Cliente'}`;
    }
    
    // Preenche dados do comprador
    const buyerName = document.getElementById('buyerName');
    const buyerEmail = document.getElementById('buyerEmail');
    if (buyerName) buyerName.value = user.name || '';
    if (buyerEmail) buyerEmail.value = user.email || '';
    
    // Configura máscaras de formulário
    setupMasks();
    
    // Renderiza lista de produtos no resumo
    renderProductsSummary();
    
    // Calcula fretes iniciais com estado padrão SP
    calculateShippingOptions('SP');
}

// --- CONFIGURAÇÃO DE MÁSCARAS E VALIDAÇÃO INSTANTÂNEA ---
function setupMasks() {
    const cpfInput = document.getElementById('buyerCpf');
    const cepInput = document.getElementById('deliveryCep');
    const phoneInput = document.getElementById('buyerPhone');
    const cardNum = document.getElementById('cardNumber');
    const cardExpiry = document.getElementById('cardExpiryDate');
    const cardCvv = document.getElementById('cardCvvCode');
    
    // Validação de CPF com mensagem limpa ABAIXO do input
    if (cpfInput) {
        cpfInput.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 11) v = v.slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, '$1.$2')
                 .replace(/(\d{3})(\d)/, '$1.$2')
                 .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            e.target.value = v;
            
            const badge = document.getElementById('cpfStatusBadge');
            const help = document.getElementById('cpfHelpMessage');
            const clean = e.target.value.replace(/\D/g, '');
            
            if (clean.length === 11) {
                const isValid = validateCPF(clean);
                if (isValid) {
                    badge.className = 'status-pill valid';
                    badge.textContent = 'CPF Válido';
                    help.textContent = 'Cálculo de dígitos verificadores aprovado com sucesso.';
                } else {
                    badge.className = 'status-pill invalid';
                    badge.textContent = 'CPF Inválido';
                    help.textContent = 'Dígitos verificadores incorretos (cenário de teste de validação QA).';
                }
            } else {
                badge.className = 'status-pill default';
                badge.textContent = 'Aguardando CPF';
                help.textContent = 'Digite os 11 dígitos para cálculo dos dígitos verificadores.';
            }
        });
    }
    
    if (cepInput) {
        cepInput.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 8) v = v.slice(0, 8);
            v = v.replace(/(\d{5})(\d)/, '$1-$2');
            e.target.value = v;
            
            if (v.replace(/\D/g, '').length === 8) {
                handleCepSearch();
            }
        });
    }
    
    if (phoneInput) {
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
    
    if (cardNum) {
        cardNum.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 16) v = v.slice(0, 16);
            v = v.replace(/(\d{4})(?=\d)/g, '$1 ');
            e.target.value = v;
            
            const brand = detectCardBrand(v);
            const badge = document.getElementById('detectedBrandIcon');
            if (badge) badge.textContent = brand.icon;
        });
    }
    
    if (cardExpiry) {
        cardExpiry.addEventListener('input', e => {
            let v = e.target.value.replace(/\D/g, '');
            if (v.length > 4) v = v.slice(0, 4);
            if (v.length >= 2) v = v.replace(/(\d{2})(\d{1,2})/, '$1/$2');
            e.target.value = v;
        });
    }
    
    if (cardCvv) {
        cardCvv.addEventListener('input', e => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
    }
}

// --- CONSULTA VIACEP ---
async function handleCepSearch() {
    const cepInput = document.getElementById('deliveryCep');
    const feedback = document.getElementById('cepFeedbackBox');
    if (!cepInput || !feedback) return;
    
    const cleanCep = cepInput.value.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
        feedback.className = 'cep-status-message error';
        feedback.textContent = 'Digite um CEP completo com 8 números.';
        return;
    }
    
    feedback.className = 'cep-status-message loading';
    feedback.textContent = 'Consultando base dos Correios (ViaCEP)...';
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (data.erro) {
            feedback.className = 'cep-status-message error';
            feedback.textContent = 'CEP não encontrado na base oficial dos Correios.';
            return;
        }
        
        document.getElementById('deliveryStreet').value = data.logradouro || '';
        document.getElementById('deliveryNeighborhood').value = data.bairro || '';
        document.getElementById('deliveryCity').value = data.localidade || '';
        document.getElementById('deliveryState').value = data.uf || '';
        
        feedback.className = 'cep-status-message success';
        feedback.textContent = `Localizado: ${data.localidade} - ${data.uf} (${data.bairro || 'Centro'})`;
        
        document.getElementById('deliveryNumber')?.focus();
        
        // Atualiza opções de frete
        calculateShippingOptions(data.uf);
    } catch (err) {
        feedback.className = 'cep-status-message error';
        feedback.textContent = 'Não foi possível consultar o CEP automaticamente. Preencha os campos abaixo.';
    }
}

// --- CÁLCULO DE FRETE E PRAZOS ---
function calculateShippingOptions(uf = 'SP') {
    const subtotal = checkoutState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const ufUpper = String(uf || 'SP').toUpperCase();
    
    const isSoutheast = ['SP', 'RJ', 'MG', 'ES'].includes(ufUpper);
    const isSouth = ['PR', 'SC', 'RS'].includes(ufUpper);
    const isNortheast = ['BA', 'PE', 'CE', 'RN', 'PB', 'AL', 'SE', 'MA', 'PI'].includes(ufUpper);
    
    let basePac = isSoutheast ? 16.90 : isSouth ? 22.90 : isNortheast ? 27.90 : 34.90;
    let baseSedex = isSoutheast ? 29.90 : isSouth ? 38.90 : isNortheast ? 46.90 : 56.90;
    
    const pacDays = isSoutheast ? '3 a 5 dias úteis' : '5 a 8 dias úteis';
    const sedexDays = isSoutheast ? '1 a 2 dias úteis' : '2 a 4 dias úteis';
    
    const hasFreeShipping = subtotal >= 250 || checkoutState.discountType === 'freight';
    
    const options = [
        {
            id: 'pac',
            name: 'Correios PAC (Econômico)',
            price: hasFreeShipping ? 0 : basePac,
            days: pacDays,
            forecast: getEstimatedDeliveryDate(3, 6),
            badge: hasFreeShipping ? 'FRETE GRÁTIS' : 'ECONÔMICO',
            isFree: hasFreeShipping
        },
        {
            id: 'sedex',
            name: 'Correios SEDEX (Expresso)',
            price: baseSedex,
            days: sedexDays,
            forecast: getEstimatedDeliveryDate(1, 2),
            badge: 'MAIS RÁPIDO',
            isFree: false
        },
        {
            id: 'pickup',
            name: 'Retirada no Hub QA',
            price: 0,
            days: 'Pronto em 24h úteis',
            forecast: getEstimatedDeliveryDate(1, 1),
            badge: 'GRÁTIS',
            isFree: true
        }
    ];
    
    checkoutState.freightOptions = options;
    if (!checkoutState.selectedFreight || !options.find(o => o.id === checkoutState.selectedFreight.id)) {
        checkoutState.selectedFreight = options[0];
    }
    
    renderShippingCards();
    updateFinancialSummary();
}

function renderShippingCards() {
    const grid = document.getElementById('shippingCardsGrid');
    if (!grid) return;
    
    grid.innerHTML = checkoutState.freightOptions.map(opt => {
        const isSelected = checkoutState.selectedFreight && checkoutState.selectedFreight.id === opt.id;
        return `
            <div class="shipping-card-option ${isSelected ? 'selected' : ''}" onclick="selectShipping('${opt.id}')">
                <div class="shipping-info-left">
                    <input type="radio" name="shippingRadio" ${isSelected ? 'checked' : ''} style="width: auto;">
                    <div>
                        <div class="shipping-title-row">
                            <strong>${escapeHtml(opt.name)}</strong>
                            <span class="shipping-badge-tag ${opt.price === 0 ? 'free' : ''}">${opt.badge}</span>
                        </div>
                        <div class="shipping-desc-text">Prazo: ${opt.days} · Previsão: <strong>${opt.forecast}</strong></div>
                    </div>
                </div>
                <div class="shipping-price-right">
                    <strong>${opt.price === 0 ? 'GRÁTIS' : money(opt.price)}</strong>
                </div>
            </div>
        `;
    }).join('');
}

function selectShipping(optId) {
    const opt = checkoutState.freightOptions.find(o => o.id === optId);
    if (opt) {
        checkoutState.selectedFreight = opt;
        renderShippingCards();
        updateFinancialSummary();
    }
}

// --- FORMAS DE PAGAMENTO ---
function switchPayment(method) {
    checkoutState.paymentMethod = method;
    
    document.querySelectorAll('.pay-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.method === method);
    });
    
    document.getElementById('paneCredit')?.classList.toggle('hidden', method !== 'credit');
    document.getElementById('panePix')?.classList.toggle('hidden', method !== 'pix');
    document.getElementById('paneBoleto')?.classList.toggle('hidden', method !== 'boleto');
    
    updateFinancialSummary();
}

function copyPixCodeToClipboard() {
    const input = document.getElementById('pixCopyInput');
    if (input) {
        navigator.clipboard?.writeText(input.value);
        showNotice('Código PIX copiado com sucesso!');
    }
}

function copyBoletoToClipboard() {
    const input = document.getElementById('boletoBarcodeInput');
    if (input) {
        navigator.clipboard?.writeText(input.value);
        showNotice('Linha digitável do boleto copiada!');
    }
}

// --- CUPOM DE DESCONTO ---
function applyCouponCode() {
    const input = document.getElementById('couponInput');
    const msg = document.getElementById('couponFeedbackMessage');
    if (!input || !msg) return;
    
    const code = input.value.trim().toUpperCase();
    if (!code) {
        checkoutState.discount = 0;
        checkoutState.discountType = null;
        checkoutState.couponCode = '';
        msg.className = 'coupon-msg error';
        msg.textContent = 'Informe um código de cupom.';
        updateFinancialSummary();
        return;
    }
    
    const coupon = QA_COUPONS[code];
    if (coupon) {
        checkoutState.couponCode = code;
        checkoutState.discountType = coupon.type;
        msg.className = 'coupon-msg success';
        msg.textContent = `${coupon.label} ativado!`;
        if (coupon.type === 'freight') {
            calculateShippingOptions(document.getElementById('deliveryState')?.value || 'SP');
        }
    } else {
        checkoutState.discount = 0;
        checkoutState.discountType = null;
        checkoutState.couponCode = '';
        msg.className = 'coupon-msg error';
        msg.textContent = 'Cupom inválido (experimente QA10, QA20, FRETEGRATIS ou ALUNOQA).';
    }
    
    updateFinancialSummary();
}

// --- PRODUTOS NO RESUMO LATERAL ---
function renderProductsSummary() {
    const container = document.getElementById('summaryProductsList');
    const headerCount = document.getElementById('summaryHeaderCount');
    const prodCount = document.getElementById('summaryProductsCount');
    
    const count = checkoutState.cart.reduce((s, i) => s + i.quantity, 0);
    // BUG PEDAGÓGICO QA: Usa a quantidade de tipos/linhas em vez da soma de unidades no header superior
    if (headerCount) headerCount.textContent = `${checkoutState.cart.length} ${checkoutState.cart.length === 1 ? 'item' : 'itens'}`;
    if (prodCount) prodCount.textContent = count;
    
    if (!container) return;
    
    container.innerHTML = checkoutState.cart.map(item => `
        <div class="summary-item-card">
            <div class="summary-item-info">
                <strong>${escapeHtml(item.name)}</strong>
                <span>ID: <code>${formatProductId(item.productId)}</code> · Qtd: ${item.quantity}</span>
            </div>
            <div class="summary-item-price">
                ${money(item.price * item.quantity)}
            </div>
        </div>
    `).join('');
}

function toggleSummaryProducts() {
    const list = document.getElementById('summaryProductsList');
    const icon = document.getElementById('summaryToggleIcon');
    if (!list) return;
    
    const isHidden = list.style.display === 'none';
    list.style.display = isHidden ? 'flex' : 'none';
    if (icon) icon.textContent = isHidden ? '▼' : '▲';
}

// --- ATUALIZAÇÃO DOS VALORES ---
function updateFinancialSummary() {
    const subtotal = checkoutState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const freight = checkoutState.selectedFreight ? checkoutState.selectedFreight.price : 0;
    
    let discount = 0;
    let discountLabel = '';
    
    if (checkoutState.couponCode && QA_COUPONS[checkoutState.couponCode]) {
        const c = QA_COUPONS[checkoutState.couponCode];
        if (c.type === 'percent') {
            discount = subtotal * (c.value / 100);
            discountLabel = `Cupom ${checkoutState.couponCode} (-${c.value}%)`;
        } else if (c.type === 'fixed') {
            // BUG PEDAGÓGICO QA: Aplica R$ 35,00 no cálculo enquanto o rótulo diz R$ 30,00
            discount = Math.min(c.value + 5, subtotal);
            discountLabel = `Cupom ${checkoutState.couponCode} (-R$ ${c.value})`;
        } else if (c.type === 'freight') {
            // BUG CRÍTICO QA (Financeiro): Cupom FRETEGRATIS zera o subtotal inteiro dos produtos, deixando o pedido gratuito (Total R$ 0,00)
            discount = subtotal;
            discountLabel = 'Cupom Frete Grátis';
        }
    }
    
    if (checkoutState.paymentMethod === 'pix') {
        const pixDesc = (subtotal - discount) * 0.05;
        discount += pixDesc;
        discountLabel = discountLabel ? `${discountLabel} + PIX 5% OFF` : 'Desconto PIX (5% OFF)';
    }
    
    checkoutState.discount = discount;
    const finalTotal = Math.max(0, subtotal + freight - discount);
    
    // Atualiza DOM
    const subtotalEl = document.getElementById('priceSubtotal');
    const shippingEl = document.getElementById('priceShipping');
    const shippingTypeEl = document.getElementById('priceShippingType');
    const discountRow = document.getElementById('priceDiscountRow');
    const discountEl = document.getElementById('priceDiscount');
    const discountNameEl = document.getElementById('priceDiscountName');
    const totalEl = document.getElementById('priceTotal');
    const estimateTextEl = document.getElementById('deliveryEstimateText');
    
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (shippingEl) shippingEl.textContent = freight === 0 ? 'GRÁTIS' : money(freight);
    if (shippingTypeEl) shippingTypeEl.textContent = checkoutState.selectedFreight ? checkoutState.selectedFreight.name.split(' ')[1] || 'Padrão' : 'Padrão';
    
    if (discountRow) {
        if (discount > 0) {
            discountRow.style.display = 'flex';
            if (discountEl) discountEl.textContent = `- ${money(discount)}`;
            if (discountNameEl) discountNameEl.textContent = discountLabel;
        } else {
            discountRow.style.display = 'none';
        }
    }
    
    if (totalEl) totalEl.textContent = money(finalTotal);
    
    if (estimateTextEl) {
        if (checkoutState.selectedFreight) {
            estimateTextEl.textContent = `${checkoutState.selectedFreight.forecast} (${checkoutState.selectedFreight.days})`;
        }
    }
    
    // Atualiza opções de parcelamento
    updateInstallmentsSelect(finalTotal);
}

function updateInstallmentsSelect(total) {
    const select = document.getElementById('cardInstallmentsSelect');
    if (!select) return;
    
    const current = select.value || '1';
    let html = '';
    for (let i = 1; i <= 12; i++) {
        const val = total / i;
        const interest = i <= 6 ? 'sem juros' : 'c/ juros 1.5% a.m.';
        html += `<option value="${i}" ${i == current ? 'selected' : ''}>${i}x de ${money(val)} (${interest})</option>`;
    }
    select.innerHTML = html;
}

// --- SUBMISSÃO E FINALIZAÇÃO DO PEDIDO ---
async function submitCompleteOrder() {
    if (!checkAuthAndPermissions()) return;
    
    // 1. Validação de Comprador e CPF
    const name = document.getElementById('buyerName')?.value.trim();
    const email = document.getElementById('buyerEmail')?.value.trim();
    const cpf = document.getElementById('buyerCpf')?.value.trim();
    
    if (!name) return showNotice('Informe o nome completo do comprador.', true);
    if (!email || !email.includes('@')) return showNotice('Informe um e-mail válido.', true);
    if (!cpf || !validateCPF(cpf)) {
        return showNotice('CPF inválido! Preencha um CPF válido para simular a compra.', true);
    }
    
    // 2. Validação de Endereço
    const cep = document.getElementById('deliveryCep')?.value.trim();
    const street = document.getElementById('deliveryStreet')?.value.trim();
    const number = document.getElementById('deliveryNumber')?.value.trim();
    const complement = document.getElementById('deliveryComplement')?.value.trim();
    const neighborhood = document.getElementById('deliveryNeighborhood')?.value.trim();
    const city = document.getElementById('deliveryCity')?.value.trim();
    const state = document.getElementById('deliveryState')?.value.trim();
    
    if (!cep || !street || !number || !neighborhood || !city || !state) {
        return showNotice('Preencha todos os campos obrigatórios do endereço de entrega.', true);
    }
    
    // 3. Validação de Pagamento
    let paymentMethodName = 'Cartão de Crédito';
    let paymentDetail = '1x sem juros';
    
    if (checkoutState.paymentMethod === 'credit') {
        const cardNum = document.getElementById('cardNumber')?.value.replace(/\D/g, '');
        const cardHolder = document.getElementById('cardHolderName')?.value.trim();
        const cardExpiry = document.getElementById('cardExpiryDate')?.value.trim();
        const cardCvv = document.getElementById('cardCvvCode')?.value.trim();
        const inst = document.getElementById('cardInstallmentsSelect')?.value || '1';
        
        if (!cardNum || cardNum.length < 13) return showNotice('Informe o número completo do cartão de crédito.', true);
        if (!cardHolder) return showNotice('Informe o nome impresso no cartão.', true);
        if (!cardExpiry || cardExpiry.length < 5) return showNotice('Informe a validade do cartão (MM/AA).', true);
        if (!cardCvv || cardCvv.length < 3) return showNotice('Informe o código de segurança (CVV).', true);
        
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
    const deliveryForecast = checkoutState.selectedFreight ? checkoutState.selectedFreight.forecast : getEstimatedDeliveryDate(4, 7);
    
    const fullAddress = `${street}, ${number}${complement ? ` (${complement})` : ''} - ${neighborhood}, ${city}/${state.toUpperCase()} (CEP: ${cep})`;
    const formattedShippingString = `${fullAddress} | Frete: ${freightName} (${money(freightPrice)}) | Pagamento: ${paymentMethodName} | CPF: ${cpf}`;
    
    const btn = document.getElementById('btnPlaceOrder');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Processando pedido...';
    }
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                shippingAddress: formattedShippingString,
                items: checkoutState.cart.map(item => ({ productId: item.productId, quantity: item.quantity }))
            })
        });
        
        const orderData = await response.json();
        if (!response.ok) throw new Error(orderData.error || 'Erro ao processar pedido.');
        
        // Salva metadados ricos do pedido para o painel
        const subtotal = checkoutState.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const userMetas = JSON.parse(localStorage.getItem('lojaqa_orders_meta_' + user.email) || '{}');
        userMetas[orderData._id] = {
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
            items: checkoutState.cart.map(item => ({
                productId: item.productId,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            }))
        };
        localStorage.setItem('lojaqa_orders_meta_' + user.email, JSON.stringify(userMetas));
        
        // Limpa o carrinho
        localStorage.removeItem(cartKey);
        
        // Redireciona para o painel de pedidos abrindo os detalhes do pedido
        window.location.replace(`painel.html?orderId=${orderData._id}#ordersSection`);
        
    } catch (err) {
        showNotice(err.message, true);
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px; margin-right: 6px;"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Confirmar e Finalizar Pedido`;
        }
    }
}

// Inicia ao carregar
initPage();
