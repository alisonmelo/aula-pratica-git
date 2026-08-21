# 📚 Projeto LojaQA - Especificação de Requisitos, Critérios de Aceite & Guia Oficial de QA

> **Ambiente Pedagógico de Qualidade e Testes de Software**  
> **Programa FAP 2026 - Turma 4 | Teste de Software**  
> **Projeto Final - Módulo 01 (Unidade 08)**  
> **Orientador:** Prof. Alison Melo  
> **Versão:** 3.0 (Alinhado à Ementa Oficial do Módulo 01: Técnicas, Heurísticas, BDD, Não-Funcionais e Gestão de Testes)

---

## 1. Contextualização do Sistema (Visão de Negócio)

* **Nome do Sistema:** LojaQA E-commerce Platform
* **Público-Alvo:** Consumidores finais de produtos eletrônicos/tecnologia e lojistas parceiros (*Marketplace*).
* **Importância para o Negócio:** Plataforma central de geração de receita, catálogo de produtos, integração de meios de pagamento digitais (PIX, Cartão e Boleto) e logística de entrega integrada com os Correios.
* **Arquitetura da Aplicação:**
  * **Vitrine Pública:** `loja.html` (Catálogo, busca, filtros e carrinho persistente);
  * **Autenticação Segura:** `login.html` (Login com rate-limiting, cadastro e recuperação de senha);
  * **Checkout Dedicado:** `checkout.html` (Validação de CPF por Módulo 11, ViaCEP, frete regional e pagamentos);
  * **Painel Multi-Perfil:** `painel.html` (Clientes, Lojistas e Administrador);
  * **Backend REST:** Node.js/Express e MongoDB com autenticação JWT.

---

## 2. Perfis de Usuário e Matriz de Permissões (RBAC)

| Perfil | Descrição | Permissão de Compra | Gestão de Catálogo | Gestão Administrativa |
|---|---|---|---|---|
| `user` (Cliente) | Consumidor da loja | **Sim** (carrinho, checkout, cálculo de frete e histórico de pedidos) | **Não** | **Não** (apenas o próprio perfil) |
| `seller` (Lojista) | Vendedor parceiro da plataforma | **Não** (apenas visualiza a vitrine como vitrine de catálogo) | **Sim** (cadastra/edita apenas produtos da sua própria loja) | **Não** (apenas pedidos contendo produtos da sua loja) |
| `admin` (Administrador) | Gestor global do sistema | **Não** (apenas visualiza a vitrine em modo de auditoria) | **Sim** (audita e gerencia todos os produtos de todas as lojas) | **Sim** (gestão de usuários, lojas, pedidos e métricas) |
| `blocked` (Bloqueado) | Usuário com credenciais suspensas | **Não** (acesso bloqueado) | **Não** (acesso bloqueado) | **Não** (acesso bloqueado pela API e frontend) |

---

## 3. Análise de Riscos e Impactos de Negócio

| Área de Risco | Possível Defeito Crítico | Impacto para o Usuário | Impacto para o Negócio | Relação Custo do Defeito |
|---|---|---|---|---|
| **Financeiro / Checkout** | Cupom zerando o subtotal ou cálculo divergente | Cobrança indevida ou compra gratuita não autorizada | Prejuízo financeiro direto e perda de margem | **Crítico:** Descoberto em produção gera dano imediato |
| **Documentação / Fraude** | Aceitação de CPF inválido ou repetido | Usuário cadastra dados falsos sem auditoria | Invalidação fiscal e risco de estorno/fraude | **Alto:** Dificulta faturamento e entrega |
| **Logística / Entrega** | Erro de cálculo de CEP/Frete | Prazo não cumprido ou frete cobrado a menor | Prejuízo com transportadora e insatisfação | **Médio/Alto:** Custo de suporte e devolução |
| **Segurança / Multi-Tenancy**| Lojista adulterando produtos de concorrentes | Dados de outra loja expostos | Quebra de contrato e vazamento de dados | **Crítico:** Risco jurídico e reputacional |

---

## 4. Massa de Dados e Credenciais para Testes QA

### 👤 Usuários de Teste

| Perfil | E-mail | Senha | Objetivo do Teste |
|---|---|---|---|
| **Admin** | `admin@system.com` | `AdminPassword123` | Moderação global, alteração de perfis e auditoria |
| **Cliente** | `user@system.com` | `UserPassword123` | Fluxo de compra, carrinho, checkout e histórico |
| **Lojista** | `lojista@system.com` | `SellerPass123` | Gestão de estoque e catálogo da própria loja |
| **Bloqueado** | `blocked@system.com` | `Blocked123` | Validação de bloqueio de acesso e mensagens de segurança |
| **Lento** | `slow@system.com` | `SlowPass123` | Teste de latência artificial (3s), feedback visual e carga |

### 🎟️ Cupons de Teste

| Código do Cupom | Tipo de Benefício | Regra de Aplicação |
|---|---|---|
| `QA10` | 10% OFF | Aplicado sobre o subtotal dos produtos |
| `QA20` | 20% OFF | Aplicado sobre o subtotal dos produtos |
| `FRETEGRATIS` | Frete Grátis | Zera o valor do frete na modalidade PAC |
| `ALUNOQA` | R$ 30,00 OFF | Desconto fixo de R$ 30,00 no total |

### 📍 CEPs de Referência para Testes de Frete e ViaCEP

| CEP | Localidade / UF | Região | Frete PAC Esperado | Prazo Estimado |
|---|---|---|---|---|
| `01310-100` | São Paulo - SP | Sudeste | R$ 16,90 | 3 a 5 dias úteis |
| `80010-000` | Curitiba - PR | Sul | R$ 22,90 | 5 a 8 dias úteis |
| `50010-000` | Recife - PE | Nordeste | R$ 27,90 | 7 a 10 dias úteis |
| `69005-000` | Manaus - AM | Norte | R$ 34,90 | 10 a 15 dias úteis |
| `00000-000` | Inválido | Inexistente | Erro controlado | "CEP não encontrado" |

### 🔢 CPFs para Testes de Algoritmo Módulo 11

| CPF de Teste | Validade | Comportamento Esperado |
|---|---|---|
| `111.444.777-35` | ✅ Válido | Badge verde "CPF Válido" e avanço liberado |
| `529.982.247-25` | ✅ Válido | Badge verde "CPF Válido" e avanço liberado |
| `123.456.789-00` | ❌ Inválido | Badge vermelho "CPF Inválido" (dígito verificador incorreto) |
| `111.111.111-11` | ❌ Inválido | Rejeitado por dígitos repetidos |

---

## 5. Critérios de Aceite por Módulo (Base para os seus CTs)

### 📦 Módulo 1: Catálogo & Vitrine Pública (`loja.html`)
* **CA-CAT-01:** Visitantes não autenticados devem conseguir visualizar todos os produtos com status ativo.
* **CA-CAT-02:** Cada card deve exibir imagem, nome, código identificador (`#PROD-...`), categoria, badge da loja parceira, preço formatado em `R$` e badge de estoque.
* **CA-CAT-03:** A busca em tempo real deve filtrar produtos por correspondência parcial no nome ou na descrição.
* **CA-CAT-04:** Quando uma busca não retornar resultados, exibir mensagem amigável de estado vazio (*empty state*).
* **CA-CAT-05:** Os filtros de categoria e preço máximo devem operar de forma combinada e instantânea (incluindo valores iguais ao limite).
* **CA-CAT-06:** Produtos com estoque zero (`stock: 0`) devem exibir badge vermelho `"Esgotado"` e botão desabilitado.

### 🛒 Módulo 2: Carrinho de Compras Drawer
* **CA-CAR-01:** Visitante deve conseguir adicionar produtos ao carrinho sem login prévio.
* **CA-CAR-02:** O carrinho deve persistir no `localStorage`, sobrevivendo a recarregamentos de página (`F5`).
* **CA-CAR-03:** A quantidade no carrinho não pode ultrapassar o limite disponível em estoque no momento.
* **CA-CAR-04:** Ao decrementar a quantidade para zero, o item deve ser removido do carrinho.
* **CA-CAR-05:** O subtotal do carrinho deve ser recalculado automaticamente a cada alteração.

### 🔐 Módulo 3: Autenticação, Autorização e Sessão (RBAC)
* **CA-AUTH-01:** Senhas devem ter obrigatoriamente entre **8 e 25 caracteres**.
* **CA-AUTH-02:** Bloqueio temporário após 3 falhas consecutivas de login por 1 minuto.
* **CA-AUTH-03:** Usuários com perfil `blocked` não devem conseguir autenticar.
* **CA-AUTH-04:** Tentativa de compra sem login deve redirecionar para `login.html?return=checkout` e retornar após sucesso.
* **CA-AUTH-05:** Usuários logados como `seller` ou `admin` **não podem realizar compras**.
* **CA-AUTH-06:** Logout deve limpar o `localStorage` e o botão "Voltar" não pode reabrir o painel.

### 💳 Módulo 4: Checkout Dedicado (`checkout.html`)
* **CA-CHK-01:** CPF deve formatar máscara e validar dígitos verificadores por **Módulo 11** com rejeição de repetidos.
* **CA-CHK-02:** CEP deve consultar o **ViaCEP** e auto-preencher Logradouro, Bairro, Cidade e UF ao digitar 8 números.
* **CA-CHK-03:** Opções de frete (PAC, SEDEX, Retirada) devem refletir prazos e valores da região do CEP.
* **CA-CHK-04:** Compras $\ge$ R$ 250,00 recebem Frete Grátis automático na modalidade PAC.
* **CA-CHK-05:** Cupom deve validar códigos (`QA10`, `QA20`, `FRETEGRATIS`, `ALUNOQA`) e recalcular valores com exatidão matemática.
* **CA-CHK-06:** Pagamento via PIX aplica **5% de desconto** no subtotal e gera código Copia e Cola.
* **CA-CHK-07:** Pagamento com Cartão identifica bandeira e valida data de validade futura (`MM/AA`) e CVV.
* **CA-CHK-08:** Confirmação cria pedido na API (`POST /api/orders`), baixa estoque, limpa carrinho e redireciona para o modal com rastreio.

### 📊 Módulo 5: Painéis de Gestão (`painel.html`)
* **CA-PNL-01 (Cliente):** Visualização de pedidos, timeline de rastreio e botão de impressão de comprovante.
* **CA-PNL-02 (Lojista):** Cadastrar e editar **exclusivamente** os produtos pertencentes à sua loja (*Multi-Tenancy*).
* **CA-PNL-03 (Admin):** Gestão global de usuários, alteração de perfis com senha de admin e moderação geral.

---

## 6. Técnicas de Teste de Caixa-Preta (Aplicação Prática)

Os alunos devem aplicar as técnicas clássicas de teste de software para derivar seus Casos de Teste:

### 1️⃣ Particionamento de Equivalência (EP - Equivalence Partitioning)
* **Campo Senha (8 a 25 caracteres):**
  * *Classe Válida:* `8 a 25 caracteres` (ex: `Senha1234`)
  * *Classe Inválida 1:* `< 8 caracteres` (ex: `1234567`)
  * *Classe Inválida 2:* `> 25 caracteres` (ex: `12345678901234567890123456`)
* **Campo CPF:**
  * *Classe Válida:* CPF oficial com dígitos verificadores corretos.
  * *Classe Inválida:* CPF com 11 dígitos repetidos (`111.111.111-11`) ou dígitos incorretos.

### 2️⃣ Análise de Valor Limite (BVA - Boundary Value Analysis)
* **Estoque de Produto ($N$ unidades disponíveis):**
  * *Limite Inferior:* $0$ (Produto esgotado - Botão desabilitado).
  * *Limite Mínimo Válido:* $1$ unidade no carrinho.
  * *Limite Máximo Válido:* $N$ unidades no carrinho.
  * *Limite Inválido Acima:* $N + 1$ unidades no carrinho (Bloqueio com mensagem de estoque insuficiente).
* **Filtro de Preço Máximo:**
  * Testar o valor exatamente igual ao preço do produto (ex: R$ 150,00 no slider para produto de R$ 150,00).

### 3️⃣ Transição de Estados (State Transition Testing)
* **Ciclo de Vida do Pedido:**
  ```text
  [Carrinho] ──> [Checkout] ──> [Aprovado] ──> [Em Preparação] ──> [A Caminho] ──> [Entregue]
  ```
* Testar a progressão visual do Stepper de Rastreamento no modal conforme o status do pedido evolui.

---

## 7. Heurísticas de Testes Exploratórios (Guia Prático)

Para as **Sessões de Testes Exploratórios**, utilize as seguintes heurísticas consagradas de QA:

1. **Heurística CRUD (Create, Read, Update, Delete):**
   * Testar criação de produto pelo lojista, visualização na vitrine, edição de preço/estoque e exclusão/desativação.
2. **Heurística Goldilocks (Muito pequeno, Muito grande, Na medida):**
   * Inserir nomes com 1 caractere, 50 caracteres e 100 caracteres;
   * Compras de R$ 1,00, R$ 250,00 (limiar de frete grátis) e R$ 10.000,00.
3. **Heurística de Interrupção / Navegação Destrutiva:**
   * Clicar no botão "Voltar" do navegador após finalizar compra ou após logout;
   * Recarregar a página (`F5`) no meio do preenchimento do checkout.
4. **Heurística de Concorrência & Latência:**
   * Utilizar o usuário `slow@system.com` e clicar múltiplas vezes seguidas no botão de submit para verificar prevenção de cliques duplos (*Double Submit*).
5. **Heurística de Acessibilidade & Contraste (WCAG):**
   * Inspecionar legibilidade de badges, contrastes de cores de botões e navegação via teclado (`Tab`).

---

## 8. Exemplo de BDD / Gherkin vs Caso de Teste Tradicional

### 📝 Abordagem Tradicional (Caso de Teste Clássico)
```text
ID: CT-CHK-05
Título: Aplicar cupom de desconto percentual QA10 no checkout
Pré-condição: Carrinho com subtotal de R$ 200,00 e usuário autenticado no checkout
Passos:
  1. Digitar "QA10" no campo de cupom.
  2. Clicar no botão "Aplicar".
Resultado Esperado: O sistema exibe mensagem de sucesso, aplica 10% de desconto (- R$ 20,00) e recalcula o total final.
```

### 🥒 Abordagem BDD (Gherkin)
```gherkin
Funcionalidade: Aplicação de Cupons Promocionais no Checkout
  Como um cliente da LojaQA
  Eu quero aplicar um cupom de desconto válido
  Para reduzir o valor final da minha compra

  Cenário: Aplicação bem-sucedida de cupom de 10% de desconto
    Dado que estou na página de checkout com subtotal de "R$ 200,00"
    Quando eu informo o código de cupom "QA10"
    E clico no botão "Aplicar"
    Então o sistema deve exibir a mensagem "Cupom QA10 (-10%) ativado!"
    E o valor do desconto deve ser de "R$ 20,00"
    E o total final deve ser recalculado para "R$ 180,00" mais o frete

  Cenário: Tentativa de aplicação de cupom inexistente
    Dado que estou na página de checkout
    Quando eu informo o código de cupom "CUPOM_INVALIDO_999"
    E clico no botão "Aplicar"
    Então o sistema deve exibir o alerta "Cupom inválido"
    E nenhum desconto deve ser aplicado ao total
```

---

## 9. Ciclos e Níveis de Teste

| Ciclo | Objetivo | Foco na LojaQA |
|---|---|---|
| **Smoke Test (Teste de Fumaça)** | Validar a estabilidade básica dos fluxos críticos | Login com sucesso, carregamento da vitrine, adição de item e acesso ao checkout. |
| **Sanity Test (Teste de Sanidade)** | Validar rapidamente uma funcionalidade específica após ajuste | Validação do cálculo de frete após troca de CEP ou aplicação de cupom. |
| **Regression Test (Teste de Regressão)** | Garantir que correções não geraram efeitos colaterais | Execução completa da suíte cobrindo todos os fluxos de ponta a ponta. |

---

## 10. Manual vs Automatizável (Decisão de Automação / ROI)

| Cenário de Teste | Tipo Recomendado | Justificativa Técnica |
|---|---|---|
| Login com credenciais válidas / inválidas | **Automatizável (E2E / API)** | Alto volume de repetição e caminho crítico de regressão. |
| Cálculo de frete e validação de CPF | **Automatizável (Unitário / API)** | Lógica determinística e regras matemáticas com baixo custo de automação. |
| Usabilidade visual e acessibilidade de cores | **Manual (Exploratório)** | Depende de julgamento humano, percepção visual e testes de experiência. |
| Fluxo completo de compra (End-to-End) | **Automatizável (Cypress / Playwright)** | Teste crítico de fumaça e regressão contínua para pipelines de CI/CD. |
