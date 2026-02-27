# Pendencias Web Odoo (Paridade Bader-AR)

Status base:
- Rotas publicas principais respondendo `200` no QAS.
- Header/menu principal alinhado no desktop (inclui `Servicios`, `Tu Cuenta`).
- Escopo: somente frontend web (sem admin).

Atualizacao 2026-02-27:
- ✅ `/terminos`, `/privacidad`, `/cookies` implementadas (rotas + templates).
- ✅ `/productos` fase 1 aplicada em QWeb (hero, quick filters, chips ativos, contador e empty state).
- ⚠️ `/productos` ainda depende de evolucao para filtros inteligentes por nicho/tipo/subcategoria.

## Prioridade Alta

1. Catalogo `/productos` (gap maior)
- Estado atual: [shop.xml](../addons/bader_website/views/shop.xml) agora tem estrutura principal da pagina (hero, filtros rapidos, chips e empty state).
- Paridade faltando vs app: [Productos.tsx](../Bader-AR/client/src/pages/Productos.tsx)
- Itens pendentes:
  - ✅ Hero com breadcrumb contextual por categoria.
  - ❌ Filtros inteligentes (nicho -> tipo -> subcategoria).
  - ⚠️ Busca no catalogo com UX dedicada (usa base Odoo + refinamentos JS).
  - ✅ Quick filters (`Ofertas`, `Mas vendidos`, `Nuevos`, `Envio gratis`, `Destacados`) com estado ativo.
  - ⚠️ Alternancia `grid/list` (depende de controles nativos Odoo, sem replica total do app).
  - ✅ Chips de filtros ativos + limpar filtros.
  - ⚠️ Empty state melhorado; skeletons ainda nao aplicados.

2. Produto detalhado `/producto/<id>`
- Estado atual: customizacoes concentradas em JS/CSS (injeccao em runtime).
- Paridade faltando vs app: [product.tsx](../Bader-AR/client/src/pages/product.tsx)
- Itens pendentes:
  - Estrutura completa em template QWeb (menos dependencia de JS injetando blocos).
  - FAQ e blocos ricos de conteudo.
  - Bloco de produtos relacionados com layout igual ao app.
  - CTA e acoes de compra com mesma hierarquia visual.

3. Header mobile + experiencia de carrinho
- Estado atual: desktop esta perto da referencia; mobile ainda segue padrao Odoo.
- Paridade faltando vs app: [Header.tsx](../Bader-AR/client/src/components/landing/Header.tsx) e [CartDrawer.tsx](../Bader-AR/client/src/components/landing/CartDrawer.tsx)
- Itens pendentes:
  - Menu mobile estilo app (com blocos por nicho e links de conta).
  - Drawer de carrinho lateral (hoje e popover/default Odoo).
  - Mesma ordem e comportamento das acoes mobile.

4. Links legais do footer (quebrados)
- Estado atual: [footer.xml](../addons/bader_website/views/footer.xml) aponta para `/terminos`, `/privacidad`, `/cookies`.
- Status: resolvido nesta etapa com rotas/controller + templates em [frontend_pages.xml](../addons/bader_website/views/frontend_pages.xml).

## Prioridade Media

5. Checkout `/checkout` (paridade visual fina)
- Estado atual: [templates.xml](../addons/bader_website/views/templates.xml) tem bom override, mas nao reproduz 100% o UX do app.
- Paridade faltando vs app: [checkout.tsx](../Bader-AR/client/src/pages/checkout.tsx)
- Itens pendentes:
  - Revisar fluxo visual dos passos, estados vazios e mensagens.
  - Ajustar spacing/hierarquia para igualar composicao do app.

6. Blog post (conteudo relacionado)
- Estado atual: [frontend_pages.xml](../addons/bader_website/views/frontend_pages.xml) implementa lista e post.
- Paridade faltando vs app: [BlogPost.tsx](../Bader-AR/client/src/pages/BlogPost.tsx)
- Item pendente:
  - Bloco de produtos relacionados no post (alem de artigos relacionados).

7. Area logada (conta)
- Estado atual: [account_pages.xml](../addons/bader_website/views/account_pages.xml) cobre perfil, pedidos, faturas, favoritos e configuracao.
- Paridade faltando vs app: [mi-perfil.tsx](../Bader-AR/client/src/pages/mi-perfil.tsx), [my-orders.tsx](../Bader-AR/client/src/pages/my-orders.tsx), [mis-favoritos.tsx](../Bader-AR/client/src/pages/mis-favoritos.tsx), [mis-facturas.tsx](../Bader-AR/client/src/pages/mis-facturas.tsx)
- Itens pendentes:
  - Ajustes de interacoes e estados (vazio/erro/login) para ficar identico.
  - Revisar acao direta em favoritos (hoje muito redirecionada ao /shop/wishlist).

8. Home personalizada por perfil (pos-login)
- Estado atual: homepage unica em [homepage.xml](../addons/bader_website/views/homepage.xml).
- Paridade faltando vs app: [PersonalizedHome.tsx](../Bader-AR/client/src/pages/PersonalizedHome.tsx) + dashboards por nicho.
- Item pendente:
  - Definir se sera implementado em Odoo web com segmentacao por cliente.

## Prioridade Baixa

9. QA visual e refinamentos finais
- Revisao de detalhes de tipografia/espacamento/animacao.
- Revisao de textos (acentuacao e consistencia de copy).
- Revisao de microinteracoes mobile.

## Ordem de execucao recomendada

1. `/productos` (estrutura + filtros + UX).
2. `/producto/<id>` (template robusto + relacionados + FAQ).
3. Header mobile + cart drawer.
4. Checkout (paridade visual fina).
5. Conta (interacoes e estados).
6. Blog post (produtos relacionados).
7. Links legais e ajustes finais.
