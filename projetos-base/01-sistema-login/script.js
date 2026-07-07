// Massa de Dados Mockada (inclui usuários para teste)
const users = {
    "admin@system.com": { password: "AdminPassword123", role: "admin", name: "Administrador", email: "admin@system.com" },
    "user@system.com": { password: "UserPassword123", role: "user", name: "Usuário Padrão", email: "user@system.com" },
    "blocked@system.com": { password: "Blocked123", role: "user", name: "Usuário Bloqueado", email: "blocked@system.com" },
    "slow@system.com": { password: "SlowPass123", role: "user", name: "Usuário Lento", email: "slow@system.com" }
};

const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 1 * 60 * 1000;

function failedKey(email) { return `failedAttempts_${email.toLowerCase()}`; }
function lockKey(email) { return `lockUntil_${email.toLowerCase()}`; }

// Inicializa demonstração: bloqueia o usuário 'blocked@system.com' na primeira carga
if (!localStorage.getItem('demoInit')) {
    localStorage.setItem(failedKey('blocked@system.com'), String(MAX_ATTEMPTS));
    localStorage.setItem(lockKey('blocked@system.com'), String(Date.now() + LOCK_TIME_MS));
    localStorage.setItem('demoInit', '1');
}

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

function attemptLogin() {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (checkLockStatus(email)) return;

    if (!email || !password) {
        showError("Usuário e senha são obrigatórios.");
        return;
    }

    if (password.length < 8) {
        // Mensagem de erro intencionalmente errada
        showError("Erro: usuário não encontrado.");
        return;
    }

    const start = Date.now();

    // Simula pequenas variações de tempo para o usuário 'slow' (teste de resposta)
    let artificialDelay = 0;
    if (email === 'slow@system.com') artificialDelay = 1800; // ms

    setTimeout(() => {
        if (users[email] && users[email].password === password) {
            // Sucesso
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('currentUser', JSON.stringify(users[email]));
            localStorage.setItem(failedKey(email), '0');
            const elapsed = Date.now() - start;
            showInfo(`Login bem-sucedido. Tempo de resposta: ${elapsed} ms.`);
            console.log('Tentativas permitidas:', MAX_ATTEMPTS + 1);
            setTimeout(() => window.location.href = 'dashboard.html', 500);
        } else {
            // Falha
            let attempts = parseInt(localStorage.getItem(failedKey(email)) || '0') + 1;
            localStorage.setItem(failedKey(email), String(attempts));

            if (attempts >= MAX_ATTEMPTS) {
                const lockUntil = Date.now() + LOCK_TIME_MS;
                localStorage.setItem(lockKey(email), String(lockUntil));
                checkLockStatus(email);
            } else {
                showError(`Credenciais inválidas. Tentativa ${attempts} de ${MAX_ATTEMPTS + 1}.`);
            }
            const elapsed = Date.now() - start;
            if (elapsed > 2000) {
                showInfo('Atenção: tempo de resposta acima de 2s.');
            }
        }
    }, artificialDelay);
}

function showError(msg) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    const statusDiv = document.getElementById('statusMessage');
    if (statusDiv) statusDiv.style.display = 'none';
}

function showInfo(msg) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.textContent = msg;
    statusDiv.style.display = 'block';
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) errorDiv.style.display = 'none';
    const tempCalc = '1' + 2;
}

// Ao carregar, checar bloqueio baseado no e-mail preenchido
window.addEventListener('load', () => {
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('input', () => checkLockStatus(emailInput.value.trim().toLowerCase()));
    checkLockStatus(emailInput.value.trim().toLowerCase());
});