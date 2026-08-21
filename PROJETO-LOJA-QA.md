# 📚 Projeto LojaQA - Especificação de Requisitos, Critérios de Aceite & Guia de QA

> **Ambiente Pedagógico de Qualidade e Testes de Software**  
> **Programa FAP 2026 - Turma 4 | Teste de Software**  
> **Orientador:** Prof. Alison Melo  
> **Versão:** 2.5 (Edição com Checkout Dedicado, RBAC e Validações Reais)

---

## 1. Visão Geral do Produto

A **LojaQA** é uma plataforma de e-commerce voltada para o treinamento prático de Engenharia de Qualidade de Software (QA). O sistema simula um ambiente corporativo real com:

* **Vitrine Pública Desacoplada** (`loja.html`) com busca, filtros de categoria e preço, e drawer de carrinho em `localStorage`.
* **Central de Autenticação Segura** (`login.html`) com controle de tentativas, seleção de perfil e recuperação de senha.
* **Checkout Dedicado** (`checkout.html`) em 2 colunas com validação algorítmica de CPF (**Módulo 11**), consulta de endereço na API dos Correios (**ViaCEP**), frete regional dinâmico, cupons de desconto e simulação de pagamentos (**Cartão com detecção de bandeira, PIX com 5% OFF e Boleto bancário**).
* **Painel Adaptativo por Perfil (RBAC)** (`painel.html`) para Clientes (rastreamento de pedidos e impressão de comprovante), Lojistas (gestão isolada de produtos) e Administradores (moderação global).

---

## 2. Perfis de Usuário e Matriz de Permissões (RBAC)

| Perfil | Descrição | Permissão de Compra | Permissão de Gestão de Catálogo | Gestão Administrativa |
|---|---|---|---|---|
| `user` (Cliente) | Consumidor da loja | **Sim** (carrinho, checkout, cálculo de frete e histórico de pedidos) | **Não** | **Não** (apenas o próprio perfil) |
| `seller` (Lojista) | Vendedor parceiro da plataforma | **Não** (apenas visualiza a vitrine como vitrine de catálogo) | **Sim** (cadastra/edita apenas produtos da sua própria loja) | **Não** (apenas pedidos contendo produtos da sua loja) |
| `admin` (Administrador) | Gestor global do sistema | **Não** (apenas visualiza a vitrine em modo de auditoria) | **Sim** (audita e gerencia todos os produtos de todas as lojas) | **Sim** (gestão de usuários, lojas, pedidos e métricas) |
| `blocked` (Bloqueado) | Usuário com credenciais suspensas | **Não** (acesso bloqueado) | **Não** (acesso bloqueado) | **Não** (acesso bloqueado pela API e frontend) |

---

## 3. Massa de Dados e Credenciais para Testes QA

### 👤 Usuários de Teste

| Perfil | E-mail | Senha | Objetivo do Teste |
|---|---|---|---|
| **Admin** | `admin@system.com` | `AdminPassword123` | Moderação global, alteração de perfis e auditoria |
| **Cliente** | `user@system.com` | `UserPassword123` | Fluxo de compra, carrinho, checkout e histórico |
| **Lojista** | `lojista@system.com` | `SellerPass123` | Gestão de estoque e catálogo da própria loja |
| **Bloqueado** | `blocked@system.com` | `Blocked123` | Validação de bloqueio de acesso e mensagens de segurança |
| **Lento** | `slow@system.com` | `SlowPass123` | Testes de latência, resiliência e feedback de carregamento |

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

## 4. Critérios de Aceite por Módulo (Base para Escrita dos seus CTs)

> **Atenção Aluno de QA:** Estes critérios de aceite definem o comportamento obrigatório do sistema. Cada critério deve ser coberto por um ou mais Casos de Teste (CTs) criados por você!

### 📦 Módulo 1: Catálogo & Vitrine Pública (`loja.html`)
* **CA-CAT-01:** Visitantes não autenticados devem conseguir visualizar todos os produtos com status ativo.
* **CA-CAT-02:** Cada card de produto deve exibir imagem, nome, código identificador (`#PROD-...`), categoria, badge da loja parceira, preço formatado em `R$` e badge de estoque.
* **CA-CAT-03:** A busca em tempo real deve filtrar produtos por correspondência parcial no nome ou na descrição.
* **CA-CAT-04:** Quando uma busca não retornar resultados, o sistema deve apresentar uma mensagem amigável de estado vazio (*empty state*).
* **CA-CAT-05:** Os filtros de categoria e preço máximo devem operar de forma combinada e instantânea.
* **CA-CAT-06:** Produtos com estoque zero (`stock: 0`) devem exibir badge vermelho `"Esgotado"` e o botão de compra deve permanecer desabilitado.

### 🛒 Módulo 2: Carrinho de Compras Drawer
* **CA-CAR-01:** O visitante deve conseguir adicionar produtos ao carrinho sem necessidade de login.
* **CA-CAR-02:** O carrinho deve persistir no `localStorage`, sobrevivendo a recarregamentos de página (`F5`).
* **CA-CAR-03:** A quantidade de um item no carrinho não pode ultrapassar o limite disponível em estoque no momento.
* **CA-CAR-04:** Ao decrementar a quantidade de um item para zero, o item deve ser removido do carrinho.
* **CA-CAR-05:** O subtotal do carrinho deve ser recalculado automaticamente a cada alteração de quantidade ou exclusão de produto.

### 🔐 Módulo 3: Autenticação, Autorização e Sessão (RBAC)
* **CA-AUTH-01:** Senhas de acesso devem ter obrigatoriamente entre **8 e 25 caracteres**.
* **CA-AUTH-02:** O sistema deve bloquear temporariamente tentativas após 3 falhas consecutivas de login por 1 minuto.
* **CA-AUTH-03:** Usuários com perfil `blocked` não devem conseguir autenticar na aplicação.
* **CA-AUTH-04:** Se um usuário não autenticado tentar finalizar a compra, o sistema deve redirecioná-lo para `login.html?return=checkout` e retorná-lo ao checkout após login bem-sucedido.
* **CA-AUTH-05:** Usuários logados como `seller` (Lojista) ou `admin` (Administrador) **não podem realizar compras** e devem receber avisos explicativos.
* **CA-AUTH-06:** Ao efetuar logout, o `localStorage` deve ser limpo e o botão "Voltar" do navegador não pode permitir reabrir telas restritas.

### 💳 Módulo 4: Checkout Dedicado (`checkout.html`)
* **CA-CHK-01:** O campo de CPF deve formatar a máscara `000.000.000-00` e validar os dígitos verificadores pelo **Módulo 11**, exibindo feedback claro abaixo do campo.
* **CA-CHK-02:** O campo de CEP deve consultar a API do **ViaCEP** e auto-preencher Logradouro, Bairro, Cidade e UF ao digitar 8 números.
* **CA-CHK-03:** As opções de frete (PAC, SEDEX e Retirada) devem refletir os prazos e valores da região do CEP informado.
* **CA-CHK-04:** Compras com subtotal igual ou superior a R$ 250,00 devem receber Frete Grátis automático na modalidade PAC.
* **CA-CHK-05:** O campo de cupom deve validar os códigos promocionais (`QA10`, `QA20`, `FRETEGRATIS`, `ALUNOQA`) e recalcular o total imediatamente.
* **CA-CHK-06:** O pagamento via PIX deve aplicar automaticamente **5% de desconto** no subtotal e gerar código Copia e Cola.
* **CA-CHK-07:** O pagamento com Cartão de Crédito deve identificar dinamicamente a bandeira (Visa, Master, Elo, Amex, Hipercard) e validar data de validade e CVV.
* **CA-CHK-08:** Ao confirmar o pedido, o sistema deve registrar a compra na API (`POST /api/orders`), baixar o estoque, limpar o carrinho e redirecionar para `painel.html?orderId={id}`, abrindo o modal com os detalhes e rastreio.

### 📊 Módulo 5: Painéis de Gestão (`painel.html`)
* **CA-PNL-01 (Cliente):** O cliente deve visualizar o histórico com seus pedidos, timeline de entrega e botão para imprimir comprovante.
* **CA-PNL-02 (Lojista):** O lojista deve cadastrar e editar **exclusivamente** os produtos pertencentes à sua própria loja.
* **CA-PNL-03 (Lojista):** A API e o painel devem impedir que um lojista edite ou visualize dados de outras lojas parceiras (*Multi-Tenancy Isolation*).
* **CA-PNL-04 (Admin):** O administrador deve ter acesso global para listar usuários, alterar perfis (mediante confirmação de senha de admin) e moderar produtos de todas as lojas.

---

## 5. Padrão de Escrita de Casos de Teste (Padrão QA)

Para estruturar seus Casos de Teste com padrão profissional de mercado, utilize a estrutura recomendada abaixo:

```text
ID do CT: Identificador único (ex: CT-CAT-01, CT-CHK-03)
Título / Cenário: O que está sendo testado de forma clara e objetiva
Módulo / Critério Relacionado: Requisito ou Critério de Aceite coberto (ex: CA-CHK-01)
Tipo de Teste: Funcional / Negativo / Limite (BVA) / Segurança (RBAC) / Usabilidade / Integração
Prioridade / Severidade: Alta / Média / Baixa / Crítica
Pré-condições: Estado inicial necessário antes de iniciar o teste
Massa de Dados: Dados específicos que serão inseridos nos campos
Passo a Passo:
  1. Ação 1
  2. Ação 2
  3. Ação 3
Resultado Esperado: O comportamento exato que o sistema deve apresentar
Pós-condição: Estado em que o sistema deve ficar após a execução
```

---

## 6. Casos de Teste de Exemplo (Modelos de Referência)

Abaixo estão **4 exemplos completos** com diferentes abordagens de teste para servirem de modelo na construção dos seus próprios CTs:

---

### 📝 Exemplo 1: Teste Funcional / Positivo (Carrinho)
* **ID:** `CT-EX01`
* **Título:** Adicionar produto à sacola e validar persistência após recarregamento (F5)
* **Critério Relacionado:** `CA-CAR-01` e `CA-CAR-02`
* **Tipo:** Funcional / Persistência
* **Prioridade:** Alta
* **Pré-condição:** Estar na página `loja.html` deslogado e com carrinho vazio.
* **Massa de Dados:** Produto com estoque disponível (ex: Mouse Gamer Tech, R$ 150,00).
* **Passos:**
  1. Na vitrine, localizar o produto e clicar no botão *"Adicionar ao carrinho"*.
  2. Verificar se o drawer lateral do carrinho abriu com o item e quantidade `1`.
  3. Fechar o drawer do carrinho.
  4. Pressionar `F5` ou recarregar a página no navegador.
  5. Clicar no ícone da sacola no cabeçalho para reabrir o carrinho.
* **Resultado Esperado:** O produto permanece listado no carrinho com a quantidade `1`, valor correto e subtotal atualizado.
* **Pós-condição:** Carrinho permanece armazenado no `localStorage`.

---

### 📝 Exemplo 2: Teste Negativo / Análise de Valor Limite - BVA (Estoque)
* **ID:** `CT-EX02`
* **Título:** Impedir incremento de quantidade no carrinho além do estoque disponível
* **Critério Relacionado:** `CA-CAR-03`
* **Tipo:** Negativo / Boundary Value Analysis (BVA)
* **Prioridade:** Média
* **Pré-condição:** Produto selecionado possui exatamente `2` unidades em estoque.
* **Massa de Dados:** Produto com `stock = 2`.
* **Passos:**
  1. Adicionar o produto ao carrinho (quantidade inicial = 1).
  2. No drawer do carrinho, clicar no botão `+` (quantidade atualizada = 2).
  3. Clicar novamente no botão `+` para tentar solicitar 3 unidades.
* **Resultado Esperado:** O contador de quantidade não avança para 3 e o sistema emite um alerta ao usuário: *"Quantidade maior que o estoque disponível."*
* **Pós-condição:** A quantidade do item no carrinho é mantida em 2.

---

### 📝 Exemplo 3: Teste de Segurança & Autorização (RBAC)
* **ID:** `CT-EX03`
* **Título:** Validar bloqueio de realização de compras para conta com perfil Lojista (`seller`)
* **Critério Relacionado:** `CA-AUTH-05`
* **Tipo:** Segurança / RBAC (Role-Based Access Control)
* **Prioridade:** Crítica
* **Pré-condição:** Usuário autenticado com credenciais de lojista (`lojista@system.com`).
* **Massa de Dados:** E-mail: `lojista@system.com` / Senha: `SellerPass123`.
* **Passos:**
  1. Acessar `loja.html` estando autenticado como lojista.
  2. Observar o texto dos botões nos cards de produtos.
  3. Clicar no botão do card de qualquer produto.
  4. Tentar digitar diretamente na barra de endereço do navegador a URL `/checkout.html`.
* **Resultado Esperado:** Na vitrine, os botões exibem *"Ver Detalhes (Lojista)"*. Ao tentar forçar a rota de checkout, o acesso é barrado com a notificação: *"Conta de Lojista: você pode visualizar produtos, mas não realizar compras."* e o usuário é redirecionado para `painel.html`.
* **Pós-condição:** Nenhuma compra é registrada para o usuário lojista.

---

### 📝 Exemplo 4: Teste de Validação & Integração (ViaCEP e CPF Módulo 11)
* **ID:** `CT-EX04`
* **Título:** Validar preenchimento automático de endereço por CEP e validação de CPF inválido
* **Critério Relacionado:** `CA-CHK-01` e `CA-CHK-02`
* **Tipo:** Validação de Dados / Integração Externa
* **Prioridade:** Alta
* **Pré-condição:** Cliente autenticado na tela `/checkout.html` com itens no carrinho.
* **Massa de Dados:** CPF: `123.456.789-00` (Inválido) | CEP: `01310-100` (Avenida Paulista, SP).
* **Passos:**
  1. No campo CPF, digitar `12345678900`.
  2. Observar o badge e a mensagem de validação abaixo do input de CPF.
  3. No campo CEP, digitar `01310100` e clicar em *"Buscar CEP"*.
  4. Verificar os campos de Logradouro, Bairro, Cidade e Estado.
  5. Tentar clicar no botão *"Confirmar e Finalizar Pedido"*.
* **Resultado Esperado:**
  - O CPF exibe o badge vermelho `"CPF Inválido"` com aviso de dígitos verificadores incorretos.
  - A API do ViaCEP preenche automaticamente Rua: *"Avenida Paulista"*, Bairro: *"Bela Vista"*, Cidade: *"São Paulo"* e Estado: *"SP"*.
  - O botão de finalizar pedido bloqueia o envio devido ao CPF incorreto.
* **Pós-condição:** Formulário permanece na tela aguardando a correção dos dados.

---

## 7. 🚀 Desafio Prático para os Alunos de QA

Agora é a sua vez de desenrolar a suíte de testes! Com base nos **Critérios de Aceite da Seção 4** e nos **Modelos da Seção 6**, construa a sua própria planilha/documento de Casos de Teste (CTs).

### 📋 Checklist de Cobertura que você deve atingir:
- [ ] **Módulo Vitrine:** CTs para busca exata, busca parcial, busca inexistente e filtros combinados de preço/categoria.
- [ ] **Módulo Carrinho:** CTs para adição, alteração de quantidade, limite de estoque, exclusão ao zerar e carrinho vazio.
- [ ] **Módulo Autenticação:** CTs para login correto de cliente, login de lojista, login de admin, bloqueio por senha incorreta (3 tentativas) e bloqueio de conta `blocked`.
- [ ] **Módulo Checkout:** CTs para CPF válido vs CPF inválido, CEP válido de diferentes regiões (Sudeste vs Nordeste vs Sul), CEP inexistente, cupons (`QA10`, `FRETEGRATIS`, `ALUNOQA`), pagamento no PIX (5% OFF) e Cartão de Crédito.
- [ ] **Módulo Painéis:** CTs para impressão de comprovante do cliente, cadastro de produto pelo lojista e bloqueio de edição de produto de outro lojista.

Bom teste e bons bugs! 🎯
