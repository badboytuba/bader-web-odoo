/* Shop-only enhancements: loaded only on website_sale.products pages for performance. */
'use strict';

(function initBaderShopPage() {
    // ---- 10. SHOP GRID — Bader AR Style Enhancements ----
    (function initShopEnhancements() {
        var shopPage = document.querySelector('.oe_website_sale');
        if (!shopPage) return;

        // Don't run on product detail pages
        if (document.querySelector('#product_detail')) return;

        // ── 10a. Hero Section + Segment Cards ── (DISABLED per user request)
        // Flatten Odoo table mosaic into a uniform grid to avoid oversized cards caused by rowspan/colspan.
        (function normalizeProductGridLayout() {
            var normalizeQueued = false;

            function copyUsefulAttributes(fromEl, toEl) {
                if (!fromEl || !toEl) return;
                Array.prototype.forEach.call(fromEl.attributes, function (attr) {
                    var name = attr.name || '';
                    if (name.indexOf('data-') === 0 || name === 'id') {
                        toEl.setAttribute(name, attr.value);
                    }
                });
            }

            function normalizeOnce(tableWrapper) {
                if (!tableWrapper || tableWrapper.classList.contains('bader-grid-normalized')) return false;

                var sourceTable = tableWrapper.querySelector('table');
                if (!sourceTable) return false;

                var sourceCells = sourceTable.querySelectorAll('td.oe_product');
                if (!sourceCells.length) return false;

                var flatGrid = document.createElement('div');
                flatGrid.className = 'bader-products-grid';

                sourceCells.forEach(function (cell) {
                    var productWrapper = cell.querySelector('.o_wsale_product_grid_wrapper');
                    var productCard = cell.querySelector('.oe_product_cart');
                    if (!productWrapper && !productCard) return;

                    var item = document.createElement('article');
                    item.className = 'bader-products-grid__item oe_product';
                    copyUsefulAttributes(cell, item);

                    if (productWrapper) {
                        var wrapperClass = (productWrapper.getAttribute('class') || '')
                            .replace(/\bo_wsale_product_grid_wrapper_\d+_\d+\b/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                        productWrapper.setAttribute('class', (wrapperClass + ' o_wsale_product_grid_wrapper_1_1').trim());
                        item.appendChild(productWrapper);
                    } else {
                        item.appendChild(productCard);
                    }

                    flatGrid.appendChild(item);
                });

                if (!flatGrid.children.length) return false;

                sourceTable.remove();
                tableWrapper.appendChild(flatGrid);
                tableWrapper.classList.add('bader-grid-normalized');
                return true;
            }

            function runNormalize(maxAttempts) {
                var gridArea = document.getElementById('products_grid');
                if (!gridArea) return;

                var normalized = false;
                var wrappers = gridArea.querySelectorAll('.o_wsale_products_grid_table_wrapper:not(.bader-grid-normalized)');
                wrappers.forEach(function (tableWrapper) {
                    if (normalizeOnce(tableWrapper)) {
                        normalized = true;
                    }
                });
                if (normalized) return;

                var attempts = typeof maxAttempts === 'number' ? maxAttempts : 0;
                if (attempts > 0) {
                    window.setTimeout(function () {
                        runNormalize(attempts - 1);
                    }, 80);
                }
            }

            function queueNormalize(maxAttempts) {
                if (normalizeQueued) return;
                normalizeQueued = true;
                window.requestAnimationFrame(function () {
                    normalizeQueued = false;
                    runNormalize(typeof maxAttempts === 'number' ? maxAttempts : 0);
                });
            }

            queueNormalize(22);
            window.setTimeout(function () { queueNormalize(18); }, 0);
            window.setTimeout(function () { queueNormalize(14); }, 180);
            window.setTimeout(function () { queueNormalize(10); }, 600);

            if ('MutationObserver' in window) {
                var gridArea = document.getElementById('products_grid');
                if (gridArea) {
                    var observer = new MutationObserver(function () {
                        if (gridArea.querySelector('.o_wsale_products_grid_table_wrapper:not(.bader-grid-normalized) table')) {
                            queueNormalize(6);
                        }
                    });
                    observer.observe(gridArea, { childList: true, subtree: true });
                }
            }

            document.addEventListener('visibilitychange', function () {
                if (!document.hidden) {
                    queueNormalize(4);
                }
            });
        })();
        (function injectHeroSection() {
            return; // Hero section removed
            var shopGrid = document.querySelector('#products_grid, .bader-shop-grid');
            var shopContainer = shopGrid ? shopGrid.closest('.oe_website_sale') : document.querySelector('.oe_website_sale');
            if (!shopContainer || document.querySelector('.bader-hero')) return;

            // Detect if we're on a category page (not the main shop)
            var breadcrumbs = document.querySelectorAll('.breadcrumb-item, .breadcrumb li');
            var isCategory = false;
            var categoryName = '';

            if (breadcrumbs.length > 1) {
                var lastBc = breadcrumbs[breadcrumbs.length - 1];
                categoryName = (lastBc.textContent || '').trim();
                var genericNames = ['shop', 'artigos', 'productos', 'loja', ''];
                isCategory = genericNames.indexOf(categoryName.toLowerCase()) === -1;
            }

            // Build the hero HTML
            var heroHtml = '<section class="bader-hero" id="bader_catalog_hero">' +
                '<div class="bader-hero__container">';

            // Breadcrumb
            heroHtml += '<nav class="bader-hero__breadcrumb">' +
                '<a href="/">Inicio</a>' +
                '<span class="bader-hero__chevron">›</span>';

            if (isCategory) {
                heroHtml += '<a href="/productos">Productos</a>' +
                    '<span class="bader-hero__chevron">›</span>' +
                    '<span>' + categoryName + '</span>';
            } else {
                heroHtml += '<span>Productos</span>';
            }
            heroHtml += '</nav>';

            // Title + Subtitle
            if (isCategory) {
                heroHtml += '<h1 class="bader-hero__title">' + categoryName + '</h1>';
            } else {
                heroHtml += '<h1 class="bader-hero__title">Nuestro Catálogo</h1>' +
                    '<p class="bader-hero__subtitle">' +
                    'Más de 3.000 productos de equipamiento odontológico con garantía europea. ' +
                    'Elegí tu segmento para encontrar lo que necesitás.' +
                    '</p>';
            }

            // Segment cards (only on main shop page)
            if (!isCategory) {
                heroHtml += '<div class="bader-hero__segments">' +

                    // Clínica Dental
                    '<a href="/productos?search=clinica%20dental" class="bader-segment-card">' +
                    '<div class="bader-segment-card__icon"><i class="fa fa-hospital-o"></i></div>' +
                    '<div class="bader-segment-card__content">' +
                    '<h3>Clínica Dental</h3>' +
                    '<p>Equipos e instrumental para consultorios y clínicas dentales</p>' +
                    '<span class="bader-segment-card__badge">' +
                    '<span class="bader-segment-card__count">7 productos</span>' +
                    '<span class="bader-segment-card__arrow">›</span>' +
                    '</span>' +
                    '</div></a>' +

                    // Laboratorio Dental
                    '<a href="/productos?search=laboratorio%20dental" class="bader-segment-card">' +
                    '<div class="bader-segment-card__icon"><i class="fa fa-flask"></i></div>' +
                    '<div class="bader-segment-card__content">' +
                    '<h3>Laboratorio Dental</h3>' +
                    '<p>Equipos de fabricación, CAD/CAM, impresión 3D y materiales de laboratorio</p>' +
                    '<span class="bader-segment-card__badge">' +
                    '<span class="bader-segment-card__count">6 productos</span>' +
                    '<span class="bader-segment-card__arrow">›</span>' +
                    '</span>' +
                    '</div></a>' +

                    // Estudiantes
                    '<a href="/productos?search=estudiantes" class="bader-segment-card">' +
                    '<div class="bader-segment-card__icon"><i class="fa fa-graduation-cap"></i></div>' +
                    '<div class="bader-segment-card__content">' +
                    '<h3>Estudiantes</h3>' +
                    '<p>Kits básicos, modelos de práctica e instrumental para odontología</p>' +
                    '<span class="bader-segment-card__badge">' +
                    '<span class="bader-segment-card__count">6 productos</span>' +
                    '<span class="bader-segment-card__arrow">›</span>' +
                    '</span>' +
                    '</div></a>' +

                    '</div>'; // close segments
            }

            heroHtml += '</div></section>'; // close container + hero

            // Insert hero as first child of the shop container
            var heroEl = document.createElement('div');
            heroEl.innerHTML = heroHtml;
            var heroSection = heroEl.firstChild;

            // Find the best insertion point
            var insertTarget = shopContainer.querySelector('.o_wsale_products_main_row') ||
                shopContainer.querySelector('#products_grid') ||
                shopContainer.firstChild;

            if (insertTarget) {
                insertTarget.parentElement.insertBefore(heroSection, insertTarget);
            } else {
                shopContainer.insertBefore(heroSection, shopContainer.firstChild);
            }

            // Hide Odoo's default page title
            var defaultTitle = shopContainer.querySelector('h1');
            if (defaultTitle && !defaultTitle.classList.contains('bader-hero__title')) {
                defaultTitle.style.display = 'none';
            }
        })();

        // ── 10b. Product Count ──
        (function injectProductCount() {
            var gridArea = document.querySelector('#products_grid');
            if (!gridArea || document.querySelector('.bader-product-count')) return;

            var productCards = document.querySelectorAll('.oe_product');
            var count = productCards.length;
            if (count === 0) return;

            var countEl = document.createElement('div');
            countEl.className = 'bader-product-count';
            countEl.innerHTML = '<span>' + count + ' productos encontrados</span>';
            gridArea.insertBefore(countEl, gridArea.firstChild);
        })();

        // ── 10c. Active Filter Chips + Quick Filters ──
        // -- 10c. Grid/List View Toggle --
        (function initCatalogViewToggle() {
            var toggleRoot = document.querySelector('[data-bader-view-toggle]');
            var gridArea = document.getElementById('products_grid');
            if (!toggleRoot || !gridArea) return;

            var buttons = toggleRoot.querySelectorAll('.bader-view-btn[data-bader-view]');
            if (!buttons.length) return;

            var storageKey = 'bader_catalog_view';
            var params = new URLSearchParams(window.location.search);
            var view = params.get('view') || '';

            if (view !== 'grid' && view !== 'list') {
                try {
                    view = window.localStorage.getItem(storageKey) || '';
                } catch (err) {
                    view = '';
                }
            }
            if (view !== 'list') view = 'grid';

            function applyView(nextView, persist) {
                var isList = nextView === 'list';
                gridArea.classList.toggle('bader-view-list', isList);
                gridArea.classList.toggle('bader-view-grid', !isList);
                buttons.forEach(function (btn) {
                    var btnView = btn.getAttribute('data-bader-view');
                    var isActive = btnView === nextView;
                    btn.classList.toggle('is-active', isActive);
                    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });
                if (persist) {
                    try {
                        window.localStorage.setItem(storageKey, nextView);
                    } catch (err) {
                        // Ignore localStorage failures
                    }
                }
            }

            buttons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var nextView = btn.getAttribute('data-bader-view') || 'grid';
                    applyView(nextView === 'list' ? 'list' : 'grid', true);
                });
            });

            applyView(view, false);
        })();

        (function injectFilterChips() {
            var toolbar = document.querySelector('.products_header, #products_grid');
            if (!toolbar) return;

            var params = new URLSearchParams(window.location.search);
            var quickFilterKey = params.get('bader_qf') || '';
            var activeFilters = [];
            var quickFilterLabels = {
                'ofertas': 'Ofertas',
                'mas-vendidos': 'Mas vendidos',
                'nuevos': 'Nuevos',
                'envio-gratis': 'Envio gratis',
                'destacados': 'Destacados',
            };
            var orderLabels = {
                'website_sequence asc': 'Destacados',
                'create_date desc': 'Nuevos',
                'price asc': 'Menor precio',
                'price desc': 'Mayor precio',
                'name asc': 'A-Z',
            };

            // Sync quick filter links and active states
            var quickChips = document.querySelectorAll('.bader-filter-chips .bader-chip[data-bader-qf]');
            quickChips.forEach(function (chip) {
                var qf = chip.getAttribute('data-bader-qf') || '';
                var sortOrder = chip.getAttribute('data-bader-order') || '';
                var chipUrl = new URL(window.location.href);

                chipUrl.searchParams.set('bader_qf', qf);
                chipUrl.searchParams.delete('page');
                if (sortOrder) {
                    chipUrl.searchParams.set('order', sortOrder);
                }

                chip.setAttribute('href', chipUrl.pathname + chipUrl.search);
                chip.classList.toggle('bader-chip--active', quickFilterKey === qf);

                if (quickFilterKey === qf) {
                    chip.addEventListener('click', function (ev) {
                        ev.preventDefault();
                        var clearUrl = new URL(window.location.href);
                        clearUrl.searchParams.delete('bader_qf');
                        if (sortOrder && clearUrl.searchParams.get('order') === sortOrder) {
                            clearUrl.searchParams.delete('order');
                        }
                        clearUrl.searchParams.delete('page');
                        window.location.href = clearUrl.pathname + clearUrl.search;
                    });
                }
            });

            // Build active filters based on URL params
            params.forEach(function (value, key) {
                if (key === 'search' && value) {
                    activeFilters.push({ key: key, label: '"' + value + '"' });
                    return;
                }
                if (key === 'attrib' && value) {
                    activeFilters.push({ key: key, label: 'Filtro: ' + value });
                    return;
                }
                if (key === 'bader_qf' && value) {
                    activeFilters.push({ key: key, label: quickFilterLabels[value] || value });
                    return;
                }
                if (key === 'order' && value && !quickFilterKey) {
                    activeFilters.push({ key: key, label: orderLabels[value] || value });
                    return;
                }
                if ((key === 'min_price' || key === 'max_price') && value) {
                    activeFilters.push({
                        key: key,
                        label: key === 'min_price' ? ('Min: ' + value) : ('Max: ' + value),
                    });
                }
            });

            var activeContainer = document.querySelector('.bader-active-filters[data-bader-active-filters], .bader-active-filters');
            if (!activeContainer) return;

            if (activeFilters.length === 0) {
                activeContainer.innerHTML = '';
                activeContainer.style.display = 'none';
                return;
            }

            var html = '';
            activeFilters.forEach(function (filterItem) {
                var removeUrl = new URL(window.location.href);
                removeUrl.searchParams.delete(filterItem.key);
                removeUrl.searchParams.delete('page');
                html += '<a href="' + removeUrl.pathname + removeUrl.search + '" class="bader-active-chip">' +
                    filterItem.label + ' <span class="bader-chip-x">×</span></a>';
            });
            html += '<a href="' + window.location.pathname + '" class="bader-clear-all">Limpiar todo</a>';
            activeContainer.innerHTML = html;
            activeContainer.style.display = '';
        })();

        // ── 10d. Premium Product Card Enhancements ──
        // -- 10d. Search Feedback --
        (function injectSearchFeedback() {
            var feedback = document.querySelector('[data-bader-search-feedback]');
            if (!feedback) return;

            var params = new URLSearchParams(window.location.search);
            var term = (params.get('search') || '').trim();
            var safeTerm = '';
            var productCount = document.querySelectorAll('.oe_product').length;
            var hasExtraFilters = false;

            function escapeHtml(value) {
                return String(value || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }
            safeTerm = escapeHtml(term);

            params.forEach(function (value, key) {
                if (!value) return;
                if (key === 'search' || key === 'page') return;
                hasExtraFilters = true;
            });

            function buildUrl(nextSearch) {
                var targetUrl = new URL(window.location.href);
                if (nextSearch) {
                    targetUrl.searchParams.set('search', nextSearch);
                } else {
                    targetUrl.searchParams.delete('search');
                }
                targetUrl.searchParams.delete('page');
                return targetUrl.pathname + targetUrl.search;
            }

            if (!term && !hasExtraFilters) {
                feedback.hidden = true;
                feedback.innerHTML = '';
                return;
            }

            var html = '';
            if (term) {
                if (productCount > 0) {
                    html += '<div class="bader-search-feedback__row">' +
                        '<i class="fa fa-search"></i>' +
                        '<span>Resultados para <strong>"' + safeTerm + '"</strong> (' + productCount + ')</span>' +
                        '</div>';
                } else {
                    var firstToken = term.split(/\s+/).filter(Boolean)[0] || '';
                    var safeFirstToken = escapeHtml(firstToken);
                    html += '<div class="bader-search-feedback__row bader-search-feedback__row--empty">' +
                        '<i class="fa fa-info-circle"></i>' +
                        '<span>Sin resultados para <strong>"' + safeTerm + '"</strong>. Proba otro termino.</span>' +
                        '</div>' +
                        '<div class="bader-search-feedback__actions">' +
                        '<a class="bader-search-feedback__link" href="' + buildUrl('') + '">Ver todo</a>';
                    if (firstToken && firstToken !== term) {
                        html += '<a class="bader-search-feedback__link" href="' + buildUrl(firstToken) + '">Buscar "' + safeFirstToken + '"</a>';
                    }
                    html += '</div>';
                }
            } else if (hasExtraFilters) {
                html += '<div class="bader-search-feedback__row">' +
                    '<i class="fa fa-sliders"></i>' +
                    '<span>Filtros activos en el catalogo.</span>' +
                    '</div>';
            }

            feedback.innerHTML = html;
            feedback.hidden = !html;
        })();

        (function enhanceProductCards() {
            var cards = document.querySelectorAll('.oe_product_cart');
            if (cards.length === 0) return;

            cards.forEach(function (card) {
                if (card.classList.contains('bader-enhanced')) return;
                card.classList.add('bader-enhanced');

                var infoSection = card.querySelector('.o_wsale_product_information');
                var imageSection = card.querySelector('.oe_product_image');
                var titleEl = card.querySelector('.o_wsale_products_item_title');

                // ── (A) Category Path — extract from product link ──
                if (infoSection && titleEl && !card.querySelector('.bader-category-path')) {
                    var productLink = card.querySelector('a[href*="/shop/"]');
                    var breadcrumbs = document.querySelectorAll('.breadcrumb-item, .breadcrumb li');
                    var catText = '';

                    // Try to detect from filmstrip active category
                    var activeFilmstrip = document.querySelector('.o_wsale_filmstip_container .active, .o_category_card.active');
                    if (activeFilmstrip) {
                        catText = activeFilmstrip.textContent.trim();
                    } else if (breadcrumbs.length > 1) {
                        for (var bc = 1; bc < breadcrumbs.length - 1; bc++) {
                            if (catText) catText += ' > ';
                            catText += breadcrumbs[bc].textContent.trim();
                        }
                    }
                    if (!catText) catText = 'Equipamiento Odontológico';

                    var catPath = document.createElement('div');
                    catPath.className = 'bader-category-path';
                    catPath.textContent = catText;
                    var infoText = infoSection.querySelector('.o_wsale_product_information_text');
                    if (infoText) {
                        infoText.insertBefore(catPath, infoText.firstChild);
                    } else {
                        infoSection.insertBefore(catPath, infoSection.firstChild);
                    }
                }

                // ── (B) Floating Cart Button ──
                if (imageSection && !card.querySelector('.bader-floating-cart')) {
                    var cartBtn = document.createElement('button');
                    cartBtn.className = 'bader-floating-cart';
                    cartBtn.innerHTML = '<i class="fa fa-shopping-cart"></i>';
                    cartBtn.setAttribute('aria-label', 'Agregar al carrito');
                    cartBtn.setAttribute('title', 'Agregar al carrito');
                    imageSection.appendChild(cartBtn);

                    cartBtn.addEventListener('click', function (e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var link = card.querySelector('a[href*="/shop/"]');
                        if (cartBtn.getAttribute('data-bader-cart-loading') === '1') return;

                        var productNode = card.querySelector('[data-product-product-id]');
                        var productId = parseInt(
                            String(productNode ? productNode.getAttribute('data-product-product-id') : '')
                                .replace(/[^\d]/g, ''),
                            10
                        );
                        if (!productId) {
                            if (link) window.location.href = link.href;
                            return;
                        }

                        cartBtn.setAttribute('data-bader-cart-loading', '1');
                        fetch('/shop/cart/update_json', {
                            method: 'POST',
                            credentials: 'same-origin',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'call',
                                params: {
                                    product_id: productId,
                                    add_qty: 1,
                                },
                            }),
                        }).then(function (response) {
                            if (!response.ok) {
                                throw new Error('invalid add-to-cart response');
                            }
                            return response.json();
                        }).then(function (payload) {
                            var data = payload && payload.result ? payload.result : payload || {};
                            if (typeof data.cart_quantity !== 'undefined') {
                                var qty = Math.max(0, parseInt(String(data.cart_quantity), 10) || 0);
                                var badgeText = qty > 99 ? '99+' : String(qty);
                                document.querySelectorAll('.my_cart_quantity, .o_wsale_my_cart .my_cart_quantity').forEach(function (badge) {
                                    badge.textContent = badgeText;
                                    badge.classList.remove('d-none');
                                });
                                try {
                                    if (window.sessionStorage) {
                                        window.sessionStorage.setItem('website_sale_cart_quantity', String(qty));
                                    }
                                } catch (err) {
                                    // Ignore storage errors.
                                }
                            }
                            document.dispatchEvent(new Event('bader:cart-open'));
                        }).catch(function () {
                            if (link) window.location.href = link.href;
                        }).finally(function () {
                            cartBtn.removeAttribute('data-bader-cart-loading');
                        });
                    });
                }

                // ── (C) Price Row: price + cuotas pill ──
                var priceEl = card.querySelector('.oe_currency_value');
                var priceContainer = priceEl ? (priceEl.closest('.product_price') || priceEl.parentElement) : null;

                if (priceEl && priceContainer && !card.querySelector('.bader-price-row')) {
                    var priceText = priceEl.textContent.trim().replace(/[^\d.,]/g, '');
                    var price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));

                    if (price && price > 0) {
                        var priceRow = document.createElement('div');
                        priceRow.className = 'bader-price-row';
                        priceContainer.parentElement.insertBefore(priceRow, priceContainer);
                        priceRow.appendChild(priceContainer);

                        var installment = document.createElement('span');
                        installment.className = 'bader-installment';
                        installment.textContent = '12 cuotas';
                        priceRow.appendChild(installment);
                    }
                }

                // ── (D) Offer Badge — detect strikethrough price ──
                if (imageSection) {
                    var hasOffer = card.querySelector('.text-danger, del, .oe_striked_price');
                    if (hasOffer && !card.querySelector('.bader-badge-oferta')) {
                        var ofertaBadge = document.createElement('span');
                        ofertaBadge.className = 'bader-badge-oferta';
                        ofertaBadge.textContent = 'Oferta';
                        imageSection.appendChild(ofertaBadge);
                    }
                }

                // ── (E) Stock Badge with Pulse Dot ──
                if (infoSection && !card.querySelector('.bader-stock-indicator')) {
                    var stockBadge = document.createElement('div');
                    stockBadge.className = 'bader-stock-indicator bader-stock-indicator--in';
                    stockBadge.innerHTML = '<span class="bader-stock-dot"></span> En stock';
                    infoSection.appendChild(stockBadge);
                }

                // ── (F) Envío Gratis badge ──
                if (!card.querySelector('.bader-free-shipping-badge')) {
                    var shippingBadge = document.createElement('div');
                    shippingBadge.className = 'bader-free-shipping-badge';
                    shippingBadge.innerHTML = '<i class="fa fa-truck"></i> Envío gratis a todo el país';
                    card.appendChild(shippingBadge);
                }
            });
        })();

        // ── 10e. Advanced Sidebar ──
        // -- 10f. Skeleton Loading --
        (function initShopSkeletons() {
            var gridArea = document.getElementById('products_grid');
            if (!gridArea || gridArea.classList.contains('bader-skeleton-ready')) return;
            gridArea.classList.add('bader-skeleton-ready');

            var tableWrapper = gridArea.querySelector('.o_wsale_products_grid_table_wrapper');
            var cards = gridArea.querySelectorAll('.oe_product');
            if (!tableWrapper || !cards.length) return;

            var skeleton = document.createElement('div');
            skeleton.className = 'bader-shop-skeleton';
            skeleton.setAttribute('aria-hidden', 'true');

            var html = '';
            var skeletonCount = Math.max(4, Math.min(cards.length, 8));
            for (var i = 0; i < skeletonCount; i++) {
                html += '<div class="bader-skeleton-card">' +
                    '<div class="bader-skeleton-card__image"></div>' +
                    '<div class="bader-skeleton-card__line bader-skeleton-card__line--sm"></div>' +
                    '<div class="bader-skeleton-card__line"></div>' +
                    '<div class="bader-skeleton-card__line bader-skeleton-card__line--xs"></div>' +
                    '</div>';
            }
            skeleton.innerHTML = html;
            tableWrapper.parentElement.insertBefore(skeleton, tableWrapper);
            gridArea.classList.add('bader-shop-loading');

            window.requestAnimationFrame(function () {
                window.setTimeout(function () {
                    gridArea.classList.remove('bader-shop-loading');
                    skeleton.classList.add('is-leaving');
                    window.setTimeout(function () {
                        if (skeleton.parentElement) skeleton.parentElement.removeChild(skeleton);
                    }, 220);
                }, 180);
            });
        })();

        (function enhanceSidebar() {
            // The sidebar element can be: #products_grid_before itself (which is the col-lg-3),
            // OR a .col-lg-3 inside .o_wsale_products_main_row
            var sidebar = document.querySelector('#products_grid_before') ||
                document.querySelector('.o_wsale_products_main_row .col-lg-3');
            if (!sidebar || sidebar.classList.contains('bader-sidebar-enhanced')) return;
            sidebar.classList.add('bader-sidebar-enhanced');

            // The rail can be inside the sidebar, or the sidebar itself may act as the rail
            var rail = sidebar.querySelector('.o_wsale_products_grid_before_rail') || sidebar;

            // ── (A) Inject FILTROS header ──
            if (!rail.querySelector('.bader-sidebar-header')) {
                var header = document.createElement('div');
                header.className = 'bader-sidebar-header';
                header.innerHTML = '<h3 class="bader-sidebar-header__title"><i class="fa fa-sliders"></i> Filtros</h3>' +
                    '<a href="' + window.location.pathname + '" class="bader-sidebar-header__clear">Limpiar</a>';
                rail.insertBefore(header, rail.firstChild);
            }

            // ── (B) Inject Segmento filter section ──
            var existingFilters = rail.querySelector('.products_attributes_filters');
            if (!rail.querySelector('.bader-filter-section--segmento')) {
                function parseCurrentCategoryId() {
                    var path = (window.location.pathname || '').toLowerCase();
                    var match = path.match(/\/productos\/category\/[^/?#]*-(\d+)/) ||
                        path.match(/\/shop\/category\/[^/?#]*-(\d+)/);
                    if (!match || !match[1]) return null;
                    var id = parseInt(match[1], 10);
                    return isNaN(id) ? null : id;
                }

                function hasId(idList, targetId) {
                    var i = 0;
                    if (!targetId || !idList || !idList.length) return false;
                    for (i = 0; i < idList.length; i++) {
                        if (parseInt(idList[i], 10) === parseInt(targetId, 10)) return true;
                    }
                    return false;
                }

                function htmlEscape(value) {
                    return (value || '').toString()
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#39;');
                }

                function toggleSection(titleBtn, bodyEl) {
                    if (!titleBtn || !bodyEl) return;
                    titleBtn.addEventListener('click', function () {
                        var chevron = titleBtn.querySelector('.bader-chevron');
                        var isOpen = chevron && chevron.classList.contains('is-open');
                        if (isOpen) {
                            bodyEl.style.maxHeight = '0';
                            bodyEl.style.overflow = 'hidden';
                            if (chevron) chevron.classList.remove('is-open');
                        } else {
                            bodyEl.style.maxHeight = bodyEl.scrollHeight + 'px';
                            bodyEl.style.overflow = 'visible';
                            if (chevron) chevron.classList.add('is-open');
                        }
                    });
                }

                function buildFallbackSection() {
                    var fallback = document.createElement('div');
                    fallback.className = 'bader-filter-section bader-filter-section--segmento';
                    fallback.innerHTML =
                        '<div class="bader-filter-section__title">Segmento <span class="bader-chevron is-open">▾</span></div>' +
                        '<div class="bader-filter-section__body"><div class="bader-segmento-list">' +
                        '<a href="/productos?search=clinica" class="bader-segmento-item"><i class="fa fa-hospital-o"></i> Clinica Dental</a>' +
                        '<a href="/productos?search=laboratorio" class="bader-segmento-item"><i class="fa fa-flask"></i> Laboratorio Dental</a>' +
                        '<a href="/productos?search=estudiantes" class="bader-segmento-item"><i class="fa fa-graduation-cap"></i> Estudiantes</a>' +
                        '</div></div>';
                    return fallback;
                }

                function buildIntelligentSection(payload) {
                    var niches = (payload && payload.niches) ? payload.niches : [];
                    var currentCategoryId = parseCurrentCategoryId();
                    var html = '';

                    if (!niches.length) return null;

                    html += '<div class="bader-filter-section bader-filter-section--segmento">';
                    html += '<div class="bader-filter-section__title">Segmento <span class="bader-chevron is-open">▾</span></div>';
                    html += '<div class="bader-filter-section__body"><div class="bader-segmento-list">';

                    niches.forEach(function (niche) {
                        var nicheActive = hasId(niche.descendant_ids, currentCategoryId);
                        var nicheName = htmlEscape(niche.display_name);
                        var nicheUrl = niche.url || '/productos';
                        var nicheCount = niche.product_count || 0;
                        var types = niche.types || [];

                        html += '<a href="' + nicheUrl + '" class="bader-segmento-item' + (nicheActive ? ' bader-segmento-item--active' : '') + '">' +
                            '<i class="fa ' + (niche.icon || 'fa-folder-open') + '"></i>' +
                            nicheName +
                            '<span class="bader-segmento-count">' + nicheCount + '</span></a>';

                        if (nicheActive && types.length) {
                            html += '<div class="bader-category-tree">';
                            html += '<a href="' + nicheUrl + '" class="bader-cat-item' +
                                (parseInt(niche.category_id, 10) === parseInt(currentCategoryId, 10) ? ' bader-cat-item--active' : '') +
                                '"><span>Todas las categorias</span><span class="bader-cat-count">' + nicheCount + '</span></a>';

                            types.forEach(function (typeNode) {
                                var typeActive = hasId(typeNode.descendant_ids, currentCategoryId);
                                var typeName = htmlEscape(typeNode.display_name);
                                var typeUrl = typeNode.url || nicheUrl;
                                var typeCount = typeNode.product_count || 0;
                                var subcategories = typeNode.subcategories || [];

                                html += '<a href="' + typeUrl + '" class="bader-cat-item' + (typeActive ? ' bader-cat-item--active' : '') + '">' +
                                    '<span>' + typeName + '</span>' +
                                    '<span class="bader-cat-count">' + typeCount + '</span></a>';

                                subcategories.forEach(function (subNode) {
                                    var subActive = parseInt(subNode.category_id, 10) === parseInt(currentCategoryId, 10);
                                    var subName = htmlEscape(subNode.display_name);
                                    var subUrl = subNode.url || typeUrl;
                                    var subCount = subNode.product_count || 0;

                                    html += '<a href="' + subUrl + '" class="bader-cat-item bader-cat-item--child' + (subActive ? ' bader-cat-item--active' : '') + '">' +
                                        '<span>' + subName + '</span>' +
                                        '<span class="bader-cat-count">' + subCount + '</span></a>';
                                });
                            });
                            html += '</div>';
                        }
                    });

                    html += '</div></div></div>';
                    var container = document.createElement('div');
                    container.innerHTML = html;
                    return container.firstChild;
                }

                function insertSegmentSection(sectionNode) {
                    if (!sectionNode) return;
                    if (existingFilters) {
                        rail.insertBefore(sectionNode, existingFilters);
                    } else {
                        rail.appendChild(sectionNode);
                    }
                    toggleSection(
                        sectionNode.querySelector('.bader-filter-section__title'),
                        sectionNode.querySelector('.bader-filter-section__body')
                    );
                }

                if (window.fetch) {
                    fetch('/bader/shop/intelligent_categories', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'call',
                            params: {}
                        })
                    })
                        .then(function (response) {
                            if (!response.ok) throw new Error('invalid response');
                            return response.json();
                        })
                        .then(function (payload) {
                            var data = payload && payload.result ? payload.result : payload;
                            var section = buildIntelligentSection(data) || buildFallbackSection();
                            insertSegmentSection(section);
                        })
                        .catch(function () {
                            insertSegmentSection(buildFallbackSection());
                        });
                } else {
                    insertSegmentSection(buildFallbackSection());
                }
            }

            // ── (C) Hide Odoo's native price range and wrap attribute filters ──
            var odooPriceRange = document.getElementById('o_wsale_price_range_option');
            if (odooPriceRange) odooPriceRange.style.display = 'none';

            // Wrap Odoo's attribute filters (inside .products_attributes_filters)
            var attrContainer = rail.querySelector('.products_attributes_filters');
            if (attrContainer) {
                var attrForms = attrContainer.querySelectorAll('.accordion-item, .nav-item');
                attrForms.forEach(function (item) {
                    if (item.closest('.bader-filter-section')) return;
                    var titleEl = item.querySelector('.accordion-header, .o_products_attributes_title, h6 b, h6');
                    var titleText = titleEl ? titleEl.textContent.trim() : '';
                    if (!titleText) return;

                    // Hide Color filter per user request
                    if (titleText.toLowerCase() === 'color') {
                        item.style.display = 'none';
                        return;
                    }

                    var wrapper = document.createElement('div');
                    wrapper.className = 'bader-filter-section';
                    wrapper.innerHTML = '<div class="bader-filter-section__title">' + titleText + ' <span class="bader-chevron is-open">▾</span></div>';

                    var body = document.createElement('div');
                    body.className = 'bader-filter-section__body';

                    // Hide the original title
                    if (titleEl) titleEl.style.display = 'none';

                    item.parentElement.insertBefore(wrapper, item);
                    body.appendChild(item);
                    wrapper.appendChild(body);

                    // Toggle collapse
                    var titleBtn = wrapper.querySelector('.bader-filter-section__title');
                    titleBtn.addEventListener('click', function () {
                        var chevron = titleBtn.querySelector('.bader-chevron');
                        var isOpen = chevron.classList.contains('is-open');
                        if (isOpen) {
                            body.style.maxHeight = '0';
                            body.style.overflow = 'hidden';
                            chevron.classList.remove('is-open');
                        } else {
                            body.style.maxHeight = body.scrollHeight + 'px';
                            body.style.overflow = 'visible';
                            chevron.classList.add('is-open');
                        }
                    });
                });
            }

            // ── (D) Price Range Section — always append to rail ──
            if (!rail.querySelector('.bader-filter-section--price')) {
                var priceSection = document.createElement('div');
                priceSection.className = 'bader-filter-section bader-filter-section--price';
                priceSection.innerHTML =
                    '<div class="bader-filter-section__title">Rango de Precio <span class="bader-chevron is-open">▾</span></div>' +
                    '<div class="bader-filter-section__body">' +
                    '<div class="bader-price-range">' +
                    '<div class="bader-price-range__inputs">' +
                    '<div class="bader-price-range__input-group">' +
                    '<label>Mínimo</label>' +
                    '<span class="bader-currency-symbol">$</span>' +
                    '<input type="number" id="bader_price_min" placeholder="0" min="0">' +
                    '</div>' +
                    '<span class="bader-price-range__separator">—</span>' +
                    '<div class="bader-price-range__input-group">' +
                    '<label>Máximo</label>' +
                    '<span class="bader-currency-symbol">$</span>' +
                    '<input type="number" id="bader_price_max" placeholder="5000" min="0">' +
                    '</div>' +
                    '</div>' +
                    '<button id="bader_apply_price" style="width:100%;margin-top:8px;padding:8px 0;border:1px solid #003841;border-radius:8px;background:#003841;color:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s;">Aplicar precio</button>' +
                    '</div></div>';

                rail.appendChild(priceSection);

                // Wire price filter button
                var applyBtn = document.getElementById('bader_apply_price');
                if (applyBtn) {
                    applyBtn.addEventListener('click', function () {
                        var minVal = document.getElementById('bader_price_min').value;
                        var maxVal = document.getElementById('bader_price_max').value;
                        var url = new URL(window.location.href);
                        if (minVal) url.searchParams.set('min_price', minVal);
                        else url.searchParams.delete('min_price');
                        if (maxVal) url.searchParams.set('max_price', maxVal);
                        else url.searchParams.delete('max_price');
                        window.location.href = url.toString();
                    });
                }

                // Populate from URL params
                var urlParams = new URLSearchParams(window.location.search);
                var minInput = document.getElementById('bader_price_min');
                var maxInput = document.getElementById('bader_price_max');
                if (minInput && urlParams.get('min_price')) minInput.value = urlParams.get('min_price');
                if (maxInput && urlParams.get('max_price')) maxInput.value = urlParams.get('max_price');

                // Collapse toggle
                var priceTitleBtn = priceSection.querySelector('.bader-filter-section__title');
                var priceBody = priceSection.querySelector('.bader-filter-section__body');
                priceTitleBtn.addEventListener('click', function () {
                    var chevron = priceTitleBtn.querySelector('.bader-chevron');
                    var isOpen = chevron.classList.contains('is-open');
                    if (isOpen) {
                        priceBody.style.maxHeight = '0';
                        priceBody.style.overflow = 'hidden';
                        chevron.classList.remove('is-open');
                    } else {
                        priceBody.style.maxHeight = priceBody.scrollHeight + 'px';
                        priceBody.style.overflow = 'visible';
                        chevron.classList.add('is-open');
                    }
                });
            }

            // ── (E) Quick Toggle Switches — always append to rail ──
            if (!rail.querySelector('.bader-filter-section--toggles')) {
                var togglesSection = document.createElement('div');
                togglesSection.className = 'bader-filter-section bader-filter-section--toggles';
                togglesSection.innerHTML =
                    '<div class="bader-filter-section__title">Filtros rápidos <span class="bader-chevron is-open">▾</span></div>' +
                    '<div class="bader-filter-section__body">' +
                    '<div class="bader-toggle-row">' +
                    '<span class="bader-toggle-row__label"><i class="fa fa-tag"></i> En Oferta</span>' +
                    '<label class="bader-toggle"><input type="checkbox" id="bader_toggle_offer"><span class="bader-toggle__track"></span><span class="bader-toggle__thumb"></span></label>' +
                    '</div>' +
                    '<div class="bader-toggle-row">' +
                    '<span class="bader-toggle-row__label"><i class="fa fa-truck"></i> Envío Gratis</span>' +
                    '<label class="bader-toggle"><input type="checkbox" id="bader_toggle_shipping" checked><span class="bader-toggle__track"></span><span class="bader-toggle__thumb"></span></label>' +
                    '</div>' +
                    '</div>';
                rail.appendChild(togglesSection);

                // Collapse toggle
                var togTitleBtn = togglesSection.querySelector('.bader-filter-section__title');
                var togBody = togglesSection.querySelector('.bader-filter-section__body');
                togTitleBtn.addEventListener('click', function () {
                    var chevron = togTitleBtn.querySelector('.bader-chevron');
                    var isOpen = chevron.classList.contains('is-open');
                    if (isOpen) {
                        togBody.style.maxHeight = '0';
                        togBody.style.overflow = 'hidden';
                        chevron.classList.remove('is-open');
                    } else {
                        togBody.style.maxHeight = togBody.scrollHeight + 'px';
                        togBody.style.overflow = 'visible';
                        chevron.classList.add('is-open');
                    }
                });
            }
        })();
    })();
})();
