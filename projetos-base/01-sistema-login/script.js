const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 1 * 60 * 1000; 
const API_URL = 'https://api-qa-fap2026.onrender.com/api'; 
// --- FUNÇÕES DE INTERFACE ---
function toggleSection(sectionId) {
    document.getElementById('section-login').style.display = 'none';
    document.getElementById('section-register').style.display = 'none';
    document.getElementById('section-forgot').style.display = 'none';
    
    document.getElementById(sectionId).style.display = 'block';
    
    // Limpa mensagens de erro ao trocar de tela
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('statusMessage').style.display = 'none';
}

function showError(msg) {
    document.getElementById('errorMessage').textContent = msg;
    document.getElementById('errorMessage').style.display = 'block';
    document.getElementById('statusMessage').style.display = 'none';
}

function showInfo(msg) {
    document.getElementById('statusMessage').textContent = msg;
    document.getElementById('statusMessage').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

// --- LÓGICA DE BLOQUEIO DE TENTATIVAS ---
function failedKey(email) { return `failedAttempts_${email.toLowerCase()}`; }
function lockKey(email) { return `lockUntil_${email.toLowerCase()}`; }

function checkLockStatus(email) {
    if (!email) return false;
    const key = lockKey(email);
    const lockTime = localStorage.getItem(key);
    
    if (lockTime && Date.now() < parseInt(lockTime)) {
        const minutesLeft = Math.ceil((parseInt(lockTime) - Date.now()) / 60000);
        showError(`Conta bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} minuto(s).`);
        document.getElementById('loginBtn').disabled = true;
        return true;
    } else if (lockTime) {
        localStorage.removeItem(key);
        localStorage.setItem(failedKey(email), '0');
        document.getElementById('loginBtn').disabled = false;
    }
    document.getElementById('loginBtn').disabled = false;
    return false;
}

// --- FUNÇÃO 1: LOGIN (Regressão) ---
async function attemptLogin() {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (checkLockStatus(email)) return;
    if (!email || !password) return showError("Usuário e senha são obrigatórios.");
    if (password.length < 8) return showError("A senha deve conter no mínimo 8 caracteres.");

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem(failedKey(email), '0');
            
            showInfo(`Login bem-sucedido. Redirecionando...`);
            setTimeout(() => window.location.href = 'dashboard.html', 500);
            
        } else {
            let attempts = parseInt(localStorage.getItem(failedKey(email)) || '0') + 1;
            localStorage.setItem(failedKey(email), String(attempts));

            if (attempts >= MAX_ATTEMPTS) {
                const lockUntil = Date.now() + LOCK_TIME_MS;
                localStorage.setItem(lockKey(email), String(lockUntil));
                checkLockStatus(email);
            } else {
                showError(`${data.error || 'Credenciais inválidas.'} Tentativa ${attempts} de ${MAX_ATTEMPTS}.`);
            }
        }
    } catch (error) {
        showError("Erro de comunicação com o servidor da API.");
    }
}

// --- FUNÇÃO 2: CADASTRAR (Nova Feature) ---
async function attemptRegister() {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) return showError("Todos os campos são obrigatórios.");
    if (password.length < 8) return showError("A senha deve conter no mínimo 8 caracteres.");

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            showInfo(data.message + " Redirecionando para o login...");
            // Limpa os campos
            document.getElementById('reg-name').value = '';
            document.getElementById('reg-email').value = '';
            document.getElementById('reg-password').value = '';
            
            // Redireciona para tela de login após 2 segundos
            setTimeout(() => toggleSection('section-login'), 2000);
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError("Erro de comunicação com o servidor da API.");
    }
}

// --- FUNÇÃO 3: ESQUECI A SENHA (Nova Feature) ---
async function attemptForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim().toLowerCase();

    if (!email) return showError("O e-mail é obrigatório para recuperação.");

    try {
        const response = await fetch(`${API_URL}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (response.ok) {
            showInfo(data.message);
            document.getElementById('forgot-email').value = '';
        } else {
            showError(data.error);
        }
    } catch (error) {
        showError("Erro de comunicação com o servidor da API.");
    }
}

// Checagem de bloqueio ao carregar
window.addEventListener('load', () => {
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('input', () => checkLockStatus(emailInput.value.trim().toLowerCase()));
    checkLockStatus(emailInput.value.trim().toLowerCase());
});