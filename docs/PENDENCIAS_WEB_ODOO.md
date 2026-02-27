# Pendencias Web Odoo (Paridade Bader-AR)

Status base:
- Rotas publicas principais respondendo `200` no QAS.
- Header/menu principal alinhado no desktop (inclui `Servicios`, `Tu Cuenta`).
- Escopo: somente frontend web (sem admin).

Atualizacao 2026-02-27:
- [x] `/terminos`, `/privacidad`, `/cookies` implementadas (rotas + templates).
- [x] `/productos` fase 1 aplicada em QWeb (hero, quick filters, chips ativos, contador e empty state).
- [x] `/productos` filtros inteligentes por nicho -> tipo -> subcategoria (endpoint JSON + sidebar dinamica).
- [~] Busca no catalogo ajustada para maior relevancia (sem fuzzy e sem match por descricao em `/productos`).
- [x] `/producto/<id>` migrado para QWeb com tabs, FAQ, relacionados e CTA (sem injecao pesada em JS).
- [x] Header mobile no estilo app (drawer com busca, nichos, links principais e conta).
- [x] Drawer lateral de carrinho integrado com Odoo (`/shop/cart?type=popover` + `/shop/cart/update_json`).

## Prioridade Alta

1. Catalogo `/productos` (gap maior)
- Estado atual: [shop.xml](../addons/bader_website/views/shop.xml) com estrutura principal da pagina (hero, filtros rapidos, chips e empty state).
- Paridade faltando vs app: [Productos.tsx](../Bader-AR/client/src/pages/Productos.tsx)
- Itens pendentes:
  - [x] Hero com breadcrumb contextual por categoria.
  - [x] Filtros inteligentes (nicho -> tipo -> subcategoria).
  - [~] Busca no catalogo com UX dedicada (backend mais estrito aplicado; falta UX de sugestao/feedback no front).
  - [x] Quick filters (`Ofertas`, `Mas vendidos`, `Nuevos`, `Envio gratis`, `Destacados`) com estado ativo.
  - [~] Alternancia `grid/list` (depende de controles nativos Odoo; sem replica total do app).
  - [x] Chips de filtros ativos + limpar filtros.
  - [~] Empty state melhorado; skeletons ainda nao aplicados.

2. Produto detalhado `/producto/<id>`
- Estado atual: base consolidada em [product_detail.xml](../addons/bader_website/views/product_detail.xml) com suporte SCSS dedicado.
- Paridade faltando vs app: [product.tsx](../Bader-AR/client/src/pages/product.tsx)
- Itens pendentes:
  - [x] Estrutura completa em template QWeb (menos dependencia de JS injetando blocos).
  - [x] FAQ e blocos ricos de conteudo.
  - [x] Bloco de produtos relacionados com layout igual ao app.
  - [x] CTA e acoes de compra com mesma hierarquia visual.

3. Header mobile + experiencia de carrinho
- Estado atual: desktop, menu mobile e carrinho lateral no frontend ja implementados; faltam refinamentos de microinteracao.
- Paridade faltando vs app: [Header.tsx](../Bader-AR/client/src/components/landing/Header.tsx) e [CartDrawer.tsx](../Bader-AR/client/src/components/landing/CartDrawer.tsx)
- Itens pendentes:
  - [x] Menu mobile estilo app (com blocos por nicho e links de conta).
  - [x] Drawer de carrinho lateral.
  - [~] Mesma ordem e comportamento das acoes mobile (falta refinamento final do fechamento/animacoes).

## Prioridade Media

4. Checkout `/checkout` (paridade visual fina)
- Estado atual: [templates.xml](../addons/bader_website/views/templates.xml) com bom override, mas nao reproduz 100% o UX do app.
- Paridade faltando vs app: [checkout.tsx](../Bader-AR/client/src/pages/checkout.tsx)
- Itens pendentes:
  - Revisar fluxo visual dos passos, estados vazios e mensagens.
  - Ajustar spacing/hierarquia para igualar composicao do app.

5. Blog post (conteudo relacionado)
- Estado atual: [frontend_pages.xml](../addons/bader_website/views/frontend_pages.xml) implementa lista e post.
- Paridade faltando vs app: [BlogPost.tsx](../Bader-AR/client/src/pages/BlogPost.tsx)
- Item pendente:
  - Bloco de produtos relacionados no post (alem de artigos relacionados).

6. Area logada (conta)
- Estado atual: [account_pages.xml](../addons/bader_website/views/account_pages.xml) cobre perfil, pedidos, faturas, favoritos e configuracao.
- Paridade faltando vs app: [mi-perfil.tsx](../Bader-AR/client/src/pages/mi-perfil.tsx), [my-orders.tsx](../Bader-AR/client/src/pages/my-orders.tsx), [mis-favoritos.tsx](../Bader-AR/client/src/pages/mis-favoritos.tsx), [mis-facturas.tsx](../Bader-AR/client/src/pages/mis-facturas.tsx)
- Itens pendentes:
  - [~] Ajustes de interacoes e estados (vazio/erro/login) aplicados nas paginas principais; falta refinamento visual final.
  - [x] Acao direta em favoritos (adicionar ao carrinho + remover sem depender de `/shop/wishlist`).

7. Home personalizada por perfil (pos-login)
- Estado atual: homepage unica em [homepage.xml](../addons/bader_website/views/homepage.xml).
- Paridade faltando vs app: [PersonalizedHome.tsx](../Bader-AR/client/src/pages/PersonalizedHome.tsx) + dashboards por nicho.
- Item pendente:
  - Definir se sera implementado em Odoo web com segmentacao por cliente.

## Prioridade Baixa

8. QA visual e refinamentos finais
- Revisao de detalhes de tipografia/espacamento/animacao.
- Revisao de textos (acentuacao e consistencia de copy).
- Revisao de microinteracoes mobile.

## Ordem de execucao recomendada

1. Header mobile + cart drawer (fechar parte do drawer de carrinho).
2. Checkout (paridade visual fina).
3. Conta (interacoes e estados).
4. Blog post (produtos relacionados).
5. Ajustes finais e QA visual completo.
