# 🕵️‍♂️ Guia de Bugs & Gabarito do Professor - LojaQA

> **Documento de Apoio ao Professor / Avaliador**  
> **Programa FAP 2026 - Turma 4 | Teste de Software**  
> **Orientador:** Prof. Alison Melo  
> **Finalidade:** Gabarito com todos os bugs funcionais (incluindo bugs críticos de negócio), visuais e de segurança para correção das entregas dos alunos.

---

## 📌 1. Tabela Resumo dos Bugs Mapeados no Sistema

| ID do Bug | Módulo | Categoria | Descrição do Problema | Critério Violado | Severidade |
|---|---|---|---|---|---|
| **BUG-01** | Checkout | **Funcional / Financeiro** | Cupom `FRETEGRATIS` **zera todo o subtotal** dos produtos, tornando o pedido **R$ 0,00** | `CA-CHK-05` | 🔴 **CRÍTICA (Blocker)** |
| **BUG-02** | Checkout | **Funcional / Algoritmo** | Validador de CPF aceita números com **dígitos repetidos** (`111.111.111-11`) como Válido | `CA-CHK-01` | 🔴 **CRÍTICA** |
| **BUG-03** | Checkout | **Funcional / Cálculo** | Cupom `ALUNOQA` desconta **R$ 35,00**, mas o rótulo exibe **R$ 30,00** (erro de R$ 5) | `CA-CHK-05` | 🟠 **ALTA** |
| **BUG-04** | Checkout | **Validação / Negativo** | Formulário de cartão aceita **data de validade vencida no passado** (ex: `01/20`) | `CA-CHK-07` | 🟠 **ALTA** |
| **BUG-05** | Vitrine | **Funcional / BVA** | Filtro de preço máximo usa `<` estrito em vez de `<=`, ocultando produtos de valor exato | `CA-CAT-05` | 🟡 **MÉDIA** |
| **BUG-06** | Cadastro | **Validação / Sanitização** | Campo de nome aceita números e caracteres especiais (ex: `Aluno123 @#$`) | `RN02 / CA-AUTH-01` | 🟡 **MÉDIA** |
| **BUG-07** | Painel | **Visual / UI** | Modal de Pedido exibe status **"APROVADO" com badge vermelho** de bloqueado | `CA-PNL-01` | 🟡 **MÉDIA** |
| **BUG-08** | Checkout | **Visual / Acessibilidade** | Tag de desconto do PIX tem texto branco sobre fundo amarelo claro (WCAG) | `CA-CHK-06` | 🟡 **MÉDIA** |
| **BUG-09** | Checkout | **Visual / UX** | Topo do Resumo exibe quantidade de linhas/tipos em vez do total de unidades | `CA-CAR-05` | 🟢 **BAIXA** |
| **BUG-10** | Painel | **Visual / Formatação** | Frete no modal exibe valor sem zero decimal (`R$ 16.9` em vez de `R$ 16,90`) | `CA-PNL-01` | 🟢 **BAIXA** |
| **BUG-11** | Checkout | **Visual / UI** | Campo "Complemento" força digitação em caixa alta (UPPERCASE) | `CA-CHK-01` | 🟢 **BAIXA** |
| **BUG-12** | Backend | **Concorrência / Backend** | *Race Condition* de estoque em compras simultâneas sem transação ACID | `RN09` | 🔴 **CRÍTICA** |
| **BUG-13** | Carrinho | **Segurança / UI** | Permite adulteração visual de preços alterando o `localStorage` no DevTools | `CA-CAR-02` | 🟡 **MÉDIA** |
| **BUG-14** | Backend | **Segurança / Dados** | Senhas de usuários armazenadas em texto puro sem hash criptográfico (*bcrypt*) | `RN01` | 🔴 **CRÍTICA** |

---

## 🔍 2. Detalhamento dos Bugs Principais & Evidências

---

### 🔴 BUG-01 (CRÍTICO): Cupom `FRETEGRATIS` Zerando o Subtotal Inteiro do Pedido
* **Módulo:** Checkout Dedicado (`checkout.html` / `checkout.js`)
* **Critério de Aceite Violado:** `CA-CHK-05` (O cupom de frete grátis deve isentar exclusivamente o valor do frete).
* **Severidade:** 🔴 **CRÍTICA / BLOCKER (Prejuízo Financeiro Imediato)**.
* **Passos para Reproduzir:**
  1. Adicionar ao carrinho produtos de alto valor (ex: Notebook ou Teclado de R$ 350,00).
  2. Acessar `/checkout.html`.
  3. No campo de cupom de desconto, digitar `FRETEGRATIS` e clicar em *"Aplicar"*.
  4. Observar a tabela de preços do Resumo do Pedido e o valor do Total Final.
* **Comportamento Observado (Bug):**
  - O sistema aplica um desconto igual ao subtotal completo das mercadorias, fazendo com que o **Total Final fique R$ 0,00**! O cliente consegue finalizar a compra de produtos caros gratuitamente.
* **Evidência Esperada do Aluno:** Print do card de resumo com o subtotal de R$ 350,00 e a linha de Desconto zerando a conta para `Total Final: R$ 0,00`.

---

### 🔴 BUG-02 (CRÍTICO): Algoritmo de CPF Aprovando Números com Dígitos Repetidos
* **Módulo:** Checkout Dedicado (`checkout.html` / `checkout.js`)
* **Critério de Aceite Violado:** `CA-CHK-01` e `RN03` (Validação oficial de CPF com rejeição de números repetidos).
* **Severidade:** 🔴 **CRÍTICA (Validação de Documento Oficial)**.
* **Passos para Reproduzir:**
  1. Acessar `/checkout.html`.
  2. No campo CPF, digitar o número fictício com dígitos repetidos: `111.111.111-11` (ou `222.222.222-22`).
* **Comportamento Observado (Bug):**
  - O sistema exibe o badge verde `"CPF Válido"` e libera a finalização da compra, violando a regra oficial da Receita Federal que invalida CPFs de dígitos iguais.
* **Evidência Esperada do Aluno:** Print do formulário com o CPF `111.111.111-11` exibindo badge verde de aprovação.

---

### 🟠 BUG-03 (ALTA): Divergência de Cálculo no Cupom `ALUNOQA` (R$ 35 vs R$ 30)
* **Módulo:** Checkout Dedicado (`checkout.html` / `checkout.js`)
* **Critério de Aceite Violado:** `CA-CHK-05` (O cupom `ALUNOQA` deve conceder R$ 30,00 de desconto).
* **Severidade:** 🟠 **ALTA (Cálculo Financeiro)**.
* **Passos para Reproduzir:**
  1. Adicionar produto de R$ 200,00 ao carrinho e ir ao checkout.
  2. Digitar `ALUNOQA` e aplicar.
* **Comportamento Observado (Bug):**
  - O rótulo exibe `(-R$ 30)`, porém o cálculo deduz **R$ 35,00** no total final (diferença de R$ 5,00).
* **Evidência Esperada:** Print evidenciando a inconsistência matemática entre rótulo e subtotal.

---

### 🟠 BUG-04 (ALTA): Formulário Aceita Cartão de Crédito com Validade Vencida
* **Módulo:** Checkout Dedicado (`checkout.html` / `checkout.js`)
* **Critério de Aceite Violado:** `CA-CHK-07` (Validação de data de validade de cartão de crédito).
* **Severidade:** 🟠 **ALTA**.
* **Passos para Reproduzir:**
  1. No checkout, selecionar Cartão de Crédito.
  2. Preencher número válido, nome e CVV `123`.
  3. No campo Validade, digitar data no passado (ex: `01/20`).
  4. Clicar em *"Confirmar e Finalizar Pedido"*.
* **Comportamento Observado (Bug):**
  - O pedido é processado e criado com sucesso sem acusar cartão expirado.
* **Evidência Esperada:** Print com o campo de validade vencido e o modal de pedido concluído.

---

### 🟡 BUG-05 (MÉDIA): Filtro de Preço Máximo Oculta Produtos de Valor Exato ao Limite
* **Módulo:** Vitrine / Catálogo (`loja.html` / `loja.js`)
* **Critério de Aceite Violado:** `CA-CAT-05` (Análise de Valor Limite / BVA).
* **Severidade:** 🟡 **MÉDIA**.
* **Passos para Reproduzir:**
  1. Localizar um produto que custa exatamente R$ 150,00.
  2. Ajustar o filtro de preço máximo para exatamente `R$ 150,00`.
* **Comportamento Observado (Bug):**
  - O produto de R$ 150,00 desaparece da vitrine por uso incorreto de `<` em vez de `<=`.
* **Evidência Esperada:** Print com o filtro em R$ 150 e a ausência do produto de mesmo valor.

---

### 🟡 BUG-06 (MÉDIA): Cadastro Aceita Números e Símbolos no Nome
* **Módulo:** Autenticação / Cadastro (`login.html` / `script.js`)
* **Critério de Aceite Violado:** `RN02 / CA-AUTH-01`
* **Severidade:** 🟡 **MÉDIA**.
* **Passos para Reproduzir:**
  1. Acessar `login.html` -> *"Criar conta"*.
  2. No campo Nome completo, digitar `Aluno Teste 12345 @#$`.
* **Comportamento Observado (Bug):**
  - O botão *"Cadastrar"* habilita e processa o cadastro sem sanitizar o nome.
* **Evidência Esperada:** Print do formulário preenchido com números e o botão habilitado.

---

### 🟡 BUG-07 (MÉDIA / VISUAL): Status "APROVADO" com Badge Vermelho de Bloqueio
* **Módulo:** Painel do Usuário (`painel.html` / `painel.js`)
* **Critério de Aceite Violado:** `CA-PNL-01`
* **Severidade:** 🟡 **MÉDIA**.
* **Passos para Reproduzir:**
  1. Abrir `painel.html` e clicar em *"Ver Detalhes"* em um pedido aprovado.
* **Comportamento Observado (Bug):**
  - O badge exibe o texto `"APROVADO"`, porém com a cor vermelha/alerta de conta bloqueada (`status blocked`).
* **Evidência Esperada:** Print do modal com a tarja vermelha escrito "APROVADO".

---

### 🟡 BUG-08 (MÉDIA / ACESSIBILIDADE): Tag de Desconto PIX com Baixo Contraste (WCAG)
* **Módulo:** Checkout Dedicado (`checkout.html` / `checkout.css`)
* **Critério de Aceite Violado:** `CA-CHK-06`
* **Severidade:** 🟡 **MÉDIA**.
* **Passos para Reproduzir:**
  1. Observar a aba de pagamento `"PIX"` no checkout.
* **Comportamento Observado (Bug):**
  - A tag `"5% OFF"` usa texto branco sobre fundo amarelo claro (`#fef08a`), ficando quase ilegível.
* **Evidência Esperada:** Print com zoom na aba PIX destacando a ilegibilidade.

---

## 🎯 3. Critérios de Avaliação dos Relatórios dos Alunos

1. **Qualidade do Caso de Teste (CT):**
   * Definição clara de objetivo, pré-condição, passo a passo e resultado esperado;
   * Mapeamento direto com os Critérios de Aceite (`CA-...`).
2. **Capacidade de Identificar Bugs Críticos:**
   * O aluno identificou que o cupom `FRETEGRATIS` deixa a compra gratuita (**BUG-01**)?
   * O aluno testou CPFs repetidos como `111.111.111-11` (**BUG-02**)?
   * O aluno conferiu a matemática do cupom `ALUNOQA` (**BUG-03**)?
3. **Evidência e Classificação:**
   * O aluno soube classificar a gravidade corretamente (Crítica para falha financeira vs Baixa para detalhe visual)?
   * Anexou print com a área do erro demarcada?
