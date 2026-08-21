# FAP 2026 - Turma 4 | Teste de Software

Bem-vindo ao repositório da turma 4 do Programa FAP 2026, da trilha de Teste de Software, sob a orientação do professor Alison Melo.

Este espaço foi criado para reunir atividades, códigos, automações, exercícios e projetos desenvolvidos em sala de aula, de forma organizada e inspirada em um ambiente de trabalho real.

## 🎯 Objetivo do repositório

Aqui, nossa turma registra tudo o que produzimos ao longo do processo de aprendizado, simulando um cenário real de desenvolvimento e qualidade de software. O objetivo é construir um histórico de estudos, práticas e entregas que possam servir como base para o crescimento profissional e para a composição de um portfólio sólido.

## 🧠 O que encontramos aqui

Neste repositório você poderá acompanhar:

- atividades práticas realizadas em sala;
- exemplos de códigos e soluções desenvolvidas;
- automações e scripts de apoio;
- exercícios voltados a boas práticas de teste e qualidade;
- projetos em diferentes etapas de evolução;
- aprendizados aplicados em um contexto semelhante ao mercado.

## 🚀 Por que este repositório é importante

Este projeto representa muito mais do que um simples espaço para armazenar arquivos. Ele é uma forma de aproximar a realidade do trabalho com a prática acadêmica, permitindo que os alunos aprendam conceitos fundamentais como:

- estrutura de branches;
- criação e uso de Pull Requests (PRs);
- organização de repositórios;
- trabalho colaborativo;
- fluxo de desenvolvimento em equipe;
- boas práticas de versionamento e documentação.

Ao longo da jornada, cada contribuição ajuda a fortalecer a compreensão de como projetos reais funcionam, com processos, entregas e evolução contínua.

## 🛠️ Ferramentas e tecnologias

Aqui vamos explorar diversas linguagens de programação, ferramentas e abordagens, como:

- Python;
- JavaScript/TypeScript;
- Java;
- automações;
- testes e validação;
- ferramentas de qualidade e organização de projetos.

A ideia é construir um ambiente rico, diversificado e alinhado com as demandas do mercado de tecnologia.

## 🔐 Configuração de ambiente e deploy

Este projeto possui duas camadas distintas:

- Frontend estático: pode ser publicado no GitHub Pages;
- Backend/API: precisa de variáveis de ambiente, como `.env`, para funcionar corretamente.

Importante: o GitHub Pages não lê arquivos `.env` do navegador, porque ele serve apenas arquivos estáticos. O `.env` do backend é usado pelo Node.js/Express em tempo de execução no servidor da API.

Em outras palavras:

- GitHub Pages: não quebra por não ter `.env` no frontend estático;
- backend em Render/Node: quebra se faltar o `.env`, porque ele precisa do MongoDB, JWT e SMTP para funcionar.

Além disso, as regras atuais de validação aplicadas ao sistema são:

- Nome: até 50 caracteres;
- Senha: entre 8 e 25 caracteres;
- E-mail: validação por regex.

## 🛒 Projeto LojaQA (E-commerce & Lab QA)

A evolução do e-commerce está documentada em detalhes em [PROJETO-LOJA-QA.md](PROJETO-LOJA-QA.md).

### Estrutura de Telas do Sistema:
- **Vitrine Pública:** [loja.html](projetos-base/01-sistema-login/loja.html) (Catálogo, busca, filtros de categoria/preço e drawer do carrinho);
- **Autenticação:** [login.html](projetos-base/01-sistema-login/login.html) (Login, cadastro com seleção de tipo de conta e recuperação de senha);
- **Checkout Dedicado:** [checkout.html](projetos-base/01-sistema-login/checkout.html) (Identificação do comprador com validação algorítmica de CPF por Módulo 11, consulta de endereço via API ViaCEP, cálculo regional de frete e prazos, cupons de desconto e simulação de Cartão, PIX 5% OFF e Boleto);
- **Painel & Gestão:** [painel.html](projetos-base/01-sistema-login/painel.html) (Painel adaptativo para Clientes com timeline de rastreamento e comprovante impresso, Lojistas para gestão de produtos da loja, e Administradores com moderação global).

### Perfis de Acesso (RBAC):
- `user` (Cliente): compra, calcula frete e acompanha pedidos;
- `seller` (Lojista): gerencia a própria loja e catálogo (bloqueado para compra);
- `admin` (Administrador): controle global e auditoria (bloqueado para compra);
- `blocked` (Suspenso): acesso negado.

### Deploy do backend no Render

No serviço da API, configure:

- Branch: `final-modulo1` (ou o branch que contenha a implementação LojaQA);
- Root Directory: `projetos-base/api-backend`;
- Build Command: `npm install`;
- Start Command: `npm start`;
- Health check: `/api/health`.

Depois do redeploy, `https://api-qa-fap2026.onrender.com/api/health` deve retornar `{"service":"lojaqa-api","version":"2.0","status":"ok"}`. Se `/api/products` retornar `404`, o Render ainda está executando a versão antiga do backend.

## 📚 Propósito pedagógico

Este repositório também funciona como um histórico de aprendizagem, registrando tudo o que foi produzido ao longo do curso. Ele pode ser utilizado futuramente como referência para:

- estudos;
- revisão de conteúdos;
- apresentação de trabalhos;
- construção de portfólio;
- demonstração de evolução técnica e profissional.

## 🌱 Caminho de aprendizagem

Cada etapa aqui registrada representa um passo importante na formação da turma. O objetivo é transformar a prática em conhecimento, e o conhecimento em experiência aplicável ao mundo real.

## 👨‍🏫 Responsável

Professor Alison Melo

## ✨ Mensagem final

Este repositório é um espaço de aprendizagem, colaboração, evolução e construção de carreira. Aqui, cada arquivo, cada commit e cada projeto fazem parte de uma jornada que aproxima a turma do universo profissional de tecnologia e testes de software.

Seja bem-vindo(a) e aproveite essa caminhada de aprendizado.
