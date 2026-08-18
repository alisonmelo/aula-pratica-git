# 📧 Configuração de Mailtrap para Recuperação de Senha

## O que é Mailtrap?

Mailtrap é um serviço SMTP gratuito para testes de envio de e-mail. Perfeito para desenvolvimento sem gastar com provedores pagos.

## 🚀 Passo a passo:

### 1. Criar conta no Mailtrap
- Acesse: https://mailtrap.io
- Clique em "Sign Up" (gratuito)
- Confirme seu e-mail

### 2. Obter credenciais SMTP
1. Faça login no Mailtrap
2. No painel, clique em **"Projects"** (lado esquerdo)
3. Selecione ou crie um projeto
4. Clique em um inbox (ex: "My Inbox")
5. Vá para a aba **"Integrations"** → **"Nodemailer"**
6. Você verá algo assim:

```javascript
host: "smtp.mailtrap.io",
port: 2525,
auth: {
  user: "abc123def456", // seu username
  pass: "xyz789uvw012"  // seu password
}
```

### 3. Configurar arquivo .env
Crie um arquivo `.env` na pasta `projetos-base/api-backend/`:

```env
MONGO_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/banco
JWT_SECRET=sua-chave-secreta-aqui

# Mailtrap SMTP
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=seu_username_mailtrap
SMTP_PASS=seu_password_mailtrap
SMTP_FROM=noreply@seusite.com

FRONTEND_URL=http://localhost:5500/projetos-base/01-sistema-login
PORT=3000
```

### 4. Instalar dependências
```bash
cd projetos-base/api-backend
npm install
```

### 5. Testar
- Use a página de "Esqueci a senha"
- Informe um e-mail qualquer
- Vá ao Mailtrap → veja o e-mail recebido no inbox
- Clique no link para redefinir a senha

## 🎯 Alternativas:

| Serviço | Gratuito | Uso | Link |
|---------|----------|-----|------|
| **Mailtrap** | ✅ | Testes (50 emails/mês) | https://mailtrap.io |
| **Gmail** | ✅ | Produção (com app password) | https://myaccount.google.com/apppasswords |
| **SendGrid** | ✅ | Produção (100 emails/dia) | https://sendgrid.com |
| **Resend** | ✅ | Moderno, transacional | https://resend.com |

## 📝 Notas importantes:

- **Mailtrap para desenvolvimento**: Ideal para testes locais, não envia para e-mails reais
- **Gmail para produção**: Precisa de 2FA + app password
- **E-mails reais**: Use SendGrid, Resend ou similar em produção

## ❓ Dúvidas?

Se o nodemailer estiver com erro, reinstale:
```bash
npm install nodemailer
```

Pronto! Seu sistema de recuperação de senha está funcionando! 🎉
