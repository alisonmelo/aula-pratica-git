const MAX_ATTEMPTS = 3;
const LOCK_TIME_MS = 1 * 60 * 1000; 
const API_URL = 'http://localhost:3000/api'; 

function failedKey(email) { return `failedAttempts_${email.toLowerCase()}`; }
function lockKey(email) { return `lockUntil_${email.toLowerCase()}`; }

function checkLockStatus(email) {
    if (!email) return false;
    const key = lockKey(email);
    const lockTime = localStorage.getItem(key);
    
    if (lockTime && Date.now() < parseInt(lockTime)) {
        const minutesLeft = Math.ceil((parseInt(lockTime) - Date.now()) / 60000);
        showError(`Conta bloqueada. Tente em ${minutesLeft} minuto(s).`);
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

async function attemptLogin() {
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    if (checkLockStatus(email)) return;
    if (!email || !password) return showError("Usuário e senha são obrigatórios.");
    if (password.length < 8) return showError("A senha deve conter no mínimo 8 caracteres.");

    const start = Date.now();

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        const elapsed = Date.now() - start;

        if (response.ok) {
            // Salva o Token JWT
            localStorage.setItem('token', data.token);
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            localStorage.setItem(failedKey(email), '0');
            
            showInfo(`Login bem-sucedido. Tempo: ${elapsed} ms.`);
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

function showError(msg) {
    document.getElementById('errorMessage').textContent = msg;
    document.getElementById('errorMessage').style.display = 'block';
    if(document.getElementById('statusMessage')) document.getElementById('statusMessage').style.display = 'none';
}

function showInfo(msg) {
    document.getElementById('statusMessage').textContent = msg;
    document.getElementById('statusMessage').style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

window.addEventListener('load', () => {
    const emailInput = document.getElementById('email');
    emailInput.addEventListener('input', () => checkLockStatus(emailInput.value.trim().toLowerCase()));
    checkLockStatus(emailInput.value.trim().toLowerCase());
});