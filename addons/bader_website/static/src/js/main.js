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

        // ---- 0. DOMAIN GUARD — keep internal links on current host ----
        (function initDomainGuard() {
            var LEGACY_HOSTS = {
                'shop.bader.com.ar': true,
                'www.shop.bader.com.ar': true,
                'bader.com.ar': true,
                'www.bader.com.ar': true,
                'bader4business.com': true,
                'www.bader4business.com': true,
                'qas.bader4business.com': true,
                'www.qas.bader4business.com': true,
                'bader.es': true,
                'www.bader.es': true,
            };

            function shouldNormalizeHost(hostname) {
                var host = String(hostname || '').toLowerCase();
                if (!host) return false;
                if (LEGACY_HOSTS[host]) return true;
                return /(?:^|\.)bader4business\.com$/.test(host) || /(?:^|\.)bader\.com\.ar$/.test(host) || /(?:^|\.)bader\.es$/.test(host);
            }

            function normalizeToRelative(rawUrl) {
                if (!rawUrl) return '';
                var value = String(rawUrl).trim();
                if (!value) return '';
                if (value.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(value)) return '';
                var parsed;
                try {
                    parsed = new URL(value, window.location.origin);
                } catch (err) {
                    return '';
                }
                if (!shouldNormalizeHost(parsed.hostname)) return '';
                if (parsed.host === window.location.host) return '';
                return (parsed.pathname || '/') + (parsed.search || '') + (parsed.hash || '');
            }

            function normalizeAnchor(anchor) {
                if (!anchor || !anchor.getAttribute) return;
                var normalized = normalizeToRelative(anchor.getAttribute('href'));
                if (!normalized) return;
                anchor.setAttribute('href', normalized);
                if ((anchor.getAttribute('target') || '').toLowerCase() === '_blank') {
                    anchor.removeAttribute('target');
                }
            }

            function normalizeForm(form) {
                if (!form || !form.getAttribute) return;
                var normalized = normalizeToRelative(form.getAttribute('action'));
                if (!normalized) return;
                form.setAttribute('action', normalized);
            }

            document.querySelectorAll('a[href]').forEach(normalizeAnchor);
            document.querySelectorAll('form[action]').forEach(normalizeForm);

            // Safety net: if third-party code rewrites href/action later, force local navigation on interaction.
            document.addEventListener('click', function (ev) {
                var target = ev.target;
                if (!target || !target.closest) return;
                var anchor = target.closest('a[href]');
                if (!anchor) return;
                var normalized = normalizeToRelative(anchor.getAttribute('href'));
                if (!normalized) return;
                anchor.setAttribute('href', normalized);
                if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
                ev.preventDefault();
                window.location.href = normalized;
            }, true);

            document.addEventListener('submit', function (ev) {
                var form = ev.target;
                if (!form || !form.getAttribute) return;
                var normalized = normalizeToRelative(form.getAttribute('action'));
                if (!normalized) return;
                form.setAttribute('action', normalized);
            }, true);

            // Keep observer lightweight. Attribute-level observation over the full DOM
            // can be very expensive on Odoo pages with dynamic widgets.
            if ('MutationObserver' in window && document.body) {
                var observer = new MutationObserver(function (mutations) {
                    mutations.forEach(function (mutation) {
                        mutation.addedNodes.forEach(function (node) {
                            if (!node || node.nodeType !== 1) return;
                            if (node.matches && node.matches('a[href]')) normalizeAnchor(node);
                            if (node.matches && node.matches('form[action]')) normalizeForm(node);
                            if (node.querySelectorAll) {
                                node.querySelectorAll('a[href]').forEach(normalizeAnchor);
                                node.querySelectorAll('form[action]').forEach(normalizeForm);
                            }
                        });
                    });
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });

                // This guard is mainly useful during initial render and async widgets mount.
                // Disconnect after a while to avoid perpetual mutation costs on long sessions.
                window.setTimeout(function () {
                    if (observer && observer.disconnect) {
                        observer.disconnect();
                    }
                }, 25000);
            }
        })();

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
            var modal = document.getElementById('baderAiSearchModal');
            var form = modal ? modal.querySelector('[data-bader-ai-form]') : null;
            var input = modal ? modal.querySelector('[data-bader-ai-input]') : null;
            var voiceBtn = modal ? modal.querySelector('[data-bader-ai-voice]') : null;
            var closeTriggers = modal ? modal.querySelectorAll('[data-bader-ai-close]') : [];
            var quickQueryButtons = modal ? modal.querySelectorAll('[data-bader-ai-query]') : [];
            var filterButtons = modal ? modal.querySelectorAll('[data-bader-ai-filter]') : [];
            var activeFilter = '';
            var recognition = null;
            var isListening = false;
            var filterDefaults = {
                clinica: 'equipamiento para clínica dental',
                laboratorio: 'equipos para laboratorio dental',
                estudiantes: 'kit para estudiantes odontología',
            };

            function closeMobileDrawerIfNeeded() {
                var collapse = document.getElementById('top_menu_collapse');
                var toggler = document.querySelector('header#top .navbar-toggler');
                if (!collapse || !collapse.classList.contains('show')) return;
                collapse.classList.remove('show');
                collapse.style.height = '';
                if (toggler) {
                    toggler.classList.add('collapsed');
                    toggler.setAttribute('aria-expanded', 'false');
                }
                document.body.classList.remove('bader-mobile-menu-open');
            }

            function updateFilterButtons() {
                filterButtons.forEach(function (btn) {
                    var key = btn.getAttribute('data-bader-ai-filter') || '';
                    var selected = key === activeFilter;
                    btn.classList.toggle('is-active', selected);
                    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
                });
            }

            function setFilter(nextFilter) {
                if (!nextFilter) {
                    activeFilter = '';
                } else {
                    activeFilter = (activeFilter === nextFilter) ? '' : nextFilter;
                }
                updateFilterButtons();
            }

            function stopListening() {
                if (!recognition || !isListening) return;
                try {
                    recognition.stop();
                } catch (err) {
                    // ignore speech api stop errors
                }
            }

            function closeSearch() {
                if (!modal || !modal.classList.contains('is-open')) return;
                stopListening();
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('bader-ai-search-open');
            }

            function openSearch(e) {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                if (!modal) {
                    window.location.href = '/productos';
                    return;
                }
                closeMobileDrawerIfNeeded();
                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('bader-ai-search-open');
                if (input) {
                    window.setTimeout(function () {
                        input.focus();
                        input.select();
                    }, 80);
                }
            }

            function buildSearchUrl(rawValue) {
                var query = (rawValue || '').trim();
                if (!query && activeFilter) {
                    query = filterDefaults[activeFilter] || '';
                }
                if (!query) return '';
                var url = new URL('/productos', window.location.origin);
                url.searchParams.set('search', query);
                if (activeFilter) url.searchParams.set('persona', activeFilter);
                return url.pathname + url.search;
            }

            function submitSearch(rawValue) {
                var targetUrl = buildSearchUrl(rawValue || (input ? input.value : ''));
                if (!targetUrl) {
                    if (input) {
                        input.classList.add('is-invalid');
                        input.focus();
                    }
                    return;
                }
                window.location.href = targetUrl;
            }

            if (input) {
                input.addEventListener('input', function () {
                    input.classList.remove('is-invalid');
                });
            }

            if (desktopPill) desktopPill.addEventListener('click', openSearch);
            if (mobilePill) mobilePill.addEventListener('click', openSearch);

            if (modal) {
                if (form) {
                    form.addEventListener('submit', function (ev) {
                        ev.preventDefault();
                        submitSearch();
                    });
                }

                quickQueryButtons.forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var query = btn.getAttribute('data-bader-ai-query') || '';
                        if (input) input.value = query;
                        submitSearch(query);
                    });
                });

                filterButtons.forEach(function (btn) {
                    btn.addEventListener('click', function () {
                        var key = btn.getAttribute('data-bader-ai-filter') || '';
                        setFilter(key);
                    });
                });

                closeTriggers.forEach(function (btn) {
                    btn.addEventListener('click', closeSearch);
                });

                modal.addEventListener('click', function (ev) {
                    if (ev.target === modal) closeSearch();
                });

                var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SpeechRecognition && voiceBtn) {
                    voiceBtn.disabled = true;
                    voiceBtn.title = 'Búsqueda por voz no disponible en este navegador';
                }
                if (SpeechRecognition && voiceBtn) {
                    recognition = new SpeechRecognition();
                    recognition.lang = 'es-AR';
                    recognition.continuous = false;
                    recognition.interimResults = false;
                    recognition.maxAlternatives = 1;

                    recognition.onstart = function () {
                        isListening = true;
                        voiceBtn.classList.add('is-listening');
                    };
                    recognition.onend = function () {
                        isListening = false;
                        voiceBtn.classList.remove('is-listening');
                    };
                    recognition.onerror = function () {
                        isListening = false;
                        voiceBtn.classList.remove('is-listening');
                    };
                    recognition.onresult = function (ev) {
                        var transcript = '';
                        if (ev && ev.results && ev.results[0] && ev.results[0][0]) {
                            transcript = (ev.results[0][0].transcript || '').trim();
                        }
                        if (transcript) {
                            if (input) input.value = transcript;
                            submitSearch(transcript);
                        }
                    };

                    voiceBtn.addEventListener('click', function () {
                        if (!recognition) return;
                        if (isListening) {
                            stopListening();
                            return;
                        }
                        try {
                            recognition.start();
                        } catch (err) {
                            // ignore duplicate start errors
                        }
                    });
                }

                updateFilterButtons();
            }

            document.addEventListener('keydown', function (e) {
                var key = (e.key || '').toLowerCase();
                if (key === 'escape' && modal && modal.classList.contains('is-open')) {
                    e.preventDefault();
                    closeSearch();
                    return;
                }
                if (key !== 'q' || e.ctrlKey || e.altKey || e.metaKey) return;
                var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable)) return;
                e.preventDefault();
                openSearch(e);
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
        // ---- 3. Testimonials Carousel moved to static/src/js/home_page.js (homepage-only load) ----

        // ---- 4. Header Scroll Effect ----
        var header = document.querySelector('header#top');
        if (header) {
            var headerScrollScheduled = false;
            window.addEventListener('scroll', function () {
                if (headerScrollScheduled) return;
                headerScrollScheduled = true;
                window.requestAnimationFrame(function () {
                    var scrollY = window.pageYOffset || document.documentElement.scrollTop;
                    if (scrollY > 50) {
                        header.classList.add('o_header_is_scrolled');
                    } else {
                        header.classList.remove('o_header_is_scrolled');
                    }
                    headerScrollScheduled = false;
                });
            }, { passive: true });
        }
        // ---- 5. Hero Persona Tab Switching moved to static/src/js/home_page.js (homepage-only load) ----

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

        // ---- Product-detail enhancements moved to static/src/js/product_page.js (product-only load) ----
        // ---- 12/13. Homepage Quiz + Chat moved to static/src/js/home_page.js (homepage-only load) ----

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


