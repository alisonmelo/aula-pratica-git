// Massa de Dados Mockada
const users = {
    "admin@system.com": { password: "AdminPassword123", role: "admin", name: "Administrador" },
    "user@system.com": { password: "UserPassword123", role: "user", name: "Usuário Padrão" }
};

const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 15 * 60 * 1000;

function checkLockStatus() {
    const lockTime = localStorage.getItem('lockUntil');
    if (lockTime && Date.now() < parseInt(lockTime)) {
        const minutesLeft = Math.ceil((parseInt(lockTime) - Date.now()) / 60000);
        showError(`Conta bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} minuto(s).`);
        document.getElementById('loginBtn').disabled = true;
        return true;
    } else if (lockTime) {
        localStorage.removeItem('lockUntil');
        localStorage.setItem('failedAttempts', '0');
        document.getElementById('loginBtn').disabled = false;
    }
    return false;
}

function attemptLogin() {
    if (checkLockStatus()) return;

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showError("Usuário e senha são obrigatórios.");
        return;
    }

    if (password.length < 8) {
        showError("A senha deve conter no mínimo 8 caracteres.");
        return;
    }

    if (users[email] && users[email].password === password) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUser', JSON.stringify(users[email]));
        localStorage.setItem('failedAttempts', '0');
        window.location.href = 'dashboard.html';
    } else {
        let attempts = parseInt(localStorage.getItem('failedAttempts') || '0') + 1;
        localStorage.setItem('failedAttempts', attempts);

        if (attempts >= MAX_ATTEMPTS) {
            const lockUntil = Date.now() + LOCK_TIME_MS;
            localStorage.setItem('lockUntil', lockUntil);
            checkLockStatus();
        } else {
            showError(`Credenciais inválidas. Tentativa ${attempts} de ${MAX_ATTEMPTS}.`);
        }
    }
}

function showError(msg) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
}

// Verifica o status ao carregar a página
window.onload = checkLockStatus;