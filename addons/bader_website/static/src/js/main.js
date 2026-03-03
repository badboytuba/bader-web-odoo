odoo.define('bader_website.main', function (require) {
    "use strict";

    /** ============================================
     *  Bader Website — JavaScript
     *  ============================================
     *  - Mega menu hover toggle
     *  - Scroll fade-in animations (IntersectionObserver)
     *  - Testimonials carousel
     *  - Header scroll effect
     */

    // Module loaded

    // Direct execution — by the time a lazy-loaded module runs, the DOM is ready
    function initBader() {
        // initBader running

        // Mark body as JS-ready
        document.body.classList.add('bader-js-ready');

        // Section backgrounds are now handled purely via SCSS —
        // see _testimonials.scss, _cta.scss, _sobre_nosotros.scss

        // ---- 1. MEGA MENU — Products hover toggle ----
        (function initMegaMenu() {
            var megaPanel = document.getElementById('baderMegaMenu');
            if (!megaPanel) return;

            function findProductLink() {
                var desktopSelectors = [
                    'header#top #top_menu > li > a.nav-link[href=\"/productos\"]',
                    'header#top #top_menu > li > a[href=\"/productos\"]',
                    'header#top #top_menu > li > a.nav-link[href=\"/shop\"]',
                    'header#top #top_menu > li > a[href=\"/shop\"]',
                ];
                var i = 0;
                for (i = 0; i < desktopSelectors.length; i++) {
                    var directMatch = document.querySelector(desktopSelectors[i]);
                    if (directMatch) return directMatch;
                }

                // Conservative fallback: only links inside canonical top menu, never drawer links.
                var allLinks = document.querySelectorAll('header#top #top_menu > li > a');
                for (i = 0; i < allLinks.length; i++) {
                    var link = allLinks[i];
                    var href = (link.getAttribute('href') || '').toLowerCase();
                    var text = (link.textContent || '').trim().toLowerCase();
                    if (text === 'productos' || text === 'shop' || text.indexOf('producto') !== -1 ||
                        href === '/shop' || href === '/productos') {
                        return link;
                    }
                }
                return null;
            }

            function setupMegaMenu(productLink) {
                var parentLi = productLink.closest('li');
                var hideTimeout = null;
                var isMobile = function () { return window.innerWidth < 992; };

                function showMega() {
                    clearTimeout(hideTimeout);
                    megaPanel.classList.add('bader-mega--open');
                    if (parentLi) parentLi.classList.add('bader-mega-active');
                }

                function hideMega() {
                    hideTimeout = setTimeout(function () {
                        megaPanel.classList.remove('bader-mega--open');
                        if (parentLi) parentLi.classList.remove('bader-mega-active');
                    }, 200);
                }

                // Desktop: hover on the nav link
                productLink.addEventListener('mouseenter', function () {
                    if (!isMobile()) showMega();
                });
                if (parentLi) {
                    parentLi.addEventListener('mouseenter', function () {
                        if (!isMobile()) showMega();
                    });
                    parentLi.addEventListener('mouseleave', function () {
                        if (!isMobile()) hideMega();
                    });
                }

                // Hover on the mega panel itself (desktop)
                megaPanel.addEventListener('mouseenter', function () {
                    if (!isMobile()) clearTimeout(hideTimeout);
                });
                megaPanel.addEventListener('mouseleave', function () {
                    if (!isMobile()) hideMega();
                });

                // Click behavior on desktop only.
                productLink.addEventListener('click', function (e) {
                    if (isMobile()) {
                        megaPanel.classList.remove('bader-mega--open');
                        if (parentLi) parentLi.classList.remove('bader-mega-active');
                        return;
                    } else if (megaPanel.classList.contains('bader-mega--open')) {
                        window.location.href = '/productos';
                        e.preventDefault();
                    }
                });

                // Ensure mobile never keeps mega open.
                window.addEventListener('resize', function () {
                    if (!isMobile()) return;
                    megaPanel.classList.remove('bader-mega--open');
                    if (parentLi) parentLi.classList.remove('bader-mega-active');
                });

                // Close mega menu on Escape
                document.addEventListener('keydown', function (e) {
                    if (e.key === 'Escape' && megaPanel.classList.contains('bader-mega--open')) {
                        megaPanel.classList.remove('bader-mega--open');
                    }
                });
            }

            // Retry up to 5 times (Odoo may render nav items after DOMContentLoaded)
            var attempts = 0;
            function tryInit() {
                var link = findProductLink();
                if (link) {
                    setupMegaMenu(link);
                } else if (attempts < 5) {
                    attempts++;
                    setTimeout(tryInit, 500);
                }
            }
            tryInit();
        })();

        // ---- 1b. SEARCH PILL — "Buscar con IA" click handler ----
        (function initSearchPill() {
            var desktopPill = document.getElementById('baderSearchPill');
            var mobilePill = document.getElementById('baderSearchPillMobile');

            function openSearch(e) {
                e.preventDefault();
                // Try Odoo's built-in search toggle
                var searchToggle = document.querySelector('.o_searchbar_form input[type="search"], .o_searchbar_form input[type="text"]');
                if (searchToggle) {
                    searchToggle.focus();
                    return;
                }
                // Fallback: navigate to shop search
                window.location.href = '/productos';
            }

            if (desktopPill) desktopPill.addEventListener('click', openSearch);
            if (mobilePill) mobilePill.addEventListener('click', openSearch);

            // Keyboard shortcut: press Q to open search
            document.addEventListener('keydown', function (e) {
                if (e.key === 'q' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    var tag = (e.target.tagName || '').toLowerCase();
                    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
                    e.preventDefault();
                    openSearch(e);
                }
            });
        })();

        (function initMobileDrawer() {
            var collapse = document.getElementById('top_menu_collapse');
            var toggler = document.querySelector('header#top .navbar-toggler');
            if (!collapse || !toggler) return;

            function setNicheOpen(card, shouldOpen) {
                if (!card) return;
                var body = card.querySelector('[data-bader-niche-body]');
                var toggle = card.querySelector('[data-bader-niche-toggle]');
                card.classList.toggle('is-open', !!shouldOpen);
                if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
                if (!body) return;
                if (shouldOpen) {
                    body.style.maxHeight = body.scrollHeight + 'px';
                } else {
                    body.style.maxHeight = '0px';
                }
            }

            function closeAllNiches() {
                collapse.querySelectorAll('.bader-mobile-niche').forEach(function (card) {
                    setNicheOpen(card, false);
                });
            }

            function setDrawerBodyState() {
                var shouldLock = window.innerWidth < 992 && collapse.classList.contains('show');
                document.body.classList.toggle('bader-mobile-menu-open', shouldLock);
            }

            function closeDrawer() {
                if (window.innerWidth >= 992 || !collapse.classList.contains('show')) return;
                collapse.classList.remove('show');
                collapse.style.height = '';
                toggler.classList.add('collapsed');
                toggler.setAttribute('aria-expanded', 'false');
                closeAllNiches();
                setDrawerBodyState();
            }

            collapse.addEventListener('shown.bs.collapse', setDrawerBodyState);
            collapse.addEventListener('hidden.bs.collapse', function () {
                closeAllNiches();
                setDrawerBodyState();
            });
            window.addEventListener('resize', setDrawerBodyState);
            setDrawerBodyState();

            collapse.querySelectorAll('.bader-mobile-drawer a').forEach(function (link) {
                link.addEventListener('click', closeDrawer);
            });

            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape') closeDrawer();
            });

            document.addEventListener('click', function (e) {
                if (window.innerWidth >= 992 || !collapse.classList.contains('show')) return;
                if (collapse.contains(e.target) || toggler.contains(e.target)) return;
                closeDrawer();
            });

            var nicheToggles = collapse.querySelectorAll('[data-bader-niche-toggle]');
            nicheToggles.forEach(function (btn) {
                var key = btn.getAttribute('data-bader-niche-toggle');
                var card = collapse.querySelector('.bader-mobile-niche[data-bader-niche="' + key + '"]');
                if (card) setNicheOpen(card, card.classList.contains('is-open'));

                btn.addEventListener('click', function () {
                    var selectedKey = btn.getAttribute('data-bader-niche-toggle');
                    var selectedCard = collapse.querySelector('.bader-mobile-niche[data-bader-niche="' + selectedKey + '"]');
                    var shouldOpen = selectedCard ? !selectedCard.classList.contains('is-open') : false;

                    closeAllNiches();
                    if (shouldOpen) setNicheOpen(selectedCard, true);
                });
            });
        })();

        (function initCartDrawer() {
            var cartDrawer = document.getElementById('baderCartDrawer');
            if (!cartDrawer) return;

            var cartBody = cartDrawer.querySelector('[data-bader-cart-body]');
            var cartSubtotal = cartDrawer.querySelector('[data-bader-cart-subtotal]');
            var cartTotal = cartDrawer.querySelector('[data-bader-cart-total]');
            var cartCountEls = cartDrawer.querySelectorAll('[data-bader-cart-count]');
            var clearBtn = cartDrawer.querySelector('[data-bader-cart-clear]');
            var closeBtn = cartDrawer.querySelector('.bader-cart-drawer__close');
            var currentLines = [];
            var isLoading = false;
            var closeDelayMs = 280;
            var closeTimer = null;
            var lastFocusedElement = null;

            function parseIntSafe(value, fallback) {
                var parsed = parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
                return isNaN(parsed) ? fallback : parsed;
            }

            function escapeHtml(value) {
                return String(value || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function updateHeaderBadge(totalQty) {
                var qty = Math.max(0, parseIntSafe(totalQty, 0));
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
                    // Ignore storage errors (private mode, permissions, etc.)
                }
            }

            function clearCloseTimer() {
                if (!closeTimer) return;
                clearTimeout(closeTimer);
                closeTimer = null;
            }

            function finalizeClose() {
                clearCloseTimer();
                cartDrawer.classList.remove('is-open', 'is-closing');
                cartDrawer.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('bader-cart-drawer-open');

                if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
                    lastFocusedElement.focus();
                }
                lastFocusedElement = null;
            }

            function renderLoading() {
                if (!cartBody) return;
                cartBody.innerHTML = '<div class="bader-cart-drawer__loading">Cargando carrito...</div>';
            }

            function setClearButtonState(disabled) {
                if (!clearBtn) return;
                clearBtn.disabled = !!disabled;
            }

            function renderState(state) {
                if (!cartBody) return;

                cartCountEls.forEach(function (el) {
                    el.textContent = String(state.qty || 0);
                });
                if (cartSubtotal) cartSubtotal.textContent = state.subtotal || '-';
                if (cartTotal) cartTotal.textContent = state.total || state.subtotal || '-';

                if (!state.lines.length) {
                    cartBody.innerHTML =
                        '<div class="bader-cart-drawer__empty">' +
                        '<i class="fa fa-shopping-bag"></i>' +
                        '<h4>Tu carrito esta vacio</h4>' +
                        '<p>Explora nuestros productos y agrega lo que necesites.</p>' +
                        '</div>';
                    return;
                }

                var html = '<div class="bader-cart-drawer__items">';
                state.lines.forEach(function (line) {
                    var imageHtml = line.image ?
                        '<img src="' + escapeHtml(line.image) + '" alt="' + escapeHtml(line.name) + '">' :
                        '<i class="fa fa-cube"></i>';

                    html += '<article class="bader-cart-drawer__item">' +
                        '<a class="bader-cart-drawer__thumb" href="' + escapeHtml(line.url || '/shop/cart') + '">' + imageHtml + '</a>' +
                        '<div class="bader-cart-drawer__meta">' +
                        '<strong>' + escapeHtml(line.name) + '</strong>' +
                        '<div class="bader-cart-drawer__price">' + escapeHtml(line.price) + '</div>' +
                        '<div class="bader-cart-drawer__qty">' +
                        '<button type="button" data-bader-cart-action="decrease" data-line-id="' + line.lineId + '" data-product-id="' + line.productId + '" data-current-qty="' + line.qty + '">-</button>' +
                        '<span>' + line.qty + '</span>' +
                        '<button type="button" data-bader-cart-action="increase" data-line-id="' + line.lineId + '" data-product-id="' + line.productId + '" data-current-qty="' + line.qty + '">+</button>' +
                        '</div>' +
                        '</div>' +
                        '<button type="button" class="bader-cart-drawer__remove" data-bader-cart-action="remove" data-line-id="' + line.lineId + '" data-product-id="' + line.productId + '" data-current-qty="' + line.qty + '" aria-label="Eliminar producto">' +
                        '<i class="fa fa-trash"></i>' +
                        '</button>' +
                        '</article>';
                });
                html += '</div>';
                cartBody.innerHTML = html;
            }

            function parseCartPopoverHtml(html) {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, 'text/html');
                var lines = [];

                doc.querySelectorAll('.bader-cart-popover__item').forEach(function (item) {
                    var lineId = parseIntSafe(item.getAttribute('data-line-id'), 0);
                    var productId = parseIntSafe(item.getAttribute('data-product-id'), 0);
                    var nameEl = item.querySelector('.bader-cart-popover__meta strong');
                    var qtyEl = item.querySelector('.bader-cart-popover__qty');
                    var priceEl = item.querySelector('.bader-cart-popover__price');
                    var imageEl = item.querySelector('img');
                    var qty = parseIntSafe(qtyEl ? qtyEl.textContent : '', 1);

                    lines.push({
                        lineId: lineId,
                        productId: productId,
                        name: nameEl ? nameEl.textContent.trim() : 'Producto',
                        qty: Math.max(1, qty),
                        price: priceEl ? priceEl.textContent.trim() : '-',
                        image: imageEl ? imageEl.getAttribute('src') : '',
                        url: item.getAttribute('data-product-url') || '/shop/cart',
                    });
                });

                var totalsRows = doc.querySelectorAll('.bader-cart-popover__row');
                var subtotal = '-';
                if (totalsRows.length) {
                    var subtotalStrong = totalsRows[0].querySelector('strong');
                    subtotal = subtotalStrong ? subtotalStrong.textContent.trim() : subtotal;
                }

                var qtyNode = doc.querySelector('.o_wsale_cart_quantity');
                var qty = parseIntSafe(qtyNode ? qtyNode.textContent : '', 0);
                if (!qty) {
                    qty = lines.reduce(function (total, line) {
                        return total + (line.qty || 0);
                    }, 0);
                }

                return {
                    lines: lines,
                    subtotal: subtotal,
                    total: subtotal,
                    qty: qty,
                };
            }

            function loadCartState() {
                if (isLoading) return Promise.resolve();
                isLoading = true;
                setClearButtonState(true);
                renderLoading();

                return fetch('/shop/cart?type=popover&_=' + Date.now(), {
                    method: 'GET',
                    credentials: 'same-origin',
                })
                    .then(function (response) {
                        if (!response.ok) throw new Error('invalid cart response');
                        return response.text();
                    })
                    .then(function (html) {
                        var state = parseCartPopoverHtml(html);
                        currentLines = state.lines;
                        renderState(state);
                        updateHeaderBadge(state.qty);
                    })
                    .catch(function () {
                        currentLines = [];
                        renderState({ lines: [], subtotal: '-', total: '-', qty: 0 });
                    })
                    .finally(function () {
                        isLoading = false;
                        setClearButtonState(false);
                    });
            }

            function updateLineQty(lineId, productId, setQty) {
                return fetch('/shop/cart/update_json', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: {
                            line_id: lineId,
                            product_id: productId,
                            set_qty: Math.max(0, setQty),
                        },
                    }),
                })
                    .then(function (response) {
                        if (!response.ok) throw new Error('invalid update response');
                        return response.json();
                    })
                    .then(function (payload) {
                        var data = payload && payload.result ? payload.result : payload || {};
                        if (typeof data.cart_quantity !== 'undefined') {
                            updateHeaderBadge(data.cart_quantity);
                        }
                        return data;
                    });
            }

            function openCartDrawer() {
                clearCloseTimer();
                lastFocusedElement = document.activeElement;

                var megaPanel = document.getElementById('baderMegaMenu');
                if (megaPanel) megaPanel.classList.remove('bader-mega--open');

                var mobileCollapse = document.getElementById('top_menu_collapse');
                if (mobileCollapse && mobileCollapse.classList.contains('show')) {
                    mobileCollapse.classList.remove('show');
                    mobileCollapse.style.height = '';
                    document.body.classList.remove('bader-mobile-menu-open');
                    var mobileToggler = document.querySelector('header#top .navbar-toggler');
                    if (mobileToggler) {
                        mobileToggler.classList.add('collapsed');
                        mobileToggler.setAttribute('aria-expanded', 'false');
                    }
                }

                cartDrawer.classList.remove('is-closing');
                cartDrawer.classList.add('is-open');
                cartDrawer.setAttribute('aria-hidden', 'false');
                document.body.classList.add('bader-cart-drawer-open');
                if (closeBtn) closeBtn.focus();
                loadCartState();
            }

            function closeCartDrawer() {
                if (!cartDrawer.classList.contains('is-open') && !cartDrawer.classList.contains('is-closing')) return;
                clearCloseTimer();
                cartDrawer.classList.remove('is-open');
                cartDrawer.classList.add('is-closing');
                cartDrawer.setAttribute('aria-hidden', 'true');
                closeTimer = setTimeout(finalizeClose, closeDelayMs);
            }

            function normalizeHref(href) {
                return String(href || '')
                    .replace(/^https?:\/\/[^/]+/i, '')
                    .trim();
            }

            function findCartTrigger(target) {
                if (!target || !target.closest) return null;
                var anchor = target.closest('#top a[href], #top_menu a[href]');
                if (!anchor || anchor.classList.contains('js_change_lang')) return null;

                var href = normalizeHref(anchor.getAttribute('href'));
                if (!href) return null;
                if (/^\/shop\/cart\/update\b/i.test(href)) return null;
                if (!/^\/shop\/cart(?:$|[/?#])/i.test(href)) return null;

                return anchor;
            }

            document.addEventListener('mouseenter', function (ev) {
                var trigger = findCartTrigger(ev.target);
                if (!trigger) return;
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === 'function') {
                    ev.stopImmediatePropagation();
                }
            }, true);

            document.addEventListener('click', function (ev) {
                var trigger = findCartTrigger(ev.target);
                if (!trigger) return;
                if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

                ev.preventDefault();
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === 'function') {
                    ev.stopImmediatePropagation();
                }
                openCartDrawer();
            }, true);

            cartDrawer.querySelectorAll('[data-bader-cart-close]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    closeCartDrawer();
                });
            });

            document.addEventListener('keydown', function (ev) {
                var isOpen = cartDrawer.classList.contains('is-open');
                if (ev.key === 'Escape' && (isOpen || cartDrawer.classList.contains('is-closing'))) {
                    closeCartDrawer();
                    return;
                }
                if (!isOpen || ev.key !== 'Tab') return;

                var focusable = cartDrawer.querySelectorAll(
                    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (!focusable.length) return;

                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                var active = document.activeElement;

                if (ev.shiftKey && active === first) {
                    ev.preventDefault();
                    last.focus();
                } else if (!ev.shiftKey && active === last) {
                    ev.preventDefault();
                    first.focus();
                }
            });

            cartDrawer.addEventListener('click', function (ev) {
                var link = ev.target.closest('a[href]');
                if (!link || !cartDrawer.contains(link)) return;
                closeCartDrawer();
            });

            if (cartBody) {
                cartBody.addEventListener('click', function (ev) {
                    var actionBtn = ev.target.closest('[data-bader-cart-action]');
                    if (!actionBtn || isLoading) return;

                    ev.preventDefault();
                    var lineId = parseIntSafe(actionBtn.getAttribute('data-line-id'), 0);
                    var productId = parseIntSafe(actionBtn.getAttribute('data-product-id'), 0);
                    var currentQty = parseIntSafe(actionBtn.getAttribute('data-current-qty'), 1);
                    var action = actionBtn.getAttribute('data-bader-cart-action');
                    var nextQty = currentQty;

                    if (!lineId || !productId) return;
                    if (action === 'increase') nextQty = currentQty + 1;
                    if (action === 'decrease') nextQty = currentQty - 1;
                    if (action === 'remove') nextQty = 0;
                    if (nextQty < 0) nextQty = 0;

                    updateLineQty(lineId, productId, nextQty)
                        .then(loadCartState)
                        .catch(function () { });
                });
            }

            if (clearBtn) {
                clearBtn.addEventListener('click', function () {
                    if (!currentLines.length || isLoading) return;
                    isLoading = true;
                    setClearButtonState(true);
                    renderLoading();
                    var linesToClear = currentLines.slice();

                    Promise.all(linesToClear.map(function (line) {
                        return updateLineQty(line.lineId, line.productId, 0);
                    }))
                        .catch(function () { })
                        .finally(function () {
                            isLoading = false;
                            loadCartState();
                        });
                });
            }

            document.addEventListener('bader:cart-open', function () {
                openCartDrawer();
            });
        })();

        // ---- 2. Fade-in on Scroll (IntersectionObserver) ----
        var animatedEls = document.querySelectorAll('.bader-animate');
        if (animatedEls.length > 0 && 'IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('bader-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.1, rootMargin: '0px 0px -20px 0px' });

            animatedEls.forEach(function (el) {
                observer.observe(el);
            });
        } else {
            animatedEls.forEach(function (el) {
                el.classList.add('bader-visible');
            });
        }

        // ---- 3. Testimonials Carousel ----
        var slides = document.querySelectorAll('.bader-testimonial-slide');
        var dots = document.querySelectorAll('.bader-testimonials__dot');
        var prevBtn = document.getElementById('testimonialPrev');
        var nextBtn = document.getElementById('testimonialNext');
        var currentSlide = 0;
        var totalSlides = slides.length;

        function showSlide(index) {
            if (totalSlides === 0) return;
            currentSlide = ((index % totalSlides) + totalSlides) % totalSlides;

            slides.forEach(function (slide) {
                slide.style.display = 'none';
                slide.classList.remove('active');
            });
            dots.forEach(function (dot) { dot.classList.remove('active'); });

            if (slides[currentSlide]) {
                slides[currentSlide].style.display = 'block';
                slides[currentSlide].classList.add('active');
            }
            if (dots[currentSlide]) {
                dots[currentSlide].classList.add('active');
            }
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', function () { showSlide(currentSlide - 1); });
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', function () { showSlide(currentSlide + 1); });
        }
        dots.forEach(function (dot) {
            dot.addEventListener('click', function () {
                showSlide(parseInt(this.getAttribute('data-slide'), 10));
            });
        });

        if (totalSlides > 1) {
            setInterval(function () { showSlide(currentSlide + 1); }, 6000);
        }

        // ---- 4. Header Scroll Effect ----
        var header = document.querySelector('header#top');
        if (header) {
            window.addEventListener('scroll', function () {
                var scrollY = window.pageYOffset || document.documentElement.scrollTop;
                if (scrollY > 50) {
                    header.classList.add('o_header_is_scrolled');
                } else {
                    header.classList.remove('o_header_is_scrolled');
                }
            }, { passive: true });
        }

        // ---- 5. Hero Persona Tab Switching ----
        (function initPersonaTabs() {
            var tabs = document.querySelectorAll('.bader-hero__tab[data-persona]');
            if (tabs.length === 0) return;
            var personas = ['clinica', 'laboratorio', 'estudiantes'];
            var wrap = document.getElementById('wrap');
            var defaultPersona = (wrap && wrap.getAttribute('data-bader-home-persona')) || '';
            var isLockedPersona = (wrap && wrap.getAttribute('data-bader-home-persona-locked') === '1');
            var canAutoRotate = (wrap && wrap.getAttribute('data-bader-home-persona-autorotate') === '1');
            var urlParams = new URLSearchParams(window.location.search || '');
            var queryPersona = (urlParams.get('persona') || urlParams.get('perfil') || urlParams.get('niche') || '').toLowerCase();
            var storedPersona = '';
            try {
                storedPersona = (window.localStorage.getItem('bader_home_persona') || '').toLowerCase();
            } catch (err) {
                storedPersona = '';
            }
            if (personas.indexOf(queryPersona) !== -1) {
                defaultPersona = queryPersona;
                canAutoRotate = false;
            } else if (personas.indexOf(storedPersona) !== -1) {
                defaultPersona = storedPersona;
                canAutoRotate = false;
            }
            if (personas.indexOf(defaultPersona) === -1) {
                defaultPersona = 'clinica';
            }

            var personaMeta = {
                clinica: {
                    stats: [
                        { value: '10,000+', label: 'Clientes satisfechos' },
                        { value: '4.7', label: 'Google Reviews' },
                        { value: '1,300+', label: 'Productos' },
                    ],
                    cta: { label: 'Equipar mi clinica', href: '/clinica-dental' },
                    testimonial: {
                        text: 'Los equipos Bader transformaron la experiencia de mis pacientes. Es como tener tecnologia del futuro hoy.',
                        author: 'Dra. Maria Garcia',
                        role: 'Odontologa, Buenos Aires',
                    },
                },
                laboratorio: {
                    stats: [
                        { value: '800+', label: 'Distribuidores' },
                        { value: '1,300+', label: 'Productos' },
                        { value: '24/7', label: 'Soporte tecnico' },
                    ],
                    cta: { label: 'Ver equipos para lab', href: '/laboratorio-dental' },
                    testimonial: {
                        text: 'La calidad de nuestras piezas mejoro un 40% desde que usamos equipos Bader.',
                        author: 'Tec. Carlos Rodriguez',
                        role: 'Lab Dental Premium, Cordoba',
                    },
                },
                estudiantes: {
                    stats: [
                        { value: '10,000+', label: 'Clientes' },
                        { value: '12', label: 'Cuotas sin interes' },
                        { value: '800+', label: 'Distribuidores' },
                    ],
                    cta: { label: 'Plan estudiantes', href: '/estudiantes-odontologia' },
                    testimonial: {
                        text: 'Gracias al plan estudiantes pude equipar mi primer consultorio antes de graduarme.',
                        author: 'Lucas Mendoza',
                        role: 'Estudiante UBA, 5to ano',
                    },
                },
            };

            function applyPersonaMeta(persona) {
                var meta = personaMeta[persona] || personaMeta.clinica;
                var statNumbers = document.querySelectorAll('.bader-hero__inline-stats .bader-hero__stat-num');
                var statLabels = document.querySelectorAll('.bader-hero__inline-stats .bader-hero__stat-label');
                var i = 0;

                for (i = 0; i < statNumbers.length && i < meta.stats.length; i++) {
                    statNumbers[i].textContent = meta.stats[i].value;
                }
                for (i = 0; i < statLabels.length && i < meta.stats.length; i++) {
                    statLabels[i].textContent = meta.stats[i].label;
                }

                var ctaBtn = document.querySelector('.bader-hero__actions .btn-bader');
                if (ctaBtn) {
                    ctaBtn.setAttribute('href', meta.cta.href);
                    ctaBtn.textContent = meta.cta.label + ' ';
                    var icon = document.createElement('i');
                    icon.className = 'fa fa-arrow-right';
                    ctaBtn.appendChild(icon);
                }

                var testimonialText = document.querySelector('.bader-hero__testimonial-text');
                if (testimonialText) {
                    testimonialText.textContent = '"' + meta.testimonial.text + '"';
                }

                var testimonialAuthor = document.querySelector('.bader-hero__testimonial-author strong');
                if (testimonialAuthor) {
                    testimonialAuthor.textContent = meta.testimonial.author;
                }

                var testimonialRole = document.querySelector('.bader-hero__testimonial-author span');
                if (testimonialRole) {
                    testimonialRole.textContent = meta.testimonial.role;
                }
            }

            function personaIndex(persona) {
                var idx = personas.indexOf(persona);
                return idx === -1 ? 0 : idx;
            }

            function switchPersona(persona) {
                // Tabs
                tabs.forEach(function (t) {
                    t.classList.toggle('bader-hero__tab--active', t.getAttribute('data-persona') === persona);
                });
                // Text content blocks
                document.querySelectorAll('[data-persona-content]').forEach(function (el) {
                    var isMatch = el.getAttribute('data-persona-content') === persona;
                    el.style.display = isMatch ? '' : 'none';
                    el.classList.toggle('bader-hero__persona--active', isMatch);
                });
                // Hero images
                document.querySelectorAll('[data-persona-img]').forEach(function (img) {
                    var isMatch = img.getAttribute('data-persona-img') === persona;
                    img.style.display = isMatch ? '' : 'none';
                    img.classList.toggle('bader-hero__persona-img--active', isMatch);
                });
                // Bottom progress indicators
                document.querySelectorAll('[data-persona-indicator]').forEach(function (dot) {
                    dot.classList.toggle('is-active', dot.getAttribute('data-persona-indicator') === persona);
                });

                applyPersonaMeta(persona);
            }

            function persistPersona(persona) {
                if (!window.fetch || personas.indexOf(persona) === -1) return;
                try {
                    window.localStorage.setItem('bader_home_persona', persona);
                } catch (err) {
                    // Ignore storage errors.
                }
                fetch('/bader/home/set_persona', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: { persona: persona },
                    }),
                }).catch(function () {
                    // Keep UX working even if persistence fails.
                });
            }

            tabs.forEach(function (tab) {
                tab.addEventListener('click', function (e) {
                    e.preventDefault();
                    var persona = this.getAttribute('data-persona');
                    currentIdx = personaIndex(persona);
                    switchPersona(persona);
                    persistPersona(persona);
                });
            });

            // Also clicking progress indicators switches persona
            document.querySelectorAll('[data-persona-indicator]').forEach(function (dot) {
                dot.addEventListener('click', function () {
                    var persona = this.getAttribute('data-persona-indicator');
                    currentIdx = personaIndex(persona);
                    switchPersona(persona);
                    persistPersona(persona);
                });
            });

            // Initial persona from server/session and optional auto-rotation.
            var currentIdx = personaIndex(defaultPersona);
            switchPersona(personas[currentIdx]);
            if (personas.indexOf(queryPersona) !== -1) {
                persistPersona(defaultPersona);
            }
            if (!isLockedPersona && canAutoRotate) {
                setInterval(function () {
                    currentIdx = (currentIdx + 1) % personas.length;
                    switchPersona(personas[currentIdx]);
                }, 6000);
            }
        })();

        // ---- 6. Counter Animation (CountUp) ----
        (function initCounters() {
            var counters = document.querySelectorAll('[data-count-to]');
            if (counters.length === 0) return;

            function animateCounter(el) {
                var raw = el.getAttribute('data-count-to');
                var suffix = el.getAttribute('data-count-suffix') || '';
                var target = parseFloat(raw.replace(/,/g, ''));
                var isDecimal = raw.indexOf('.') !== -1;
                var duration = 2000; // ms
                var startTime = null;

                function step(timestamp) {
                    if (!startTime) startTime = timestamp;
                    var progress = Math.min((timestamp - startTime) / duration, 1);
                    // Ease out cubic
                    var eased = 1 - Math.pow(1 - progress, 3);
                    var current = target * eased;

                    if (isDecimal) {
                        el.textContent = current.toFixed(1) + suffix;
                    } else {
                        var formatted = Math.floor(current).toLocaleString('es-AR');
                        el.textContent = formatted + suffix;
                    }

                    if (progress < 1) {
                        requestAnimationFrame(step);
                    }
                }

                el.textContent = isDecimal ? '0.0' : '0';
                requestAnimationFrame(step);
            }

            if ('IntersectionObserver' in window) {
                var counterObserver = new IntersectionObserver(function (entries) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            animateCounter(entry.target);
                            counterObserver.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.3 });

                counters.forEach(function (el) {
                    counterObserver.observe(el);
                });
            } else {
                // Fallback: just show the value
                counters.forEach(function (el) {
                    el.textContent = el.getAttribute('data-count-to') + (el.getAttribute('data-count-suffix') || '');
                });
            }
        })();

        // ---- 7. Product Gallery — Lightbox Zoom ----
        (function initGalleryLightbox() {
            var mainImage = document.querySelector('#product_detail .carousel-inner img, #product_detail .o_carousel_product_outer img');
            if (!mainImage) return;

            mainImage.style.cursor = 'zoom-in';

            mainImage.addEventListener('click', function () {
                var src = this.src;

                // Create lightbox safely (no innerHTML with user data)
                var lightbox = document.createElement('div');
                lightbox.className = 'bader-lightbox';

                var content = document.createElement('div');
                content.className = 'bader-lightbox__content';

                var closeBtn = document.createElement('button');
                closeBtn.className = 'bader-lightbox__close';
                closeBtn.textContent = '\u00D7';

                var img = document.createElement('img');
                img.src = src;
                img.alt = 'Zoom del producto';

                content.appendChild(closeBtn);
                content.appendChild(img);
                lightbox.appendChild(content);

                document.body.appendChild(lightbox);
                document.body.style.overflow = 'hidden';

                // Close on click
                lightbox.addEventListener('click', function (e) {
                    if (e.target === lightbox || e.target.classList.contains('bader-lightbox__close')) {
                        document.body.removeChild(lightbox);
                        document.body.style.overflow = '';
                    }
                });

                // Close on ESC
                function onEsc(e) {
                    if (e.key === 'Escape') {
                        if (document.body.contains(lightbox)) {
                            document.body.removeChild(lightbox);
                            document.body.style.overflow = '';
                        }
                        document.removeEventListener('keydown', onEsc);
                    }
                }
                document.addEventListener('keydown', onEsc);
            });
        })();

        // ---- 8. Quantity Selector ± (Product Detail) ----
        (function initQtySelector() {
            var qtyInput = document.querySelector('#product_detail input[name="add_qty"], #product_detail .css_quantity input');
            if (!qtyInput) return;

            var parent = qtyInput.closest('.input-group, .css_quantity');
            if (!parent) return;

            // Style the buttons
            var buttons = parent.querySelectorAll('a, button');
            buttons.forEach(function (btn) {
                btn.classList.add('bader-qty-btn');
            });
        })();

        // ---- 9. Add-to-Cart Animation Feedback ----
        (function initAddToCartFeedback() {
            var addBtn = document.querySelector('#product_detail #add_to_cart, #product_detail .a-submit');
            if (!addBtn) return;

            function parseIntSafe(raw, fallback) {
                var parsed = parseInt(String(raw || '').replace(/[^\d-]/g, ''), 10);
                return isNaN(parsed) ? fallback : parsed;
            }

            function renderHeaderCartQty(totalQty) {
                var qty = Math.max(0, parseIntSafe(totalQty, 0));
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

            function addToCartJson(form) {
                var productInput = form.querySelector('input[name="product_id"]');
                var qtyInput = form.querySelector('input[name="add_qty"], .css_quantity input');
                var productId = parseIntSafe(productInput ? productInput.value : '', 0);
                var addQty = parseIntSafe(qtyInput ? qtyInput.value : '1', 1);
                if (!productId) {
                    return Promise.reject(new Error('missing product id'));
                }
                if (addQty <= 0) addQty = 1;

                return fetch('/shop/cart/update_json', {
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
                            add_qty: addQty,
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
                        renderHeaderCartQty(data.cart_quantity);
                    }
                    document.dispatchEvent(new Event('bader:cart-open'));
                });
            }

            addBtn.addEventListener('click', function (ev) {
                var btn = this;
                var originalText = btn.innerHTML;
                var form = btn.closest('form');
                var shouldForceSubmit = !!(
                    form &&
                    btn.matches &&
                    btn.matches('a.a-submit[href="#"], a.a-submit[href=""]')
                );

                if (shouldForceSubmit) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof ev.stopImmediatePropagation === 'function') {
                        ev.stopImmediatePropagation();
                    }
                }

                btn.classList.add('bader-added');
                btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> ¡Agregado!';

                setTimeout(function () {
                    btn.classList.remove('bader-added');
                    btn.innerHTML = originalText;
                }, 2000);

                if (shouldForceSubmit && !btn.getAttribute('data-bader-force-submit')) {
                    btn.setAttribute('data-bader-force-submit', '1');
                    addToCartJson(form).catch(function () {
                        form.submit();
                    }).finally(function () {
                        btn.removeAttribute('data-bader-force-submit');
                    });
                }
            });
        })();

        // ---- 9b. Header Cart Badge Sync ----
        (function syncHeaderCartBadge() {
            var badgeSelector = '.my_cart_quantity, .o_wsale_my_cart .my_cart_quantity';
            var maxBadgeQty = 99;
            var lastRenderedQty = null;
            var syncScheduled = false;

            function parseQty(raw) {
                var cleaned = (raw || '').replace(/[^\d]/g, '');
                var qty = parseInt(cleaned, 10);
                return isNaN(qty) ? null : qty;
            }

            function qtyFromPopover() {
                if (document.querySelector('.bader-cart-popover--empty')) {
                    return 0;
                }
                var rows = document.querySelectorAll('.bader-cart-popover__item');
                if (!rows.length) return null;

                var total = 0;
                rows.forEach(function (row) {
                    var qtyEl = row.querySelector('.bader-cart-popover__meta span');
                    var qty = parseQty(qtyEl ? qtyEl.textContent : '');
                    total += qty === null ? 1 : qty;
                });
                return total;
            }

            function qtyFromCartLines() {
                if (document.querySelector('.js_cart_lines.bader-empty-cart')) {
                    return 0;
                }
                var qtyInputs = document.querySelectorAll('.js_cart_lines .js_quantity');
                if (!qtyInputs.length) return null;

                var total = 0;
                qtyInputs.forEach(function (input) {
                    var qty = parseQty(input.value);
                    if (qty !== null) total += qty;
                });
                return total;
            }

            function computeQty() {
                var fromPopover = qtyFromPopover();
                if (fromPopover !== null) return fromPopover;
                return qtyFromCartLines();
            }

            function renderQty(totalQty) {
                if (totalQty === null) return;
                if (lastRenderedQty === totalQty) return;

                var badgeText = totalQty > maxBadgeQty ? String(maxBadgeQty) + '+' : String(totalQty);
                document.querySelectorAll(badgeSelector).forEach(function (badge) {
                    if (badge.textContent !== badgeText) {
                        badge.textContent = badgeText;
                    }
                    if (badge.classList.contains('d-none')) {
                        badge.classList.remove('d-none');
                    }
                });
                lastRenderedQty = totalQty;
            }

            function syncQty() {
                renderQty(computeQty());
            }

            function scheduleSync() {
                if (syncScheduled) return;
                syncScheduled = true;
                window.requestAnimationFrame(function () {
                    syncScheduled = false;
                    syncQty();
                });
            }

            syncQty();
            setTimeout(scheduleSync, 350);
            setTimeout(scheduleSync, 1200);

            if ('MutationObserver' in window) {
                // Observe cart content changes only; observing the cart badge container itself
                // can create recursive mutation loops and freeze the UI.
                var observer = new MutationObserver(scheduleSync);
                [
                    document.querySelector('.bader-cart-popover'),
                    document.querySelector('.js_cart_lines'),
                ].forEach(function (root) {
                    if (root) {
                        observer.observe(root, { childList: true, subtree: true, characterData: true });
                    }
                });
            }

            document.addEventListener('change', function (ev) {
                if (ev.target && ev.target.matches('.js_cart_lines .js_quantity')) {
                    scheduleSync();
                }
            });
        })();

        // ---- 10. SHOP GRID — Bader AR Style Enhancements ----
        (function initShopEnhancements() {
            var shopPage = document.querySelector('.oe_website_sale');
            if (!shopPage) return;

            // Don't run on product detail pages
            if (document.querySelector('#product_detail')) return;

            // ── 10a. Hero Section + Segment Cards ── (DISABLED per user request)
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

        // ---- 11. Product Detail — Full Bader AR Style ----
        (function initProductDetailEnhancements() {
            var productPage = document.querySelector('#product_detail, .oe_website_sale .o_wsale_product_page');
            if (!productPage) return;

            productPage.classList.add('bader-product-detail');
            if (productPage.querySelector('.bader-product-meta')) return;

            // ── 11a. Floating Stock Badge on Gallery ──
            (function injectStockBadge() {
                var gallery = document.querySelector('.o_carousel_product_outer, #product_detail .carousel, #product_detail img[itemprop="image"]');
                if (!gallery || document.querySelector('.bader-stock-floating')) return;

                var galleryParent = gallery.closest('.col-lg-6, .col-md-6') || gallery.parentElement;
                if (galleryParent) {
                    galleryParent.style.position = 'relative';
                    var badge = document.createElement('div');
                    badge.className = 'bader-stock-floating';
                    badge.innerHTML = '<i class="fa fa-check-circle"></i> En stock';
                    galleryParent.insertBefore(badge, galleryParent.firstChild);
                }
            })();

            // ── 11b. Category Breadcrumb + Star Rating ──
            (function injectMetaInfo() {
                var productName = document.querySelector('[itemprop="name"], #product_detail h1, .product_name');
                if (!productName || document.querySelector('.bader-detail-meta')) return;

                // Build category breadcrumb from page breadcrumb
                var breadcrumbs = document.querySelectorAll('.breadcrumb-item, .breadcrumb li');
                var categoryText = '';
                for (var i = 1; i < breadcrumbs.length - 1; i++) {
                    if (categoryText) categoryText += ' / ';
                    categoryText += breadcrumbs[i].textContent.trim();
                }
                if (!categoryText) categoryText = 'Productos';

                var meta = document.createElement('div');
                meta.className = 'bader-detail-meta';
                meta.innerHTML =
                    '<span class="bader-detail-meta__category">' + categoryText + '</span>' +
                    '<div class="bader-detail-meta__rating">' +
                    '<span class="bader-stars">★★★★★</span>' +
                    '<span class="bader-rating-count">(4.9)</span>' +
                    '</div>';

                productName.parentElement.insertBefore(meta, productName);
            })();

            // ── 11c. IVA Note + Installment Breakdown ──
            (function injectPriceDetails() {
                var priceDiv = document.querySelector('.product_price, [itemprop="offers"]');
                if (!priceDiv || document.querySelector('.bader-price-extras')) return;

                var priceEl = priceDiv.querySelector('.oe_price .oe_currency_value, [itemprop="price"]');
                var priceText = priceEl ? priceEl.textContent.trim().replace(/[^\d.,]/g, '') : '';
                var price = parseFloat(priceText.replace(/\./g, '').replace(',', '.'));
                var installmentPrice = price ? (price / 12) : 0;

                // Format installment price
                var formattedInstallment = installmentPrice > 0 ?
                    installmentPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0';

                var extras = document.createElement('div');
                extras.className = 'bader-price-extras';
                extras.innerHTML =
                    '<span class="bader-price-iva">IVA Incluido</span>' +
                    (installmentPrice > 0 ?
                        '<div class="bader-price-installment">' +
                        '<i class="fa fa-credit-card"></i>' +
                        '<span> <strong>12x € ' + formattedInstallment + '</strong> <em>sin interés</em></span>' +
                        '</div>' : '');

                // Remove old IVA note if present
                var oldNote = priceDiv.querySelector('.bader-price-note');
                if (oldNote) oldNote.remove();

                priceDiv.appendChild(extras);
            })();

            // ── 11d. Stock Status with Dot ──
            (function injectStockStatus() {
                var priceExtras = document.querySelector('.bader-price-extras');
                if (!priceExtras || document.querySelector('.bader-detail-stock')) return;

                var stockDiv = document.createElement('div');
                stockDiv.className = 'bader-detail-stock bader-detail-stock--in';
                stockDiv.innerHTML = '<span class="bader-stock-dot"></span> En stock - Envío inmediato';

                priceExtras.parentElement.insertBefore(stockDiv, priceExtras.nextSibling);
            })();

            // ── 11e. "Comprar Ahora" Button + Wishlist/Share ──
            (function injectExtraButtons() {
                var addToCart = document.querySelector('#add_to_cart, .a-submit');
                if (!addToCart || document.querySelector('.bader-buy-now-btn')) return;

                var parent = addToCart.closest('.js_main_product, form') || addToCart.parentElement;
                if (!parent) return;

                // "Comprar Ahora" button
                var buyNow = document.createElement('div');
                buyNow.className = 'bader-extra-actions';
                buyNow.innerHTML =
                    '<button class="bader-buy-now-btn" onclick="document.querySelector(\'#add_to_cart, .a-submit\').click(); setTimeout(function() { window.location.href = \'/shop/cart\'; }, 500);">' +
                    '<i class="fa fa-bolt"></i> Comprar Ahora' +
                    '</button>' +
                    '<div class="bader-action-icons">' +
                    '<button class="bader-action-icon" title="Favoritos"><i class="fa fa-heart-o"></i></button>' +
                    '<button class="bader-action-icon" title="Compartir" onclick="navigator.share ? navigator.share({title: document.title, url: location.href}) : navigator.clipboard.writeText(location.href)"><i class="fa fa-share-alt"></i></button>' +
                    '</div>';

                // Insert after the add-to-cart section
                var submitRow = addToCart.closest('.css_quantity') || addToCart.closest('.row') || addToCart.parentElement;
                if (submitRow && submitRow.parentElement) {
                    submitRow.parentElement.insertBefore(buyNow, submitRow.nextSibling);
                }
            })();

            // ── 11f. Benefits Grid (2×2) ──
            (function injectBenefitsGrid() {
                var existingBenefits = document.querySelector('.bader-product-benefits');
                if (existingBenefits) existingBenefits.remove(); // Remove old linear layout

                var extraActions = document.querySelector('.bader-extra-actions');
                var insertTarget = extraActions || document.querySelector('#add_to_cart, .a-submit');
                if (!insertTarget) return;

                var parent = insertTarget.parentElement;
                if (!parent || document.querySelector('.bader-benefits-grid')) return;

                var grid = document.createElement('div');
                grid.className = 'bader-benefits-grid';
                grid.innerHTML =
                    '<div class="bader-benefits-grid__item">' +
                    '<div class="bader-benefits-grid__icon"><i class="fa fa-truck"></i></div>' +
                    '<div class="bader-benefits-grid__text"><strong>Envío Gratis</strong><span>A todo el país</span></div>' +
                    '</div>' +
                    '<div class="bader-benefits-grid__item">' +
                    '<div class="bader-benefits-grid__icon"><i class="fa fa-shield"></i></div>' +
                    '<div class="bader-benefits-grid__text"><strong>Garantía Europea</strong><span>12 meses oficial</span></div>' +
                    '</div>' +
                    '<div class="bader-benefits-grid__item">' +
                    '<div class="bader-benefits-grid__icon"><i class="fa fa-credit-card"></i></div>' +
                    '<div class="bader-benefits-grid__text"><strong>12 Cuotas</strong><span>Sin interés</span></div>' +
                    '</div>' +
                    '<div class="bader-benefits-grid__item">' +
                    '<div class="bader-benefits-grid__icon"><i class="fa fa-refresh"></i></div>' +
                    '<div class="bader-benefits-grid__text"><strong>Devolución</strong><span>30 días</span></div>' +
                    '</div>';

                parent.appendChild(grid);
            })();

            // ── Cart Page Benefits ──
            (function injectCartBenefits() {
                var path = window.location.pathname || '';
                if (path.indexOf('/shop/cart') !== 0 && path.indexOf('/checkout') !== 0) {
                    return;
                }

                var cartSummary = document.querySelector('#o_cart_summary .card, .js_cart_summary.bader-summary-card, .bader-summary-card');
                if (cartSummary && !cartSummary.querySelector('.bader-checkout-benefits')) {
                    var cartBenefits = document.createElement('div');
                    cartBenefits.className = 'bader-checkout-benefits';
                    cartBenefits.innerHTML =
                        '<div class="bader-benefit">' +
                        '<i class="fa fa-truck"></i>' +
                        '<span>Envío gratis a todo el país</span>' +
                        '</div>' +
                        '<div class="bader-benefit">' +
                        '<i class="fa fa-shield"></i>' +
                        '<span>Pago seguro</span>' +
                        '</div>' +
                        '<div class="bader-benefit">' +
                        '<i class="fa fa-credit-card"></i>' +
                        '<span>Hasta 12 cuotas sin interés</span>' +
                        '</div>';
                    cartSummary.appendChild(cartBenefits);
                }
            })();
        })();

        // ---- 12. Homepage Quiz ----
        (function initHomepageQuiz() {
            var quiz = document.getElementById('baderQuiz');
            if (!quiz) return;

            var steps = Array.prototype.slice.call(
                quiz.querySelectorAll('.bader-quiz__step')
            );
            if (!steps.length) return;

            var progressFill = quiz.querySelector('.bader-quiz__progress-fill');
            var progressText = quiz.querySelector('.bader-quiz__progress-text');
            var questionCounter = quiz.querySelector('.bader-quiz__counter');
            var backBtn = quiz.querySelector('.bader-quiz__back');
            var form = quiz.querySelector('.bader-quiz__form');
            var result = quiz.querySelector('.bader-quiz__result');
            var resetBtn = quiz.querySelector('.bader-quiz__reset');
            var completeBtn = quiz.querySelector('.bader-quiz__complete');

            var currentStep = 0;
            var answers = {};

            function updateProgress() {
                var total = steps.length;
                var pct = Math.round(((currentStep + 1) / total) * 100);

                if (progressFill) progressFill.style.width = pct + '%';
                if (progressText) progressText.textContent = pct + '% completado';
                if (questionCounter) {
                    questionCounter.textContent = 'Pregunta ' + (currentStep + 1) + ' de ' + total;
                }
                if (backBtn) backBtn.style.display = currentStep > 0 ? 'inline-flex' : 'none';
            }

            function showStep(stepIndex) {
                currentStep = Math.max(0, Math.min(stepIndex, steps.length - 1));
                steps.forEach(function (stepEl, index) {
                    stepEl.classList.toggle('is-active', index === currentStep);
                });
                updateProgress();
            }

            function finishQuiz() {
                if (form) form.setAttribute('hidden', 'hidden');
                if (result) result.removeAttribute('hidden');
            }

            steps.forEach(function (stepEl, stepIndex) {
                var optionButtons = stepEl.querySelectorAll('.bader-quiz__option');
                optionButtons.forEach(function (button) {
                    button.addEventListener('click', function () {
                        optionButtons.forEach(function (other) {
                            other.classList.remove('is-selected');
                        });
                        button.classList.add('is-selected');

                        var key = stepEl.getAttribute('data-key') || ('step_' + stepIndex);
                        answers[key] = button.getAttribute('data-value') || '';

                        setTimeout(function () {
                            if (stepIndex < steps.length - 1) {
                                showStep(stepIndex + 1);
                            } else {
                                finishQuiz();
                            }
                        }, 220);
                    });
                });
            });

            if (backBtn) {
                backBtn.addEventListener('click', function () {
                    showStep(currentStep - 1);
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener('click', function () {
                    answers = {};
                    steps.forEach(function (stepEl) {
                        stepEl.querySelectorAll('.bader-quiz__option').forEach(function (option) {
                            option.classList.remove('is-selected');
                        });
                    });
                    if (result) result.setAttribute('hidden', 'hidden');
                    if (form) form.removeAttribute('hidden');
                    showStep(0);
                });
            }

            if (completeBtn) {
                completeBtn.addEventListener('click', function () {
                    var contactSection = document.getElementById('contacto');
                    if (contactSection) {
                        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            }

            showStep(0);
        })();

        // ---- 13. Homepage Chat Widget ----
        (function initHomepageChatWidget() {
            var widget = document.getElementById('baderChatWidget');
            if (!widget) return;

            var bubble = document.getElementById('baderChatBubble');
            var bubbleClose = document.getElementById('baderChatBubbleClose');
            var toggleBtn = document.getElementById('baderChatToggle');
            var panel = document.getElementById('baderChatPanel');
            var minimizeBtn = document.getElementById('baderChatMinimize');
            var closeBtn = document.getElementById('baderChatClose');
            var messages = document.getElementById('baderChatMessages');
            var form = document.getElementById('baderChatForm');
            var input = document.getElementById('baderChatInput');

            if (!toggleBtn || !panel || !messages || !form || !input) return;

            function appendMessage(text, role) {
                var msg = document.createElement('div');
                msg.className = 'bader-chat__msg bader-chat__msg--' + role;
                msg.textContent = text;
                messages.appendChild(msg);
                messages.scrollTop = messages.scrollHeight;
            }

            function buildReply(userText) {
                var text = (userText || '').toLowerCase();
                if (text.indexOf('precio') !== -1 || text.indexOf('costo') !== -1 || text.indexOf('cuota') !== -1) {
                    return 'Trabajamos con financiacion hasta 12 cuotas sin interes. Si queres, te guiamos al producto ideal segun tu presupuesto.';
                }
                if (text.indexOf('sillon') !== -1 || text.indexOf('autoclave') !== -1 || text.indexOf('rayos') !== -1) {
                    return 'Perfecto. En /productos podes filtrar por categoria y nicho para encontrar los equipos que mejor encajan en tu practica.';
                }
                if (text.indexOf('garantia') !== -1 || text.indexOf('servicio') !== -1 || text.indexOf('soporte') !== -1) {
                    return 'Todos los equipos cuentan con garantia oficial y soporte tecnico. Tambien podes solicitar asistencia en /servicios.';
                }
                return 'Puedo ayudarte a elegir productos, precios, financiacion y soporte. Si preferis atencion inmediata, escribinos por WhatsApp.';
            }

            var hasWelcomed = false;
            function ensureWelcome() {
                if (hasWelcomed) return;
                appendMessage('Hola! Soy Nancy AI, tu asistente virtual de Bader Argentina.', 'assistant');
                appendMessage('Fui creada para ayudarte a encontrar el equipo ideal. Que producto estas buscando?', 'assistant');
                hasWelcomed = true;
            }

            function openPanel() {
                panel.removeAttribute('hidden');
                toggleBtn.style.display = 'none';
                if (bubble) bubble.style.display = 'none';
                ensureWelcome();
                input.focus();
            }

            function closePanel() {
                panel.setAttribute('hidden', 'hidden');
                toggleBtn.style.display = '';
            }

            if (bubbleClose && bubble) {
                bubbleClose.addEventListener('click', function () {
                    bubble.style.display = 'none';
                });
            }

            toggleBtn.addEventListener('click', openPanel);
            if (minimizeBtn) minimizeBtn.addEventListener('click', closePanel);
            if (closeBtn) closeBtn.addEventListener('click', closePanel);

            form.addEventListener('submit', function (ev) {
                ev.preventDefault();
                var userText = (input.value || '').trim();
                if (!userText) return;

                appendMessage(userText, 'user');
                input.value = '';

                setTimeout(function () {
                    appendMessage(buildReply(userText), 'assistant');
                }, 300);
            });
        })();

        // ---- 14. Auth Modal (Clerk-like UX, Odoo-native backend) ----
        (function initAuthModal() {
            var modal = document.getElementById('baderAuthModal');
            if (!modal || !window.fetch) return;

            var STORAGE_KEY = 'bader_onboarding_shown';
            var loginForm = modal.querySelector('[data-bader-auth-form="login"]');
            var registerForm = modal.querySelector('[data-bader-auth-form="register"]');
            var messageEl = modal.querySelector('[data-bader-auth-message="1"]');
            var hintEl = modal.querySelector('[data-bader-auth-hint="1"]');
            var tabButtons = modal.querySelectorAll('[data-bader-auth-tab]');
            var personaSelect = modal.querySelector('[data-bader-signup-persona-select="1"]');
            var personaGroups = modal.querySelectorAll('[data-bader-signup-persona]');
            var activeTab = 'login';
            var isSubmitting = false;

            function safeStorageRemove(key) {
                try {
                    if (window.localStorage) window.localStorage.removeItem(key);
                } catch (err) {
                    // Ignore storage errors.
                }
            }

            function normalizeRedirect(path) {
                var value = (path || '').trim();
                if (!value || value.charAt(0) !== '/' || value.indexOf('//') === 0) return '/';
                if (value.indexOf('/web/login') === 0 || value.indexOf('/web/signup') === 0) return '/';
                if (value.indexOf('/bader/auth') === 0) return '/';
                return value;
            }

            function currentRedirectFromWindow() {
                return normalizeRedirect(
                    window.location.pathname + (window.location.search || '') + (window.location.hash || '')
                );
            }

            function rpc(url, params) {
                return fetch(url, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: params || {},
                        id: Date.now(),
                    }),
                }).then(function (response) {
                    if (!response.ok) throw new Error('rpc_http_error');
                    return response.json();
                }).then(function (data) {
                    if (data && data.error) throw new Error((data.error.data && data.error.data.message) || 'rpc_error');
                    return (data && data.result) || {};
                });
            }

            function setMessage(text, isError) {
                if (!messageEl) return;
                messageEl.textContent = text || '';
                messageEl.classList.toggle('is-error', !!isError);
                messageEl.classList.toggle('is-success', !isError && !!text);
            }

            function setSubmitting(flag) {
                isSubmitting = !!flag;
                modal.classList.toggle('is-loading', isSubmitting);
                modal.querySelectorAll('button, input, select').forEach(function (el) {
                    if (el.getAttribute('data-bader-auth-close') === '1') return;
                    el.disabled = isSubmitting;
                });
            }

            function updatePersonaRequired(persona) {
                if (!registerForm) return;
                var clinicRole = registerForm.querySelector('select[name="clinic_role"]');
                var labType = registerForm.querySelector('select[name="lab_type"]');
                var labSpecialization = registerForm.querySelector('select[name="lab_specialization"]');
                var career = registerForm.querySelector('select[name="career"]');
                var studyYear = registerForm.querySelector('select[name="study_year"]');

                if (clinicRole) clinicRole.required = persona === 'clinica';
                if (labType) labType.required = persona === 'laboratorio';
                if (labSpecialization) labSpecialization.required = persona === 'laboratorio';
                if (career) career.required = persona === 'estudiantes';
                if (studyYear) studyYear.required = persona === 'estudiantes';
            }

            function updatePersonaPanels() {
                if (!registerForm) return;
                var persona = personaSelect ? (personaSelect.value || '') : '';
                personaGroups.forEach(function (group) {
                    var key = group.getAttribute('data-bader-signup-persona');
                    var shouldShow = !!persona && key === persona;
                    if (shouldShow) group.removeAttribute('hidden');
                    else group.setAttribute('hidden', 'hidden');
                });
                updatePersonaRequired(persona);
            }

            function applyTabState() {
                tabButtons.forEach(function (btn) {
                    var key = btn.getAttribute('data-bader-auth-tab');
                    btn.classList.toggle('is-active', key === activeTab);
                    btn.setAttribute('aria-selected', key === activeTab ? 'true' : 'false');
                });

                if (activeTab === 'login') {
                    if (loginForm) loginForm.removeAttribute('hidden');
                    if (registerForm) registerForm.setAttribute('hidden', 'hidden');
                    if (hintEl) hintEl.textContent = 'Accede para ver pedidos, facturas y recomendaciones personalizadas.';
                } else {
                    if (registerForm) registerForm.removeAttribute('hidden');
                    if (loginForm) loginForm.setAttribute('hidden', 'hidden');
                    if (hintEl) hintEl.textContent = 'Crea tu cuenta y completa tu perfil profesional para una experiencia personalizada.';
                    updatePersonaPanels();
                }
                setMessage('', false);
            }

            function openModal(tab, redirectPath) {
                activeTab = tab === 'register' ? 'register' : 'login';
                applyTabState();

                var safeRedirect = normalizeRedirect(redirectPath || currentRedirectFromWindow());
                if (loginForm) loginForm.setAttribute('data-redirect', safeRedirect);
                if (registerForm) registerForm.setAttribute('data-redirect', safeRedirect);

                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('bader-auth-modal-open');

                window.setTimeout(function () {
                    var firstInput = modal.querySelector(
                        activeTab === 'login'
                            ? '[data-bader-auth-form="login"] input[name="login"]'
                            : '[data-bader-auth-form="register"] input[name="name"]'
                    );
                    if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
                }, 40);
            }

            function closeModal() {
                if (!modal.classList.contains('is-open') || isSubmitting) return;
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('bader-auth-modal-open');
                setMessage('', false);
            }

            function serializeLoginForm() {
                var formData = new FormData(loginForm);
                return {
                    login: (formData.get('login') || '').toString().trim(),
                    password: (formData.get('password') || '').toString(),
                    redirect: normalizeRedirect(loginForm.getAttribute('data-redirect') || currentRedirectFromWindow()),
                };
            }

            function serializeRegisterForm() {
                var formData = new FormData(registerForm);
                return {
                    name: (formData.get('name') || '').toString().trim(),
                    email: (formData.get('email') || '').toString().trim(),
                    password: (formData.get('password') || '').toString(),
                    confirm_password: (formData.get('confirm_password') || '').toString(),
                    persona: (formData.get('persona') || '').toString(),
                    clinic_role: (formData.get('clinic_role') || '').toString(),
                    clinic_specialties: formData.getAll('clinic_specialties').map(function (v) { return String(v); }),
                    clinic_size: (formData.get('clinic_size') || '').toString(),
                    years_experience: (formData.get('years_experience') || '').toString(),
                    clinic_name: (formData.get('clinic_name') || '').toString(),
                    lab_type: (formData.get('lab_type') || '').toString(),
                    lab_specialization: (formData.get('lab_specialization') || '').toString(),
                    lab_team_size: (formData.get('lab_team_size') || '').toString(),
                    lab_name: (formData.get('lab_name') || '').toString(),
                    career: (formData.get('career') || '').toString(),
                    study_year: (formData.get('study_year') || '').toString(),
                    university: (formData.get('university') || '').toString(),
                    student_city: (formData.get('student_city') || '').toString(),
                    redirect: normalizeRedirect(registerForm.getAttribute('data-redirect') || currentRedirectFromWindow()),
                };
            }

            function humanizeMissingFields(fields) {
                if (!fields || !fields.length) return 'Completa los datos requeridos para terminar el registro.';
                var labels = {
                    clinic_role: 'cargo',
                    clinic_specialties: 'especialidades',
                    lab_type: 'tipo de laboratorio',
                    lab_specialization: 'especializacion principal',
                    career: 'carrera',
                    study_year: 'ano de cursado',
                };
                return 'Falta completar: ' + fields.map(function (key) { return labels[key] || key; }).join(', ') + '.';
            }

            tabButtons.forEach(function (btn) {
                btn.addEventListener('click', function () {
                    if (isSubmitting) return;
                    var tabKey = btn.getAttribute('data-bader-auth-tab');
                    activeTab = tabKey === 'register' ? 'register' : 'login';
                    applyTabState();
                });
            });

            if (personaSelect) {
                personaSelect.addEventListener('change', updatePersonaPanels);
            }

            if (loginForm) {
                loginForm.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    if (isSubmitting) return;

                    var payload = serializeLoginForm();
                    if (!payload.login || !payload.password) {
                        setMessage('Ingresa email y contrasena.', true);
                        return;
                    }

                    setSubmitting(true);
                    setMessage('', false);
                    rpc('/bader/auth/login', payload).then(function (result) {
                        if (!result || !result.ok) {
                            setSubmitting(false);
                            setMessage(
                                (result && result.message) || 'No se pudo iniciar sesion. Verifica tus datos.',
                                true
                            );
                            return;
                        }
                        safeStorageRemove(STORAGE_KEY);
                        window.location.href = normalizeRedirect(result.redirect || '/');
                    }).catch(function () {
                        setSubmitting(false);
                        setMessage('Error de conexion. Intenta nuevamente.', true);
                    });
                });
            }

            if (registerForm) {
                registerForm.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    if (isSubmitting) return;

                    var payload = serializeRegisterForm();
                    if (!payload.persona) {
                        setMessage('Selecciona tu perfil profesional.', true);
                        return;
                    }
                    if (payload.persona === 'clinica' && (!payload.clinic_specialties || !payload.clinic_specialties.length)) {
                        setMessage('Selecciona al menos una especialidad para clinica.', true);
                        return;
                    }

                    setSubmitting(true);
                    setMessage('', false);
                    rpc('/bader/auth/signup', payload).then(function (result) {
                        if (!result || !result.ok) {
                            setSubmitting(false);
                            if (result && result.error === 'missing_required_fields') {
                                setMessage(humanizeMissingFields(result.fields || []), true);
                                return;
                            }
                            setMessage(
                                (result && result.message) || 'No se pudo crear la cuenta.',
                                true
                            );
                            return;
                        }
                        safeStorageRemove(STORAGE_KEY);
                        window.location.href = normalizeRedirect(result.redirect || '/');
                    }).catch(function () {
                        setSubmitting(false);
                        setMessage('Error de conexion. Intenta nuevamente.', true);
                    });
                });
            }

            document.addEventListener('click', function (ev) {
                var target = ev.target;
                if (!target) return;

                var opener = target.closest('[data-bader-auth-open]');
                if (opener) {
                    if (!modal) return;
                    ev.preventDefault();
                    var tab = opener.getAttribute('data-bader-auth-open') || 'login';
                    var redirectPath = opener.getAttribute('data-bader-auth-redirect') || currentRedirectFromWindow();
                    openModal(tab, redirectPath);
                    return;
                }

                if (!modal.classList.contains('is-open')) return;
                var closeTrigger = target.closest && target.closest('[data-bader-auth-close="1"]');
                if (target === modal || closeTrigger) {
                    closeModal();
                }
            });

            document.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && modal.classList.contains('is-open')) {
                    closeModal();
                }
            });

            updatePersonaPanels();
        })();

        // ---- 15. First Login Onboarding (Bader-AR parity) ----
        (function initOnboardingFlow() {
            var bootstrap = document.getElementById('baderOnboardingBootstrap');
            if (!bootstrap || !window.fetch) return;

            var STORAGE_KEY = 'bader_onboarding_shown';
            var modalRoot = null;
            var contentEl = null;
            var progressBarEl = null;
            var stepLabelEl = null;
            var primaryBtn = null;
            var backBtn = null;
            var skipTopBtn = null;
            var skipBottomBtn = null;
            var messageEl = null;
            var isSaving = false;
            var step = 0;

            var personaOptions = [
                { key: 'clinica', title: 'Clinica Dental', desc: 'Consultorios y clinicas odontologicas' },
                { key: 'laboratorio', title: 'Laboratorio Dental', desc: 'Laboratorios de protesis y tecnica dental' },
                { key: 'estudiantes', title: 'Estudiantes', desc: 'Estudiantes de odontologia y carreras afines' },
            ];
            var clinicRoles = [
                { value: 'dueno', label: 'Dueno/a' },
                { value: 'gerente', label: 'Gerente' },
                { value: 'dentista', label: 'Dentista' },
                { value: 'asistente', label: 'Asistente Dental' },
                { value: 'recepcionista', label: 'Recepcionista' },
            ];
            var clinicSpecialties = [
                { value: 'general', label: 'Odontologia General' },
                { value: 'ortodoncia', label: 'Ortodoncia' },
                { value: 'endodoncia', label: 'Endodoncia' },
                { value: 'periodoncia', label: 'Periodoncia' },
                { value: 'implantologia', label: 'Implantologia' },
                { value: 'cirugia', label: 'Cirugia' },
                { value: 'odontopediatria', label: 'Odontopediatria' },
                { value: 'estetica', label: 'Estetica Dental' },
            ];
            var clinicSizes = [
                { value: 'pequena', label: 'Pequena (1-2 sillones)' },
                { value: 'mediana', label: 'Mediana (3-5 sillones)' },
                { value: 'grande', label: 'Grande (6+ sillones)' },
            ];
            var labTypes = [
                { value: 'protesico', label: 'Protesico' },
                { value: 'ortodontico', label: 'Ortodontico' },
                { value: 'cadcam', label: 'CAD/CAM Digital' },
                { value: 'general', label: 'General' },
            ];
            var labSpecializations = [
                { value: 'zirconio', label: 'Zirconio' },
                { value: 'metal-ceramica', label: 'Metal-Ceramica' },
                { value: 'acrilico', label: 'Acrilico' },
                { value: 'alineadores', label: 'Alineadores' },
                { value: 'implantes', label: 'Implantes' },
                { value: 'protesis-removible', label: 'Protesis Removible' },
            ];
            var labTeamSizes = [
                { value: 'solo', label: 'Solo (1 persona)' },
                { value: 'pequeno', label: 'Pequeno (2-5 personas)' },
                { value: 'mediano', label: 'Mediano (6-15 personas)' },
                { value: 'grande', label: 'Grande (16+ personas)' },
            ];
            var studyYears = [
                { value: '1', label: '1 Ano' },
                { value: '2', label: '2 Ano' },
                { value: '3', label: '3 Ano' },
                { value: '4', label: '4 Ano' },
                { value: '5', label: '5 Ano' },
                { value: 'graduado', label: 'Graduado reciente' },
            ];
            var careers = [
                { value: 'odontologia', label: 'Odontologia' },
                { value: 'protesis', label: 'Tecnico en Protesis Dental' },
                { value: 'higienista', label: 'Higienista Dental' },
                { value: 'asistente', label: 'Asistente Dental' },
            ];

            var profile = {
                persona: '',
                clinic_name: '',
                clinic_role: '',
                clinic_specialties: [],
                clinic_size: '',
                years_experience: '',
                lab_name: '',
                lab_type: '',
                lab_specialization: '',
                lab_team_size: '',
                university: '',
                study_year: '',
                career: '',
                student_city: '',
            };

            function safeGetStorage(key) {
                try {
                    return window.localStorage.getItem(key) || '';
                } catch (err) {
                    return '';
                }
            }

            function safeSetStorage(key, value) {
                try {
                    window.localStorage.setItem(key, value);
                } catch (err) {
                    // Ignore storage errors.
                }
            }

            function htmlEscape(value) {
                var text = String(value || '');
                return text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/\"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function renderSelectOptions(options, selectedValue, placeholder) {
                var html = '<option value="">' + htmlEscape(placeholder || 'Selecciona') + '</option>';
                for (var i = 0; i < options.length; i += 1) {
                    var option = options[i];
                    var selected = option.value === selectedValue ? ' selected="selected"' : '';
                    html += '<option value="' + htmlEscape(option.value) + '"' + selected + '>' + htmlEscape(option.label) + '</option>';
                }
                return html;
            }

            function rpc(url, params) {
                return fetch(url, {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'call',
                        params: params || {},
                    }),
                }).then(function (response) {
                    return response.text();
                }).then(function (bodyText) {
                    var payload = {};
                    try {
                        payload = JSON.parse(bodyText || '{}');
                    } catch (err) {
                        payload = {};
                    }
                    return payload && Object.prototype.hasOwnProperty.call(payload, 'result')
                        ? payload.result
                        : payload;
                });
            }

            function mergeProfile(serverProfile) {
                if (!serverProfile) return;
                profile.persona = (serverProfile.persona || '').toLowerCase();
                profile.clinic_name = serverProfile.clinic_name || '';
                profile.clinic_role = serverProfile.clinic_role || '';
                profile.clinic_specialties = Array.isArray(serverProfile.clinic_specialties)
                    ? serverProfile.clinic_specialties.slice(0, 12)
                    : [];
                profile.clinic_size = serverProfile.clinic_size || '';
                profile.years_experience = serverProfile.years_experience || '';
                profile.lab_name = serverProfile.lab_name || '';
                profile.lab_type = serverProfile.lab_type || '';
                profile.lab_specialization = serverProfile.lab_specialization || '';
                profile.lab_team_size = serverProfile.lab_team_size || '';
                profile.university = serverProfile.university || '';
                profile.study_year = serverProfile.study_year || '';
                profile.career = serverProfile.career || '';
                profile.student_city = serverProfile.student_city || '';
            }

            function currentTotalSteps() {
                return 4;
            }

            function canProceedStep() {
                if (step === 0) return true;
                if (step === 1) return !!profile.persona;
                if (step !== 2) return true;

                if (profile.persona === 'clinica') {
                    return !!profile.clinic_role && Array.isArray(profile.clinic_specialties) && profile.clinic_specialties.length > 0;
                }
                if (profile.persona === 'laboratorio') {
                    return !!profile.lab_type && !!profile.lab_specialization;
                }
                if (profile.persona === 'estudiantes') {
                    return !!profile.career && !!profile.study_year;
                }
                return false;
            }

            function personaTitle(personaKey) {
                for (var i = 0; i < personaOptions.length; i += 1) {
                    if (personaOptions[i].key === personaKey) return personaOptions[i].title;
                }
                return 'Profesional';
            }

            function stepOneHtml() {
                return '' +
                    '<div class="bader-onboarding__welcome">' +
                    '<span class="bader-onboarding__icon"><i class="fa fa-sparkles fa-star"></i></span>' +
                    '<h3>Bienvenido a Bader Argentina</h3>' +
                    '<p>Completa tu perfil en 1 minuto para personalizar productos, ofertas y contenido segun tu especialidad.</p>' +
                    '</div>';
            }

            function stepTwoHtml() {
                var cards = '';
                for (var i = 0; i < personaOptions.length; i += 1) {
                    var item = personaOptions[i];
                    var isActive = profile.persona === item.key ? ' is-active' : '';
                    cards += '' +
                        '<button type="button" class="bader-onboarding__persona' + isActive + '" data-onboarding-persona="' + item.key + '">' +
                        '<strong>' + htmlEscape(item.title) + '</strong>' +
                        '<span>' + htmlEscape(item.desc) + '</span>' +
                        '</button>';
                }
                return '' +
                    '<div class="bader-onboarding__step-head">' +
                    '<h3>Selecciona tu perfil</h3>' +
                    '<p>Este dato define recomendaciones y accesos rapidos en toda la web.</p>' +
                    '</div>' +
                    '<div class="bader-onboarding__persona-grid">' + cards + '</div>';
            }

            function clinicQuestionsHtml() {
                var chips = '';
                for (var i = 0; i < clinicSpecialties.length; i += 1) {
                    var spec = clinicSpecialties[i];
                    var selected = profile.clinic_specialties.indexOf(spec.value) !== -1 ? ' is-active' : '';
                    chips += '' +
                        '<button type="button" class="bader-onboarding__chip' + selected + '" data-onboarding-specialty="' + htmlEscape(spec.value) + '">' +
                        htmlEscape(spec.label) +
                        '</button>';
                }

                return '' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Cargo *</label>' +
                    '<select data-onboarding-input="clinic_role">' +
                    renderSelectOptions(clinicRoles, profile.clinic_role, 'Selecciona tu cargo') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Especialidades * (elige al menos una)</label>' +
                    '<div class="bader-onboarding__chips">' + chips + '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Tamano de la clinica</label>' +
                    '<select data-onboarding-input="clinic_size">' +
                    renderSelectOptions(clinicSizes, profile.clinic_size, 'Selecciona el tamano') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Anos de experiencia</label>' +
                    '<input type="number" min="0" max="80" data-onboarding-input="years_experience" value="' + htmlEscape(profile.years_experience) + '" placeholder="Ej: 5"/>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Nombre de la clinica</label>' +
                    '<input type="text" data-onboarding-input="clinic_name" value="' + htmlEscape(profile.clinic_name) + '" placeholder="Ej: Clinica Dental Sonrisa"/>' +
                    '</div>';
            }

            function labQuestionsHtml() {
                return '' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Tipo de laboratorio *</label>' +
                    '<select data-onboarding-input="lab_type">' +
                    renderSelectOptions(labTypes, profile.lab_type, 'Selecciona el tipo') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Especializacion principal *</label>' +
                    '<select data-onboarding-input="lab_specialization">' +
                    renderSelectOptions(labSpecializations, profile.lab_specialization, 'Selecciona especializacion') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Tamano del equipo</label>' +
                    '<select data-onboarding-input="lab_team_size">' +
                    renderSelectOptions(labTeamSizes, profile.lab_team_size, 'Selecciona tamano') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Nombre del laboratorio</label>' +
                    '<input type="text" data-onboarding-input="lab_name" value="' + htmlEscape(profile.lab_name) + '" placeholder="Ej: Laboratorio Dental Elite"/>' +
                    '</div>' +
                    '</div>';
            }

            function studentQuestionsHtml() {
                return '' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Que estudias? *</label>' +
                    '<select data-onboarding-input="career">' +
                    renderSelectOptions(careers, profile.career, 'Selecciona tu carrera') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Ano de cursado *</label>' +
                    '<select data-onboarding-input="study_year">' +
                    renderSelectOptions(studyYears, profile.study_year, 'Selecciona tu ano') +
                    '</select>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Universidad</label>' +
                    '<input type="text" data-onboarding-input="university" value="' + htmlEscape(profile.university) + '" placeholder="Ej: Universidad de Buenos Aires"/>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Ciudad</label>' +
                    '<input type="text" data-onboarding-input="student_city" value="' + htmlEscape(profile.student_city) + '" placeholder="Ej: Buenos Aires"/>' +
                    '</div>' +
                    '</div>';
            }

            function stepThreeHtml() {
                var body = '';
                if (profile.persona === 'clinica') body = clinicQuestionsHtml();
                if (profile.persona === 'laboratorio') body = labQuestionsHtml();
                if (profile.persona === 'estudiantes') body = studentQuestionsHtml();

                return '' +
                    '<div class="bader-onboarding__step-head">' +
                    '<h3>Contanos sobre vos</h3>' +
                    '<p>Perfil seleccionado: <strong>' + htmlEscape(personaTitle(profile.persona)) + '</strong></p>' +
                    '</div>' +
                    body;
            }

            function stepFourHtml() {
                return '' +
                    '<div class="bader-onboarding__done">' +
                    '<span class="bader-onboarding__check"><i class="fa fa-check"/></span>' +
                    '<h3>Todo listo</h3>' +
                    '<p>Guardaremos tu perfil para personalizar productos, descuentos y recursos desde tu cuenta Odoo.</p>' +
                    '<ul>' +
                    '<li>Recomendaciones adaptadas a tu perfil</li>' +
                    '<li>Acceso directo a categorias relevantes</li>' +
                    '<li>Soporte comercial mas preciso</li>' +
                    '</ul>' +
                    '</div>';
            }

            function renderCurrentStep() {
                if (!contentEl) return;
                if (step === 0) contentEl.innerHTML = stepOneHtml();
                if (step === 1) contentEl.innerHTML = stepTwoHtml();
                if (step === 2) contentEl.innerHTML = stepThreeHtml();
                if (step === 3) contentEl.innerHTML = stepFourHtml();
                updateFrame();
            }

            function updateFrame() {
                var total = currentTotalSteps();
                var current = step + 1;
                var pct = Math.round((current / total) * 100);

                if (progressBarEl) progressBarEl.style.width = pct + '%';
                if (stepLabelEl) stepLabelEl.textContent = 'Paso ' + current + ' de ' + total;
                if (backBtn) backBtn.style.display = step > 0 ? '' : 'none';
                if (primaryBtn) {
                    var isLast = step >= 3;
                    primaryBtn.textContent = isLast ? (isSaving ? 'Guardando...' : 'Empezar a explorar') : 'Continuar';
                    primaryBtn.disabled = isSaving || !canProceedStep();
                }
            }

            function closeOnboarding() {
                if (!modalRoot) return;
                modalRoot.classList.remove('is-open');
                document.body.classList.remove('bader-onboarding-open');
                setTimeout(function () {
                    if (modalRoot && modalRoot.parentNode) {
                        modalRoot.parentNode.removeChild(modalRoot);
                    }
                    modalRoot = null;
                }, 180);
            }

            function skipOnboarding() {
                safeSetStorage(STORAGE_KEY, 'true');
                closeOnboarding();
            }

            function toggleSpecialty(value) {
                var current = profile.clinic_specialties || [];
                var idx = current.indexOf(value);
                if (idx === -1) current.push(value);
                else current.splice(idx, 1);
                profile.clinic_specialties = current;
            }

            function saveOnboarding() {
                if (isSaving || !canProceedStep()) return;
                isSaving = true;
                if (messageEl) messageEl.textContent = '';
                updateFrame();

                rpc('/bader/onboarding/save', {
                    persona: profile.persona,
                    clinic_name: profile.clinic_name,
                    clinic_role: profile.clinic_role,
                    clinic_specialties: profile.clinic_specialties || [],
                    clinic_size: profile.clinic_size,
                    years_experience: profile.years_experience,
                    lab_name: profile.lab_name,
                    lab_type: profile.lab_type,
                    lab_specialization: profile.lab_specialization,
                    lab_team_size: profile.lab_team_size,
                    university: profile.university,
                    study_year: profile.study_year,
                    career: profile.career,
                    student_city: profile.student_city,
                }).then(function (result) {
                    isSaving = false;
                    if (!result || !result.ok) {
                        if (messageEl) {
                            messageEl.textContent = 'No se pudo guardar. Revisa los campos obligatorios e intenta nuevamente.';
                        }
                        updateFrame();
                        return;
                    }
                    safeSetStorage(STORAGE_KEY, 'true');
                    closeOnboarding();
                    window.setTimeout(function () {
                        window.location.reload();
                    }, 120);
                }).catch(function () {
                    isSaving = false;
                    if (messageEl) {
                        messageEl.textContent = 'Error de conexion. Intenta nuevamente.';
                    }
                    updateFrame();
                });
            }

            function handleInputChange(target) {
                if (!target) return;
                var key = target.getAttribute('data-onboarding-input');
                if (!key) return;

                if (key === 'years_experience') {
                    var intVal = parseInt(target.value || '0', 10);
                    if (isNaN(intVal) || intVal < 0) intVal = 0;
                    if (intVal > 80) intVal = 80;
                    profile.years_experience = String(intVal);
                } else {
                    profile[key] = target.value || '';
                }
                updateFrame();
            }

            function bindModalEvents() {
                if (!modalRoot) return;

                modalRoot.addEventListener('click', function (ev) {
                    var target = ev.target;
                    if (!target) return;

                    if (target === modalRoot || target.getAttribute('data-onboarding-close') === '1') {
                        skipOnboarding();
                        return;
                    }

                    var personaBtn = target.closest('[data-onboarding-persona]');
                    if (personaBtn) {
                        profile.persona = personaBtn.getAttribute('data-onboarding-persona') || '';
                        renderCurrentStep();
                        return;
                    }

                    var specBtn = target.closest('[data-onboarding-specialty]');
                    if (specBtn) {
                        toggleSpecialty(specBtn.getAttribute('data-onboarding-specialty') || '');
                        specBtn.classList.toggle('is-active');
                        updateFrame();
                        return;
                    }

                    if (target === skipTopBtn || target === skipBottomBtn) {
                        skipOnboarding();
                        return;
                    }

                    if (target === backBtn) {
                        if (step > 0) {
                            step -= 1;
                            renderCurrentStep();
                        }
                        return;
                    }

                    if (target === primaryBtn) {
                        if (step < 3) {
                            if (!canProceedStep()) return;
                            step += 1;
                            renderCurrentStep();
                        } else {
                            saveOnboarding();
                        }
                    }
                });

                modalRoot.addEventListener('change', function (ev) {
                    handleInputChange(ev.target);
                });
                modalRoot.addEventListener('input', function (ev) {
                    handleInputChange(ev.target);
                });
                document.addEventListener('keydown', function (ev) {
                    if (!modalRoot || !modalRoot.classList.contains('is-open')) return;
                    if (ev.key === 'Escape') skipOnboarding();
                });
            }

            function mountModal() {
                if (modalRoot) return;
                modalRoot = document.createElement('div');
                modalRoot.className = 'bader-onboarding';
                modalRoot.innerHTML = '' +
                    '<div class="bader-onboarding__dialog">' +
                    '<div class="bader-onboarding__head">' +
                    '<span class="bader-onboarding__step" data-onboarding-step="1">Paso 1 de 4</span>' +
                    '<button type="button" class="bader-onboarding__skip-top" data-onboarding-close="1" aria-label="Cerrar"><i class="fa fa-times"></i></button>' +
                    '</div>' +
                    '<div class="bader-onboarding__progress"><span data-onboarding-progress="1"></span></div>' +
                    '<div class="bader-onboarding__body" data-onboarding-content="1"></div>' +
                    '<p class="bader-onboarding__message" data-onboarding-message="1"></p>' +
                    '<div class="bader-onboarding__actions">' +
                    '<button type="button" class="btn btn-outline-secondary" data-onboarding-back="1">Volver</button>' +
                    '<button type="button" class="btn-bader" data-onboarding-next="1">Continuar</button>' +
                    '</div>' +
                    '<button type="button" class="bader-onboarding__skip-bottom" data-onboarding-skip="1">Omitir por ahora</button>' +
                    '</div>';

                document.body.appendChild(modalRoot);
                contentEl = modalRoot.querySelector('[data-onboarding-content="1"]');
                progressBarEl = modalRoot.querySelector('[data-onboarding-progress="1"]');
                stepLabelEl = modalRoot.querySelector('[data-onboarding-step="1"]');
                primaryBtn = modalRoot.querySelector('[data-onboarding-next="1"]');
                backBtn = modalRoot.querySelector('[data-onboarding-back="1"]');
                skipTopBtn = modalRoot.querySelector('[data-onboarding-close="1"]');
                skipBottomBtn = modalRoot.querySelector('[data-onboarding-skip="1"]');
                messageEl = modalRoot.querySelector('[data-onboarding-message="1"]');
                bindModalEvents();
                renderCurrentStep();
                document.body.classList.add('bader-onboarding-open');
                setTimeout(function () {
                    if (modalRoot) modalRoot.classList.add('is-open');
                }, 30);
            }

            var alreadyShown = safeGetStorage(STORAGE_KEY) === 'true';
            rpc('/bader/onboarding/state', {}).then(function (result) {
                if (!result || !result.ok || !result.show_onboarding) return;
                if (alreadyShown) return;
                mergeProfile(result.profile || {});
                mountModal();
            }).catch(function () {
                // Keep web functional even if onboarding endpoint fails.
            });
        })();

    } // end initBader

    // Execute: by the time a lazy-loaded Odoo module runs, the DOM is always ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBader);
    } else {
        initBader();
    }

}); // end odoo.define
