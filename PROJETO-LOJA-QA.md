# Projeto LojaQA

## 1. Visão do produto

A LojaQA é uma loja de eletrônicos com catálogo público, busca, filtros, carrinho sem login e checkout autenticado. A aplicação possui três áreas de negócio:

| Perfil | Responsabilidade |
|---|---|
| `user` | Navegar, manter o perfil, comprar e acompanhar os próprios pedidos |
| `seller` | Administrar a própria loja, produtos e pedidos que contêm seus itens |
| `admin` | Administrar usuários, lojistas, produtos e pedidos de toda a plataforma |
| `blocked` | Não pode autenticar nem acessar áreas protegidas |

O carrinho pode ser usado anonimamente. Login só é obrigatório para concluir a compra.

## 2. Escopo funcional

### Entregue nesta base

- Vitrine pública em `projetos-base/01-sistema-login/loja.html`.
- Busca por nome e descrição.
- Filtro por categoria e preço máximo.
- Cards de produto com preço, estoque e loja.
- Carrinho persistido em `localStorage` sem exigir login.
- Controle de quantidade e total do carrinho.
- Redirecionamento para login ao iniciar checkout sem sessão.
- Checkout autenticado com endereço de entrega.
- Criação e histórico de pedidos.
- Baixa de estoque no momento da criação do pedido.
- Painel do cliente, lojista e administrador em `painel.html`.
- CRUD inicial de produtos para o lojista.
- Separação de pedidos por lojista.
- Usuário seed `lojista@system.com`.
- Produtos seed para a vitrine.

### Próximas evoluções

- Pagamento real ou sandbox.
- Avaliação e perguntas no produto.
- Favoritos e lista de desejos.
- Cupons e campanhas.
- Frete e cálculo por CEP.
- Upload de imagens.
- Relatórios de vendas.
- Auditoria de ações administrativas.
- Hash de senhas com bcrypt antes de produção.
- Transação MongoDB para garantir baixa de estoque sem concorrência.

## 3. Requisitos para os alunos

### Catálogo

- RF01: visitante deve visualizar produtos ativos.
- RF02: visitante deve pesquisar por nome ou descrição.
- RF03: visitante deve filtrar por categoria.
- RF04: visitante deve filtrar por preço máximo.
- RF05: produto sem estoque deve aparecer indisponível.
- RF06: produto deve exibir nome, categoria, descrição, preço e estoque.

### Carrinho

- RF07: visitante deve adicionar produto ao carrinho sem login.
- RF08: visitante deve alterar quantidade respeitando o estoque.
- RF09: visitante deve remover item reduzindo a quantidade a zero.
- RF10: carrinho deve sobreviver ao refresh da página.
- RF11: total deve ser recalculado a cada alteração.

### Autenticação e cliente

- RF12: login deve aceitar `user`, `seller` e `admin` ativos.
- RF13: usuário `blocked` não pode entrar.
- RF14: checkout sem sessão deve solicitar login.
- RF15: cliente autenticado deve informar endereço para finalizar.
- RF16: cliente deve visualizar somente os próprios pedidos.
- RF17: logout deve limpar a sessão e impedir acesso ao painel.

### Lojista

- RF18: lojista deve cadastrar produto.
- RF19: lojista deve editar somente produtos da própria loja.
- RF20: lojista deve informar nome, categoria, preço e estoque válidos.
- RF21: lojista deve visualizar pedidos que contenham itens da sua loja.
- RF22: lojista não pode listar ou alterar usuários globais.
- RF23: lojista não pode editar produtos de outro lojista.

### Administrador da plataforma

- RF24: admin deve listar todos os usuários.
- RF25: admin deve alterar perfil para `user`, `seller`, `admin` ou `blocked`.
- RF26: promoção para `seller` ou `admin` deve exigir a senha atual do admin.
- RF27: admin deve visualizar produtos de todas as lojas.
- RF28: admin deve criar/editar produtos globais quando necessário.
- RF29: admin deve acompanhar todos os pedidos.

### Regras de negócio

- RN01: senha deve ter entre 8 e 25 caracteres.
- RN02: nome deve ter no máximo 50 caracteres no cadastro.
- RN03: preço não pode ser negativo.
- RN04: estoque deve ser inteiro maior ou igual a zero.
- RN05: quantidade do pedido deve ser inteira e maior que zero.
- RN06: pedido deve armazenar o preço praticado no momento da compra.
- RN07: produto inativo não aparece na vitrine.
- RN08: e-mail deve ser único e válido.

## 4. Estrutura de telas

```text
loja.html
├── Header: marca, produtos, login/painel, carrinho
├── Hero da loja
├── Busca e filtros
├── Grade de produtos
└── Drawer do carrinho

index.html
├── Login
├── Cadastro
└── Recuperação de senha

painel.html
├── user
│   ├── Meu perfil
│   ├── Meus pedidos
│   └── Checkout
├── seller
│   ├── Meu perfil
│   ├── Produtos da minha loja
│   └── Pedidos da loja
└── admin
    ├── Perfil administrativo
    ├── Usuários e lojistas
    ├── Todos os produtos
    └── Indicadores da plataforma
```

## 5. Contrato principal da API

| Método | Endpoint | Acesso | Objetivo |
|---|---|---|---|
| GET | `/api/products` | Público | Catálogo com busca/filtros |
| GET | `/api/products/categories` | Público | Categorias disponíveis |
| POST | `/api/orders` | Cliente autenticado | Criar pedido e baixar estoque |
| GET | `/api/orders/me` | Cliente autenticado | Pedidos do próprio cliente |
| GET | `/api/seller/products` | `seller`/`admin` | Produtos da loja ou visão global |
| POST | `/api/seller/products` | `seller`/`admin` | Criar produto |
| PUT | `/api/seller/products/:id` | `seller`/`admin` | Atualizar produto autorizado |
| GET | `/api/seller/orders` | `seller`/`admin` | Pedidos da loja ou todos |
| PUT | `/api/seller/orders/:id/status` | `seller`/`admin` | Atualizar status do pedido |
| GET | `/api/users` | `admin` | Usuários globais |
| PUT | `/api/users/:id` | `admin` | Alterar usuário e papel |

## 6. Casos de teste QA

| ID | Cenário | Resultado esperado |
|---|---|---|
| CT01 | Abrir a vitrine sem autenticação | Produtos ativos aparecem |
| CT02 | Pesquisar termo existente | Apenas produtos compatíveis aparecem |
| CT03 | Pesquisar termo inexistente | Estado vazio amigável |
| CT04 | Filtrar categoria | Apenas categoria escolhida aparece |
| CT05 | Informar preço máximo | Produtos acima do limite desaparecem |
| CT06 | Adicionar item sem login | Item entra no carrinho |
| CT07 | Atualizar página com carrinho preenchido | Itens continuam presentes |
| CT08 | Aumentar além do estoque | Quantidade não ultrapassa estoque |
| CT09 | Finalizar carrinho vazio | Operação bloqueada com mensagem |
| CT10 | Checkout sem login | Redireciona para login |
| CT11 | Login como `user` | Abre painel de cliente |
| CT12 | Login como `seller` | Abre painel de lojista |
| CT13 | Login como `admin` | Abre painel global |
| CT14 | Login como `blocked` | API responde acesso negado |
| CT15 | Checkout com endereço vazio | Validação impede envio |
| CT16 | Criar pedido com estoque válido | Pedido criado e estoque reduzido |
| CT17 | Criar pedido acima do estoque | API responde conflito 409 |
| CT18 | Cliente consultar pedidos | Só pedidos do próprio cliente aparecem |
| CT19 | Lojista criar produto válido | Produto vinculado à loja do lojista |
| CT20 | Lojista editar produto de outra loja | API responde 404/sem permissão |
| CT21 | Lojista acessar `/api/users` | API responde 403 |
| CT22 | Admin listar usuários | Todos os usuários aparecem |
| CT23 | Admin promover para `seller` sem senha | API rejeita alteração |
| CT24 | Admin promover para `seller` com senha | Papel é alterado |
| CT25 | Nome acima de 50 caracteres | Frontend/backend rejeitam |
| CT26 | Senha acima de 25 caracteres | Frontend/backend rejeitam |
| CT27 | Preço negativo no produto | API rejeita produto |
| CT28 | Estoque decimal ou negativo | API rejeita produto |
| CT29 | Logout e botão voltar | Painel não fica acessível |
| CT30 | Token expirado no painel | Usuário é enviado ao login |
| CT31 | Layout em celular | Conteúdo não sobrepõe nem corta ações |
| CT32 | API indisponível | Vitrine mostra estado de erro controlado |

## 7. Massa inicial para QA

| E-mail | Senha | Papel | Uso |
|---|---|---|---|
| `admin@system.com` | `AdminPassword123` | admin | Controle global |
| `user@system.com` | `UserPassword123` | user | Compra e pedidos |
| `lojista@system.com` | `SellerPass123` | seller | Loja e produtos |
| `blocked@system.com` | `Blocked123` | blocked | Teste de bloqueio |
| `slow@system.com` | `SlowPass123` | user | Teste de latência |

## 8. Critérios de aceite da entrega

- Todos os casos críticos CT01, CT06, CT10, CT11, CT12, CT13, CT16, CT20, CT21, CT23 e CT29 executados.
- Nenhum segredo real commitado no repositório.
- API responde erros com status coerente.
- Usuários não conseguem acessar dados de outro papel.
- Carrinho não exige autenticação.
- Compra exige autenticação e endereço.
- Testes desktop e mobile anexados ao relatório.
- Bugs classificados em bloqueador, alto, médio e baixo.
