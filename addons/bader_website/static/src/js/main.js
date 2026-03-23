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

        // Prevent initial flicker: keep in-view animated blocks visible
        // before enabling JS-only animation state.
        var initialAnimatedEls = document.querySelectorAll('.bader-animate');
        if (initialAnimatedEls.length) {
            var viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
            initialAnimatedEls.forEach(function (el) {
                var rect = el.getBoundingClientRect();
                if (rect.top < viewportHeight && rect.bottom > 0) {
                    el.classList.add('bader-visible');
                }
            });
        }

        // Mark body as JS-ready
        document.body.classList.add('bader-js-ready');

        // Product page runtime fallback loader.
        // Guarantees product_page.js executes even when template-injected
        // <script src> nodes are present but not executed by the browser.
        (function ensureProductPageScript() {
            if (!document.querySelector('#product_detail')) return;

            function isProductPageScriptReady() {
                return !!(window.__baderPageScripts && window.__baderPageScripts.productPage);
            }

            window.setTimeout(function () {
                if (isProductPageScriptReady()) return;
                if (!document.body) return;
                if (document.querySelector('script[data-bader-loader=\"product\"]')) return;

                var assetToken = 'bader';
                var frontendAsset =
                    document.querySelector('script[src*=\"web.assets_frontend_lazy.min.js\"]') ||
                    document.querySelector('script[src*=\"web.assets_frontend.min.js\"]') ||
                    document.querySelector('link[href*=\"web.assets_frontend.min.css\"]') ||
                    document.querySelector('script[src*=\"/web/assets/\"]') ||
                    document.querySelector('link[href*=\"/web/assets/\"]');
                var assetUrl = frontendAsset ? (frontendAsset.getAttribute('src') || frontendAsset.getAttribute('href') || '') : '';
                var tokenMatch = assetUrl.match(/\/web\/assets\/([^/]+)\//);
                if (tokenMatch && tokenMatch[1]) {
                    assetToken = tokenMatch[1];
                }

                var script = document.createElement('script');
                script.type = 'text/javascript';
                script.src = '/bader_website/static/src/js/product_page.js?v=' + encodeURIComponent(assetToken);
                script.setAttribute('data-bader-loader', 'product');
                document.body.appendChild(script);
            }, 120);
        })();

        // ---- 0. DOMAIN GUARD — keep internal links on current host ----
        (function initDomainGuard() {
            var headerEl = document.querySelector('header#top');
            var rawHosts = headerEl ? (headerEl.getAttribute('data-bader-internal-hosts') || '') : '';
            var INTERNAL_HOSTS = rawHosts
                .split(/[\s,;]+/)
                .map(function (value) { return String(value || '').trim().toLowerCase(); })
                .filter(function (value) { return value; });

            if (window.location.hostname) {
                INTERNAL_HOSTS.push(String(window.location.hostname).toLowerCase());
            }

            function shouldNormalizeHost(hostname) {
                var host = String(hostname || '').toLowerCase();
                if (!host) return false;
                return INTERNAL_HOSTS.some(function (alias) {
                    return host === alias || host.slice(-1 * (alias.length + 1)) === '.' + alias;
                });
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
            var studioModal = document.getElementById('baderSearchStudioModal');
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

            if (studioModal) {
                if (modal) {
                    modal.setAttribute('hidden', 'hidden');
                    modal.setAttribute('aria-hidden', 'true');
                }
                return;
            }

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

        (function initSearchStudio() {
            var desktopPill = document.getElementById('baderSearchPill');
            var mobilePill = document.getElementById('baderSearchPillMobile');
            var legacyModal = document.getElementById('baderAiSearchModal');
            var modal = document.getElementById('baderSearchStudioModal');
            var form = modal ? modal.querySelector('[data-bader-ai-form]') : null;
            var input = modal ? modal.querySelector('[data-bader-ai-input]') : null;
            var voiceBtn = modal ? modal.querySelector('[data-bader-ai-voice]') : null;
            var filterButtons = modal ? modal.querySelectorAll('[data-bader-ai-filter]') : [];
            var stateEls = modal ? modal.querySelectorAll('[data-bader-search-state]') : [];
            var collectionEls = modal ? modal.querySelectorAll('[data-bader-search-collection]') : [];
            var statusEl = modal ? modal.querySelector('[data-bader-search-status]') : null;
            var recentEl = modal ? modal.querySelector('[data-bader-search-recent]') : null;
            var recentProductsEl = modal ? modal.querySelector('[data-bader-search-recent-products]') : null;
            var suggestionsEl = modal ? modal.querySelector('[data-bader-search-suggestions]') : null;
            var categoriesEl = modal ? modal.querySelector('[data-bader-search-categories]') : null;
            var heroEl = modal ? modal.querySelector('[data-bader-search-hero]') : null;
            var productsEl = modal ? modal.querySelector('[data-bader-search-products]') : null;
            var relatedEl = modal ? modal.querySelector('[data-bader-search-related]') : null;
            var emptyRelatedEl = modal ? modal.querySelector('[data-bader-search-empty-related]') : null;
            var viewAllLink = modal ? modal.querySelector('[data-bader-search-view-all]') : null;
            var emptyViewAllLink = modal ? modal.querySelector('[data-bader-search-empty-view-all]') : null;
            var contextWrapEl = modal ? modal.querySelector('[data-bader-search-context]') : null;
            var contextTitleEl = modal ? modal.querySelector('[data-bader-search-context-title]') : null;
            var contextBodyEl = modal ? modal.querySelector('[data-bader-search-context-body]') : null;
            var contextCurrentEl = modal ? modal.querySelector('[data-bader-search-context-current]') : null;
            var contextProductsEl = modal ? modal.querySelector('[data-bader-search-context-products]') : null;
            var contextQueriesEl = modal ? modal.querySelector('[data-bader-search-context-queries]') : null;
            var queryContextEl = modal ? modal.querySelector('[data-bader-search-query-context]') : null;
            var emptyContextEl = modal ? modal.querySelector('[data-bader-search-empty-context]') : null;
            var activeFilter = '';
            var recognition = null;
            var isListening = false;
            var pendingRequest = null;
            var debounceTimer = null;
            var searchCache = {};
            var contextCache = {};
            var SEARCH_RECENT_STORAGE_KEY = 'baderSearchRecentV1';
            var SEARCH_PERSONA_STORAGE_KEY = 'baderSearchPersona';
            var SEARCH_RECENT_VIEWED_STORAGE_KEY = 'baderRecentViewedProductIdsV1';
            var filterLabels = {
                clinica: 'Clinicas',
                laboratorio: 'Laboratorios',
                estudiantes: 'Estudiantes',
                mayorista: 'Mayoristas',
            };

            if (!modal) return;

            if (legacyModal) {
                legacyModal.setAttribute('hidden', 'hidden');
                legacyModal.setAttribute('aria-hidden', 'true');
            }

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

            function escapeHtml(value) {
                return String(value || '')
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function readStorage(key) {
                try {
                    return window.localStorage ? window.localStorage.getItem(key) || '' : '';
                } catch (err) {
                    return '';
                }
            }

            function writeStorage(key, value) {
                try {
                    if (!window.localStorage) return;
                    if (!value) {
                        window.localStorage.removeItem(key);
                        return;
                    }
                    window.localStorage.setItem(key, value);
                } catch (err) {
                    // Ignore storage failures.
                }
            }

            function readRecentSearches() {
                var raw = readStorage(SEARCH_RECENT_STORAGE_KEY);
                if (!raw) return [];
                try {
                    var parsed = JSON.parse(raw);
                    return Array.isArray(parsed) ? parsed : [];
                } catch (err) {
                    return [];
                }
            }

            function writeRecentSearches(items) {
                try {
                    if (!window.localStorage) return;
                    window.localStorage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify(items || []));
                } catch (err) {
                    // Ignore storage failures.
                }
            }

            function saveRecentSearch(query) {
                var value = String(query || '').trim();
                if (value.length < 2) return;
                var next = readRecentSearches().filter(function (item) {
                    return String(item || '').trim().toLowerCase() !== value.toLowerCase();
                });
                next.unshift(value);
                writeRecentSearches(next.slice(0, 6));
                renderRecentSearches();
            }

            function renderRecentSearches() {
                if (!recentEl) return;
                var recentSearches = readRecentSearches();
                if (!recentSearches.length) {
                    recentEl.innerHTML = '<p class="bader-ai-search__hint">Todavia no hay historial reciente.</p>';
                    return;
                }
                recentEl.innerHTML = recentSearches.map(function (query) {
                    return (
                        '<button type="button" class="bader-ai-search__recent-chip" data-bader-ai-query="' + escapeHtml(query) + '" data-bader-search-nav="1">' +
                        '<i class="fa fa-history"></i>' +
                        '<span>' + escapeHtml(query) + '</span>' +
                        '</button>'
                    );
                }).join('');
            }

            function readRecentViewedProductIds() {
                var raw = readStorage(SEARCH_RECENT_VIEWED_STORAGE_KEY);
                if (!raw) return [];
                try {
                    var parsed = JSON.parse(raw);
                    if (!Array.isArray(parsed)) return [];
                    return parsed
                        .map(function (item) {
                            return parseInt(String(item || '').replace(/[^\d]/g, ''), 10);
                        })
                        .filter(function (item) {
                            return !isNaN(item) && item > 0;
                        });
                } catch (err) {
                    return [];
                }
            }

            function currentProductIdFromPage() {
                var productRoot = document.querySelector('#product_detail[data-bader-product-id]');
                if (!productRoot) return 0;
                var parsed = parseInt(String(productRoot.getAttribute('data-bader-product-id') || '').replace(/[^\d]/g, ''), 10);
                return isNaN(parsed) ? 0 : parsed;
            }

            function currentProductUrlFromPage() {
                var productRoot = document.querySelector('#product_detail[data-bader-product-url]');
                return productRoot ? (productRoot.getAttribute('data-bader-product-url') || '') : '';
            }

            function setState(name) {
                stateEls.forEach(function (section) {
                    section.classList.toggle('is-active', section.getAttribute('data-bader-search-state') === name);
                });
            }

            function setStatus(text) {
                if (statusEl) statusEl.textContent = text || '';
            }

            function updateFilterButtons() {
                filterButtons.forEach(function (btn) {
                    var key = btn.getAttribute('data-bader-ai-filter') || '';
                    var selected = key === activeFilter;
                    btn.classList.toggle('is-active', selected);
                    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
                });
            }

            function updateCollections() {
                collectionEls.forEach(function (card) {
                    var key = card.getAttribute('data-bader-search-collection') || '';
                    var shouldShow = !activeFilter ? key === 'clinica' : key === activeFilter;
                    card.classList.toggle('is-active', shouldShow);
                });
            }

            function buildSearchUrl(rawValue) {
                var query = String(rawValue || '').trim();
                var url = new URL('/productos', window.location.origin);
                if (query) url.searchParams.set('search', query);
                if (activeFilter) url.searchParams.set('persona', activeFilter);
                return query || activeFilter ? (url.pathname + url.search) : '/productos';
            }

            function setFilter(nextFilter, options) {
                var settings = options || {};
                if (!nextFilter) {
                    activeFilter = '';
                } else if (settings.force) {
                    activeFilter = nextFilter;
                } else {
                    activeFilter = activeFilter === nextFilter ? '' : nextFilter;
                }
                writeStorage(SEARCH_PERSONA_STORAGE_KEY, activeFilter);
                updateFilterButtons();
                updateCollections();

                if (settings.skipRefresh) return;
                if (input && String(input.value || '').trim().length >= 2) {
                    requestResults(input.value, true);
                } else {
                    resetResults();
                    loadSearchContext(true);
                }
            }

            function stopListening() {
                if (!recognition || !isListening) return;
                try {
                    recognition.stop();
                } catch (err) {
                    // Ignore stop errors.
                }
            }

            function abortPendingRequest() {
                if (!pendingRequest || !pendingRequest.abort) return;
                try {
                    pendingRequest.abort();
                } catch (err) {
                    // Ignore abort errors.
                }
                pendingRequest = null;
            }

            function formatPrice(value, currencyCode, currencySymbol) {
                var amount = parseFloat(value);
                if (!isFinite(amount)) return '';
                try {
                    return new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: currencyCode || 'EUR',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }).format(amount);
                } catch (err) {
                    return (currencySymbol || 'EUR') + ' ' + amount.toFixed(2).replace('.', ',');
                }
            }

            function renderRecentProducts(items) {
                if (!recentProductsEl) return;
                if (!items || !items.length) {
                    recentProductsEl.innerHTML = '<p class="bader-ai-search__hint">Todavia no abriste productos recientes en este navegador.</p>';
                    return;
                }
                recentProductsEl.innerHTML = items.map(function (product) {
                    return (
                        '<a href="' + escapeHtml(product.url || '/productos') + '" class="bader-ai-search__recent-product" data-bader-search-nav="1">' +
                        '<span class="bader-ai-search__recent-product-media">' +
                        '<img src="' + escapeHtml(product.image_url || '') + '" alt="' + escapeHtml(product.name || 'Producto') + '" loading="lazy"/>' +
                        '</span>' +
                        '<span class="bader-ai-search__recent-product-copy">' +
                        (product.category ? '<small>' + escapeHtml(product.category) + '</small>' : '') +
                        '<strong>' + escapeHtml(product.name || 'Producto') + '</strong>' +
                        '<em>' + escapeHtml(formatPrice(product.price_value, product.currency_code, product.currency_symbol)) + '</em>' +
                        '</span>' +
                        '</a>'
                    );
                }).join('');
            }

            function renderContextQueries(items) {
                if (!contextQueriesEl) return;
                if (!items || !items.length) {
                    contextQueriesEl.innerHTML = '<p class="bader-ai-search__hint">Abrir una ficha tecnica mostrara repuestos y compatibilidades sugeridas aqui.</p>';
                    return;
                }
                contextQueriesEl.innerHTML = items.map(function (label) {
                    return (
                        '<button type="button" class="bader-ai-search__context-query" data-bader-ai-query="' + escapeHtml(label) + '" data-bader-search-nav="1">' +
                        escapeHtml(label) +
                        '</button>'
                    );
                }).join('');
            }

            function renderContextProducts(items) {
                if (!contextProductsEl) return;
                if (!items || !items.length) {
                    contextProductsEl.innerHTML = '<p class="bader-ai-search__hint">Sin complementos destacados todavia. Prueba con una busqueda por SKU o categoria.</p>';
                    return;
                }
                contextProductsEl.innerHTML = items.map(function (product) {
                    return (
                        '<a href="' + escapeHtml(product.url || '/productos') + '" class="bader-ai-search__context-product" data-bader-search-nav="1">' +
                        '<span class="bader-ai-search__context-product-media">' +
                        '<img src="' + escapeHtml(product.image_url || '') + '" alt="' + escapeHtml(product.name || 'Producto') + '" loading="lazy"/>' +
                        '</span>' +
                        '<span class="bader-ai-search__context-product-copy">' +
                        (product.category ? '<small>' + escapeHtml(product.category) + '</small>' : '') +
                        '<strong>' + escapeHtml(product.name || 'Producto') + '</strong>' +
                        '<em>' + escapeHtml(formatPrice(product.price_value, product.currency_code, product.currency_symbol)) + '</em>' +
                        '</span>' +
                        '</a>'
                    );
                }).join('');
            }

            function renderCurrentContext(product) {
                if (!contextCurrentEl) return;
                if (!product) {
                    contextCurrentEl.innerHTML = '';
                    return;
                }
                contextCurrentEl.innerHTML =
                    '<article class="bader-ai-search__context-current-card">' +
                    '<span class="bader-ai-search__context-current-media">' +
                    '<img src="' + escapeHtml(product.image_url || '') + '" alt="' + escapeHtml(product.name || 'Producto') + '" loading="lazy"/>' +
                    '</span>' +
                    '<div class="bader-ai-search__context-current-copy">' +
                    '<div class="bader-ai-search__context-current-meta">' +
                    '<span>Ficha actual</span>' +
                    (product.category ? '<span>' + escapeHtml(product.category) + '</span>' : '') +
                    '</div>' +
                    '<h5>' + escapeHtml(product.name || 'Producto') + '</h5>' +
                    '<p>' + escapeHtml(product.excerpt || '') + '</p>' +
                    '<div class="bader-ai-search__context-current-bottom">' +
                    '<strong>' + escapeHtml(formatPrice(product.price_value, product.currency_code, product.currency_symbol)) + '</strong>' +
                    '<a href="' + escapeHtml(product.url || currentProductUrlFromPage() || '/productos') + '" data-bader-search-nav="1">Abrir ficha</a>' +
                    '</div>' +
                    '</div>' +
                    '</article>';
            }

            function renderContext(payload) {
                var contextData = payload || {};
                renderRecentProducts(contextData.recent_products || []);
                renderCurrentContext(contextData.current_product || null);
                renderContextProducts(contextData.focus_products || []);
                renderContextQueries(contextData.compatibility_queries || []);

                if (!contextWrapEl) return;
                var hasProductContext = !!(
                    contextData.current_product ||
                    (contextData.focus_products && contextData.focus_products.length) ||
                    (contextData.compatibility_queries && contextData.compatibility_queries.length)
                );
                contextWrapEl.hidden = !hasProductContext;
                if (contextTitleEl) {
                    contextTitleEl.textContent = contextData.context_title || 'Complementa este producto';
                }
                if (contextBodyEl) {
                    contextBodyEl.textContent = contextData.context_body || 'Accesorios, repuestos y consultas utiles para seguir desde la ficha actual.';
                }
            }

            function loadSearchContext(forceRefresh) {
                var currentProductId = currentProductIdFromPage();
                var recentIds = readRecentViewedProductIds().filter(function (item) {
                    return item !== currentProductId;
                }).slice(0, 6);

                if (!currentProductId && !recentIds.length) {
                    renderContext(null);
                    return Promise.resolve(null);
                }

                if (!window.fetch) {
                    renderContext(null);
                    return Promise.resolve(null);
                }

                var cacheKey = [
                    activeFilter || 'general',
                    currentProductId || 0,
                    recentIds.join(',')
                ].join('|');

                if (!forceRefresh && contextCache[cacheKey]) {
                    renderContext(contextCache[cacheKey]);
                    return Promise.resolve(contextCache[cacheKey]);
                }

                var requestUrl = new URL('/bader/search/context', window.location.origin);
                if (currentProductId) requestUrl.searchParams.set('product_id', String(currentProductId));
                if (activeFilter) requestUrl.searchParams.set('persona', activeFilter);
                if (recentIds.length) requestUrl.searchParams.set('recent_ids', recentIds.join(','));
                requestUrl.searchParams.set('limit', '4');

                return window.fetch(requestUrl.toString(), {
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                }).then(function (response) {
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    return response.json();
                }).then(function (payload) {
                    contextCache[cacheKey] = payload || {};
                    renderContext(payload || {});
                    return payload || {};
                }).catch(function () {
                    renderContext(null);
                    return null;
                });
            }

            function renderSuggestions(items) {
                if (!suggestionsEl) return;
                if (!items || !items.length) {
                    suggestionsEl.innerHTML = '<p class="bader-ai-search__hint">Empieza a escribir para recibir sugerencias.</p>';
                    return;
                }
                suggestionsEl.innerHTML = items.map(function (label) {
                    return (
                        '<button type="button" class="bader-ai-search__suggestion" data-bader-ai-query="' + escapeHtml(label) + '" data-bader-search-nav="1">' +
                        '<i class="fa fa-search"></i>' +
                        '<span>' + escapeHtml(label) + '</span>' +
                        '</button>'
                    );
                }).join('');
            }

            function renderCategories(items) {
                if (!categoriesEl) return;
                if (!items || !items.length) {
                    categoriesEl.innerHTML = '';
                    return;
                }
                categoriesEl.innerHTML = items.map(function (item) {
                    return (
                        '<a href="' + escapeHtml(item.url || '/productos') + '" class="bader-ai-search__category-pill" data-bader-search-nav="1">' +
                        '<span class="bader-ai-search__category-name">' + escapeHtml(item.label || 'Categoria') + '</span>' +
                        '<strong>' + escapeHtml(String(item.product_count || 0)) + ' productos</strong>' +
                        '</a>'
                    );
                }).join('');
            }

            function renderHeroResult(product, queryContext) {
                if (!heroEl) return;
                if (!product) {
                    heroEl.innerHTML = '';
                    return;
                }
                var contextData = queryContext || {};
                var contextQueries = (contextData.queries || []).slice(0, 3);
                var contextProducts = contextData.products || [];
                var currentContextProduct = contextData.current_product || null;
                var heroContextMarkup = '';
                if (contextData.has_context && currentContextProduct) {
                    heroContextMarkup =
                        '<section class="bader-ai-search__hero-context">' +
                        '<div class="bader-ai-search__hero-context-head">' +
                        '<div>' +
                        '<span class="bader-ai-search__context-eyebrow">Relacionado con la ficha actual</span>' +
                        '<strong>' + escapeHtml(contextData.title || 'Seguir desde esta ficha') + '</strong>' +
                        '</div>' +
                        '<span class="bader-ai-search__hero-context-count">' + escapeHtml(String(contextProducts.length || 0)) + ' vinculados</span>' +
                        '</div>' +
                        '<div class="bader-ai-search__hero-context-current">' +
                        '<span>' + escapeHtml(currentContextProduct.name || 'Producto actual') + '</span>' +
                        '<a href="' + escapeHtml(currentContextProduct.url || currentProductUrlFromPage() || '/productos') + '" data-bader-search-nav="1">Abrir ficha</a>' +
                        '</div>' +
                        (contextQueries.length
                            ? '<div class="bader-ai-search__hero-context-queries">' +
                              contextQueries.map(function (label) {
                                  return (
                                      '<button type="button" class="bader-ai-search__hero-context-chip" data-bader-ai-query="' + escapeHtml(label) + '" data-bader-search-nav="1">' +
                                      escapeHtml(label) +
                                      '</button>'
                                  );
                              }).join('') +
                              '</div>'
                            : '') +
                        '</section>';
                }
                heroEl.innerHTML =
                    '<article class="bader-ai-search__hero-card">' +
                    '<div class="bader-ai-search__hero-media">' +
                    '<img src="' + escapeHtml(product.image_url || '') + '" alt="' + escapeHtml(product.name || 'Producto') + '" loading="lazy"/>' +
                    '</div>' +
                    '<div class="bader-ai-search__hero-copy">' +
                    '<div class="bader-ai-search__hero-meta">' +
                    (product.category ? '<span>' + escapeHtml(product.category) + '</span>' : '') +
                    (product.sku ? '<span>SKU ' + escapeHtml(product.sku) + '</span>' : '') +
                    '</div>' +
                    '<h4>' + escapeHtml(product.name || 'Producto') + '</h4>' +
                    '<p>' + escapeHtml(product.excerpt || '') + '</p>' +
                    heroContextMarkup +
                    '<div class="bader-ai-search__hero-bottom">' +
                    '<div class="bader-ai-search__hero-price">' + escapeHtml(formatPrice(product.price_value, product.currency_code, product.currency_symbol)) + '</div>' +
                    '<div class="bader-ai-search__hero-actions">' +
                    '<span class="bader-ai-search__reason">' + escapeHtml(product.reason || 'Resultado recomendado') + '</span>' +
                    '<a href="' + escapeHtml(product.url || '/productos') + '" class="bader-ai-search__cta" data-bader-search-result-link="1" data-bader-search-nav="1">Ver producto</a>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '</article>';
            }

            function renderProductGrid(items) {
                if (!productsEl) return;
                if (!items || !items.length) {
                    productsEl.innerHTML = '';
                    return;
                }
                productsEl.innerHTML = items.map(function (product) {
                    return (
                        '<a href="' + escapeHtml(product.url || '/productos') + '" class="bader-ai-search__product-card" data-bader-search-result-link="1" data-bader-search-nav="1">' +
                        '<div class="bader-ai-search__product-thumb">' +
                        '<img src="' + escapeHtml(product.image_url || '') + '" alt="' + escapeHtml(product.name || 'Producto') + '" loading="lazy"/>' +
                        '</div>' +
                        '<div class="bader-ai-search__product-copy">' +
                        (product.category ? '<span class="bader-ai-search__product-category">' + escapeHtml(product.category) + '</span>' : '') +
                        '<strong>' + escapeHtml(product.name || 'Producto') + '</strong>' +
                        '<p>' + escapeHtml(product.excerpt || '') + '</p>' +
                        '<div class="bader-ai-search__product-bottom">' +
                        '<span class="bader-ai-search__product-price">' + escapeHtml(formatPrice(product.price_value, product.currency_code, product.currency_symbol)) + '</span>' +
                        '<span class="bader-ai-search__product-link">Abrir <i class="fa fa-arrow-right"></i></span>' +
                        '</div>' +
                        '</div>' +
                        '</a>'
                    );
                }).join('');
            }

            function renderRelatedQueries(items, targetEl) {
                if (!targetEl) return;
                if (!items || !items.length) {
                    targetEl.innerHTML = '';
                    return;
                }
                targetEl.innerHTML =
                    '<div class="bader-ai-search__related-head">Consultas relacionadas</div>' +
                    '<div class="bader-ai-search__related-list">' +
                    items.map(function (label) {
                        return (
                            '<button type="button" class="bader-ai-search__related-chip" data-bader-ai-query="' + escapeHtml(label) + '" data-bader-search-nav="1">' +
                            escapeHtml(label) +
                            '</button>'
                        );
                    }).join('') +
                    '</div>';
            }

            function renderQueryContext(payload, targetEl) {
                if (!targetEl) return;
                var contextData = payload || {};
                var currentProduct = contextData.current_product || null;
                var products = contextData.products || [];
                var queries = contextData.queries || [];
                if (!contextData.has_context || (!currentProduct && !products.length && !queries.length)) {
                    targetEl.hidden = true;
                    targetEl.innerHTML = '';
                    return;
                }

                var productsMarkup = products.length ? products.map(function (product) {
                    return (
                        '<a href="' + escapeHtml(product.url || '/productos') + '" class="bader-ai-search__context-product" data-bader-search-nav="1">' +
                        '<span class="bader-ai-search__context-product-media">' +
                        '<img src="' + escapeHtml(product.image_url || '') + '" alt="' + escapeHtml(product.name || 'Producto') + '" loading="lazy"/>' +
                        '</span>' +
                        '<span class="bader-ai-search__context-product-copy">' +
                        (product.category ? '<small>' + escapeHtml(product.category) + '</small>' : '') +
                        '<strong>' + escapeHtml(product.name || 'Producto') + '</strong>' +
                        '<em>' + escapeHtml(product.reason || formatPrice(product.price_value, product.currency_code, product.currency_symbol)) + '</em>' +
                        '</span>' +
                        '</a>'
                    );
                }).join('') : '<p class="bader-ai-search__hint">No hay productos vinculados para esta combinacion todavia.</p>';

                var queriesMarkup = queries.length ? queries.map(function (label) {
                    return (
                        '<button type="button" class="bader-ai-search__context-query" data-bader-ai-query="' + escapeHtml(label) + '" data-bader-search-nav="1">' +
                        escapeHtml(label) +
                        '</button>'
                    );
                }).join('') : '<p class="bader-ai-search__hint">Prueba con una marca compatible o una familia de repuesto.</p>';

                var currentMarkup = currentProduct ? (
                    '<article class="bader-ai-search__query-context-current-card">' +
                    '<span class="bader-ai-search__query-context-current-media">' +
                    '<img src="' + escapeHtml(currentProduct.image_url || '') + '" alt="' + escapeHtml(currentProduct.name || 'Producto') + '" loading="lazy"/>' +
                    '</span>' +
                    '<div class="bader-ai-search__query-context-current-copy">' +
                    '<div class="bader-ai-search__query-context-current-meta">' +
                    '<span>Ficha actual</span>' +
                    (currentProduct.category ? '<span>' + escapeHtml(currentProduct.category) + '</span>' : '') +
                    '</div>' +
                    '<h5>' + escapeHtml(currentProduct.name || 'Producto') + '</h5>' +
                    '<p>' + escapeHtml(currentProduct.excerpt || '') + '</p>' +
                    '<a href="' + escapeHtml(currentProduct.url || currentProductUrlFromPage() || '/productos') + '" data-bader-search-nav="1">Abrir ficha</a>' +
                    '</div>' +
                    '</article>'
                ) : '';

                targetEl.hidden = false;
                targetEl.innerHTML =
                    '<div class="bader-ai-search__query-context-shell">' +
                    '<div class="bader-ai-search__query-context-head">' +
                    '<div>' +
                    '<span class="bader-ai-search__context-eyebrow">Contexto de la ficha</span>' +
                    '<h4>' + escapeHtml(contextData.title || 'Seguir desde esta ficha') + '</h4>' +
                    '</div>' +
                    '<p>' + escapeHtml(contextData.body || 'Accesorios, repuestos y compatibilidades relacionados con el producto actual.') + '</p>' +
                    '</div>' +
                    '<div class="bader-ai-search__query-context-grid">' +
                    currentMarkup +
                    '<div class="bader-ai-search__query-context-side">' +
                    '<article class="bader-ai-search__query-context-block">' +
                    '<div class="bader-ai-search__context-block-head">' +
                    '<h5>Productos vinculados</h5>' +
                    '<span>En esta ficha</span>' +
                    '</div>' +
                    '<div class="bader-ai-search__context-products">' + productsMarkup + '</div>' +
                    '</article>' +
                    '<article class="bader-ai-search__query-context-block">' +
                    '<div class="bader-ai-search__context-block-head">' +
                    '<h5>Consultas listas</h5>' +
                    '<span>Atajos utiles</span>' +
                    '</div>' +
                    '<div class="bader-ai-search__context-queries">' + queriesMarkup + '</div>' +
                    '</article>' +
                    '</div>' +
                    '</div>' +
                    '</div>';
            }

            function resetResults() {
                renderSuggestions([]);
                renderRecentSearches();
                renderCategories([]);
                renderHeroResult(null);
                renderProductGrid([]);
                renderRelatedQueries([], relatedEl);
                renderRelatedQueries([], emptyRelatedEl);
                renderQueryContext(null, queryContextEl);
                renderQueryContext(null, emptyContextEl);
                if (viewAllLink) viewAllLink.setAttribute('href', buildSearchUrl(input ? input.value : ''));
                if (emptyViewAllLink) emptyViewAllLink.setAttribute('href', buildSearchUrl(input ? input.value : ''));
                setState('idle');
                loadSearchContext(false);
                if (activeFilter) {
                    setStatus('Explorando el perfil ' + (filterLabels[activeFilter] || activeFilter) + '. Puedes buscar o aprovechar el contexto comercial disponible.');
                } else {
                    setStatus('Escribe al menos 2 letras para activar la busqueda predictiva o usa el contexto del producto actual.');
                }
            }

            function renderPayload(payload) {
                var products = payload && payload.products ? payload.products : [];
                var categories = payload && payload.categories ? payload.categories : [];
                var relatedQueries = payload && payload.related_queries ? payload.related_queries : [];
                var queryContext = payload && payload.query_context ? payload.query_context : null;

                renderSuggestions(payload && payload.suggestions ? payload.suggestions : []);
                renderRecentSearches();
                if (contextWrapEl) contextWrapEl.hidden = true;
                renderCategories(categories);
                renderHeroResult(products.length ? products[0] : null, queryContext);
                renderProductGrid(products.slice(1));
                renderRelatedQueries(relatedQueries, relatedEl);
                renderRelatedQueries(relatedQueries, emptyRelatedEl);

                if (viewAllLink) {
                    viewAllLink.setAttribute('href', payload && payload.search_url ? payload.search_url : buildSearchUrl(input ? input.value : ''));
                }
                if (emptyViewAllLink) {
                    emptyViewAllLink.setAttribute('href', payload && payload.search_url ? payload.search_url : buildSearchUrl(input ? input.value : ''));
                }

                if (products.length || categories.length) {
                    renderQueryContext(queryContext, queryContextEl);
                    renderQueryContext(null, emptyContextEl);
                    setState('results');
                    if (payload && payload.result_label) {
                        setStatus(payload.result_label);
                    } else if (categories.length) {
                        setStatus('Categorias relacionadas para tu consulta.');
                    }
                    return;
                }

                renderQueryContext(null, queryContextEl);
                renderQueryContext(queryContext, emptyContextEl);
                setState('empty');
                setStatus('No encontramos coincidencias claras. Prueba con SKU, categoria o compatibilidad.');
            }

            function requestResults(rawValue, immediate) {
                var query = String(rawValue || '').trim();
                var currentProductId = currentProductIdFromPage();
                var cacheKey = (activeFilter || 'general') + '|' + (currentProductId || 0) + '|' + query.toLowerCase();
                if (query.length < 2) {
                    abortPendingRequest();
                    resetResults();
                    return;
                }

                if (searchCache[cacheKey]) {
                    renderPayload(searchCache[cacheKey]);
                    return;
                }

                if (!window.fetch) {
                    setStatus('La busqueda predictiva no esta disponible en este navegador.');
                    return;
                }

                if (!immediate) {
                    clearTimeout(debounceTimer);
                    debounceTimer = window.setTimeout(function () {
                        requestResults(query, true);
                    }, 220);
                    return;
                }

                clearTimeout(debounceTimer);
                abortPendingRequest();
                setState('loading');
                setStatus('Buscando en tiempo real...');

                var requestUrl = new URL('/bader/search/predictive', window.location.origin);
                requestUrl.searchParams.set('q', query);
                requestUrl.searchParams.set('limit', '7');
                if (currentProductId) requestUrl.searchParams.set('product_id', String(currentProductId));
                if (activeFilter) requestUrl.searchParams.set('persona', activeFilter);

                var fetchOptions = {
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                };

                if (window.AbortController) {
                    pendingRequest = new window.AbortController();
                    fetchOptions.signal = pendingRequest.signal;
                }

                window.fetch(requestUrl.toString(), fetchOptions)
                    .then(function (response) {
                        if (!response.ok) throw new Error('HTTP ' + response.status);
                        return response.json();
                    })
                    .then(function (payload) {
                        searchCache[cacheKey] = payload || {};
                        renderPayload(payload || {});
                    })
                    .catch(function (err) {
                        if (err && err.name === 'AbortError') return;
                        setState('empty');
                        setStatus('No pudimos completar la busqueda ahora mismo.');
                        renderRelatedQueries([
                            'Autoclave clase B',
                            'Compresor oil free',
                            'Tipodontos',
                            'Repuestos Cattani',
                        ], emptyRelatedEl);
                    })
                    .finally(function () {
                        pendingRequest = null;
                    });
            }

            function submitSearch(rawValue) {
                var query = String(rawValue || (input ? input.value : '') || '').trim();
                if (!query && !activeFilter) {
                    if (input) {
                        input.classList.add('is-invalid');
                        input.focus();
                    }
                    return;
                }
                if (query) saveRecentSearch(query);
                window.location.href = buildSearchUrl(query);
            }

            function prefillFromLocation() {
                if (!input) return;
                var params = new URLSearchParams(window.location.search || '');
                var query = params.get('search') || '';
                var persona = params.get('persona') || params.get('niche') || '';
                if (query && !String(input.value || '').trim()) {
                    input.value = query;
                }
                if (!activeFilter) {
                    var storedFilter =
                        readStorage(SEARCH_PERSONA_STORAGE_KEY) ||
                        readStorage('baderPdpPersona') ||
                        readStorage('bader_home_persona') ||
                        persona;
                    if (filterLabels[storedFilter]) {
                        setFilter(storedFilter, { force: true, skipRefresh: true });
                    }
                }
            }

            function openSearch(e) {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                closeMobileDrawerIfNeeded();
                prefillFromLocation();
                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('bader-ai-search-open');
                renderRecentSearches();
                updateFilterButtons();
                updateCollections();
                if (input) {
                    window.setTimeout(function () {
                        input.focus();
                        input.select();
                    }, 80);
                    if (String(input.value || '').trim().length >= 2) {
                        requestResults(input.value, true);
                    } else {
                        resetResults();
                        loadSearchContext(true);
                    }
                }
            }

            function closeSearch() {
                if (!modal.classList.contains('is-open')) return;
                clearTimeout(debounceTimer);
                abortPendingRequest();
                stopListening();
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('bader-ai-search-open');
            }

            function getVisibleNavItems() {
                var items = Array.prototype.slice.call(
                    modal.querySelectorAll('[data-bader-search-nav], [data-bader-ai-query], [data-bader-ai-filter]')
                );
                return items.filter(function (item) {
                    return !!(item.offsetWidth || item.offsetHeight || item.getClientRects().length);
                });
            }

            if (input) {
                input.addEventListener('input', function () {
                    input.classList.remove('is-invalid');
                    requestResults(input.value, false);
                });
            }

            if (form) {
                form.addEventListener('submit', function (ev) {
                    ev.preventDefault();
                    submitSearch();
                });
            }

            if (desktopPill) desktopPill.addEventListener('click', openSearch);
            if (mobilePill) mobilePill.addEventListener('click', openSearch);

            modal.addEventListener('click', function (ev) {
                if (ev.target === modal) {
                    closeSearch();
                    return;
                }

                var closeTrigger = ev.target.closest('[data-bader-ai-close]');
                if (closeTrigger) {
                    ev.preventDefault();
                    closeSearch();
                    return;
                }

                var filterTrigger = ev.target.closest('[data-bader-ai-filter]');
                if (filterTrigger) {
                    ev.preventDefault();
                    setFilter(filterTrigger.getAttribute('data-bader-ai-filter') || '');
                    return;
                }

                var queryTrigger = ev.target.closest('[data-bader-ai-query]');
                if (queryTrigger) {
                    ev.preventDefault();
                    var query = queryTrigger.getAttribute('data-bader-ai-query') || '';
                    if (input) {
                        input.value = query;
                        input.focus();
                    }
                    saveRecentSearch(query);
                    requestResults(query, true);
                    return;
                }

                var resultLink = ev.target.closest('[data-bader-search-result-link]');
                if (resultLink) {
                    saveRecentSearch(input ? input.value : '');
                }
            });

            var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition && voiceBtn) {
                voiceBtn.disabled = true;
                voiceBtn.title = 'Busqueda por voz no disponible en este navegador';
            }
            if (SpeechRecognition && voiceBtn) {
                recognition = new SpeechRecognition();
                recognition.lang = 'es-ES';
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
                        saveRecentSearch(transcript);
                        requestResults(transcript, true);
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
                        // Ignore duplicate starts.
                    }
                });
            }

            activeFilter = readStorage(SEARCH_PERSONA_STORAGE_KEY) || readStorage('baderPdpPersona') || readStorage('bader_home_persona');
            if (!filterLabels[activeFilter]) activeFilter = '';
            updateFilterButtons();
            updateCollections();
            renderRecentSearches();
            resetResults();

            document.addEventListener('keydown', function (e) {
                var key = (e.key || '').toLowerCase();
                var tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();

                if (key === 'escape' && modal.classList.contains('is-open')) {
                    e.preventDefault();
                    closeSearch();
                    return;
                }

                if (key === 'arrowdown' || key === 'arrowup') {
                    if (!modal.classList.contains('is-open')) return;
                    if (!modal.contains(document.activeElement) && document.activeElement !== input) return;
                    var items = getVisibleNavItems();
                    if (!items.length) return;
                    e.preventDefault();
                    var currentIndex = items.indexOf(document.activeElement);
                    if (currentIndex < 0) currentIndex = key === 'arrowdown' ? -1 : 0;
                    var nextIndex = key === 'arrowdown'
                        ? (currentIndex + 1) % items.length
                        : (currentIndex - 1 + items.length) % items.length;
                    items[nextIndex].focus();
                    return;
                }

                if (key !== 'q' || e.ctrlKey || e.altKey || e.metaKey) return;
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
            }, { threshold: 0.01, rootMargin: '0px 0px -5% 0px' });

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

        // ---- 5b. Servicios cards -> lead form bridge ----
        (function initServiciosLeadFlow() {
            var pageRoot = document.querySelector('[data-bader-services-page="1"]');
            if (!pageRoot) return;

            var modal = document.getElementById('baderServicesModal');
            var form = document.getElementById('baderServiceModalForm');
            var serviceTypeInput = document.getElementById('baderServiceTypeInput');
            var titleEl = document.getElementById('baderServiceModalTitle');
            var descriptionEl = document.getElementById('baderServiceModalDescription');
            var iconEl = document.getElementById('baderServiceModalIcon');
            if (!modal || !form || !serviceTypeInput || !titleEl || !descriptionEl || !iconEl) return;

            var cards = pageRoot.querySelectorAll('.bader-services__card[data-service-type]');
            if (!cards.length) return;
            var fieldGroups = modal.querySelectorAll('[data-service-fields]');

            function getCardInfo(card) {
                var serviceType = (card.getAttribute('data-service-type') || '').trim();
                var serviceTitle = (card.getAttribute('data-service-title') || '').trim() || 'Servicio Bader';
                var serviceDescription = (card.getAttribute('data-service-description') || '').trim() || 'Completa el formulario para solicitar este servicio.';
                var serviceIcon = (card.getAttribute('data-service-icon') || '').trim() || 'fa-wrench';
                return {
                    type: serviceType,
                    title: serviceTitle,
                    description: serviceDescription,
                    icon: serviceIcon,
                };
            }

            function setGroupState(group, enabled) {
                if (enabled) {
                    group.removeAttribute('hidden');
                } else {
                    group.setAttribute('hidden', 'hidden');
                }
                group.querySelectorAll('input, select, textarea').forEach(function (field) {
                    var isRequired = field.getAttribute('data-service-required') === '1';
                    field.disabled = !enabled;
                    field.required = enabled ? isRequired : false;

                    if (!enabled) {
                        if (field.tagName === 'SELECT') {
                            field.selectedIndex = 0;
                        } else if (field.type === 'checkbox' || field.type === 'radio') {
                            field.checked = false;
                        } else {
                            field.value = '';
                        }
                    }
                });
            }

            function openModal(card) {
                var info = getCardInfo(card);
                if (!info.type) return;
                serviceTypeInput.value = info.type;
                titleEl.textContent = info.title;
                descriptionEl.textContent = info.description;
                iconEl.className = 'fa ' + info.icon;

                fieldGroups.forEach(function (group) {
                    setGroupState(group, group.getAttribute('data-service-fields') === info.type);
                });

                modal.classList.add('is-open');
                modal.setAttribute('aria-hidden', 'false');
                document.body.classList.add('bader-services-modal-open');

                window.setTimeout(function () {
                    var firstInput = form.querySelector('input[name="name"]');
                    if (firstInput && typeof firstInput.focus === 'function') firstInput.focus();
                }, 40);
            }

            function closeModal() {
                if (!modal.classList.contains('is-open')) return;
                modal.classList.remove('is-open');
                modal.setAttribute('aria-hidden', 'true');
                document.body.classList.remove('bader-services-modal-open');
                form.reset();
                serviceTypeInput.value = '';
                fieldGroups.forEach(function (group) {
                    setGroupState(group, false);
                });
            }

            fieldGroups.forEach(function (group) {
                setGroupState(group, false);
            });

            modal.querySelectorAll('[data-bader-service-modal-close="1"]').forEach(function (closeEl) {
                closeEl.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    closeModal();
                });
            });

            document.addEventListener('keydown', function (ev) {
                if (ev.key === 'Escape' && modal.classList.contains('is-open')) {
                    closeModal();
                }
            });

            form.addEventListener('submit', function () {
                if (serviceTypeInput.value) return;
                var firstCard = cards[0];
                if (firstCard) {
                    var info = getCardInfo(firstCard);
                    serviceTypeInput.value = info.type || 'otro';
                }
            });

            cards.forEach(function (card) {
                card.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    openModal(card);
                });

                card.addEventListener('keydown', function (ev) {
                    if (ev.key !== 'Enter' && ev.key !== ' ') return;
                    ev.preventDefault();
                    openModal(card);
                });
            });

            pageRoot.querySelectorAll('.js-bader-service-open').forEach(function (button) {
                button.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    var card = button.closest('.bader-services__card[data-service-type]');
                    if (!card) return;
                    openModal(card);
                });
            });
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
                    if (hintEl) hintEl.textContent = 'Crea tu cuenta y completa tu perfil comercial en el siguiente paso.';
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
                    redirect: normalizeRedirect(registerForm.getAttribute('data-redirect') || currentRedirectFromWindow()),
                };
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

                    setSubmitting(true);
                    setMessage('', false);
                    rpc('/bader/auth/signup', payload).then(function (result) {
                        if (!result || !result.ok) {
                            setSubmitting(false);
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

            window.addEventListener('bader:auth-open', function (ev) {
                if (isSubmitting) return;
                var detail = (ev && ev.detail) || {};
                openModal(detail.tab || 'login', detail.redirect || currentRedirectFromWindow());
            });

            if (window.__baderAuthAutoOpen) {
                var queuedOpen = window.__baderAuthAutoOpen;
                window.__baderAuthAutoOpen = null;
                openModal(queuedOpen.tab || 'login', queuedOpen.redirect || currentRedirectFromWindow());
            }

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
            var stepRailEl = null;
            var asideEl = null;
            var primaryBtn = null;
            var backBtn = null;
            var skipTopBtn = null;
            var skipBottomBtn = null;
            var messageEl = null;
            var isSaving = false;
            var isMandatory = false;
            var step = 0;

            var personaOptions = [
                {
                    key: 'clinica',
                    title: 'Clinica Dental',
                    desc: 'Consultorios y clinicas odontologicas',
                    icon: 'fa-medkit',
                    focus: 'Sillones, imagen y flujo clinico',
                },
                {
                    key: 'laboratorio',
                    title: 'Laboratorio Dental',
                    desc: 'Laboratorios de protesis y tecnica dental',
                    icon: 'fa-flask',
                    focus: 'CAD/CAM, protesis y procesos tecnicos',
                },
                {
                    key: 'estudiantes',
                    title: 'Estudiantes',
                    desc: 'Estudiantes de odontologia y carreras afines',
                    icon: 'fa-graduation-cap',
                    focus: 'Kits, practicas y primer equipamiento',
                },
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
                name: '',
                phone: '',
                city: '',
                vat: '',
                company_name: '',
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
                profile.name = serverProfile.name || '';
                profile.phone = serverProfile.phone || '';
                profile.city = serverProfile.city || '';
                profile.vat = serverProfile.vat || '';
                profile.company_name = serverProfile.company_name || '';
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

                // Clerk auto-fill: name and phone from Clerk session
                try {
                    var clerkUser = window.Clerk && window.Clerk.user;
                    if (clerkUser) {
                        if (!profile.name) {
                            var clerkName = ((clerkUser.firstName || '') + ' ' + (clerkUser.lastName || '')).trim();
                            if (clerkName) profile.name = clerkName;
                        }
                        if (!profile.phone && clerkUser.primaryPhoneNumber) {
                            profile.phone = clerkUser.primaryPhoneNumber.phoneNumber || '';
                        }
                    }
                } catch (e) { /* Clerk not available */ }
            }

            function hasText(value) {
                return !!String(value || '').trim();
            }

            function currentTotalSteps() {
                return 3;
            }

            function canProceedStep() {
                // Step 0: persona selection
                if (step === 0) return !!profile.persona;
                // Step 1: contact + professional (combined)
                if (step === 1) {
                    if (!hasText(profile.name) || !hasText(profile.phone) || !hasText(profile.city)) return false;
                    if (profile.persona === 'clinica') {
                        return hasText(profile.clinic_name) && !!profile.clinic_role
                            && Array.isArray(profile.clinic_specialties) && profile.clinic_specialties.length > 0;
                    }
                    if (profile.persona === 'laboratorio') {
                        return hasText(profile.lab_name) && !!profile.lab_type && !!profile.lab_specialization;
                    }
                    if (profile.persona === 'estudiantes') {
                        return hasText(profile.university) && !!profile.career && !!profile.study_year;
                    }
                    return true;
                }
                // Step 2: done
                return true;
            }

            function onboardingMissingFieldsMessage(fields) {
                if (!fields || !fields.length) {
                    return 'No se pudo guardar. Revisa los campos obligatorios e intenta nuevamente.';
                }
                var labels = {
                    name: 'nombre completo',
                    phone: 'telefono o WhatsApp',
                    city: 'ciudad',
                    clinic_role: 'cargo',
                    clinic_specialties: 'especialidades',
                    clinic_name: 'nombre de la clinica',
                    lab_type: 'tipo de laboratorio',
                    lab_specialization: 'especializacion principal',
                    lab_name: 'nombre del laboratorio',
                    career: 'carrera',
                    study_year: 'ano de cursado',
                    university: 'universidad',
                };
                return 'Falta completar: ' + fields.map(function (key) { return labels[key] || key; }).join(', ') + '.';
            }

            function personaTitle(personaKey) {
                for (var i = 0; i < personaOptions.length; i += 1) {
                    if (personaOptions[i].key === personaKey) return personaOptions[i].title;
                }
                return 'Profesional';
            }

            function personaOption(personaKey) {
                for (var i = 0; i < personaOptions.length; i += 1) {
                    if (personaOptions[i].key === personaKey) return personaOptions[i];
                }
                return null;
            }

            function stepTitles() {
                return ['Segmento', 'Datos', 'Listo'];
            }

            function onboardingMeta() {
                var currentPersona = personaOption(profile.persona);
                if (step === 0) {
                    return {
                        eyebrow: isMandatory ? 'Registro obligatorio' : 'Experiencia personalizada',
                        title: 'Elige tu universo Bader',
                        copy: 'Selecciona tu perfil para personalizar catalogo, ofertas y soporte.',
                        bullets: [
                            'Catalogo segmentado segun tu actividad',
                            'Seguimiento comercial preciso en Odoo',
                            'Accesos rapidos y recursos relevantes',
                        ],
                    };
                }
                if (step === 1) {
                    return {
                        eyebrow: currentPersona ? currentPersona.title : 'Datos y perfil',
                        title: 'Completa tu informacion',
                        copy: 'Datos de contacto y perfil profesional en un solo paso.',
                        bullets: currentPersona ? [
                            currentPersona.focus,
                            'Atencion comercial personalizada',
                            'Menos friccion en compras y soporte',
                        ] : [
                            'Nombre, WhatsApp y ciudad siempre a mano',
                            'Empresa e identificacion fiscal centralizadas',
                            'Menos friccion en compras y seguimiento',
                        ],
                    };
                }
                return {
                    eyebrow: 'Cuenta lista',
                    title: 'Tu portal personalizado esta listo',
                    copy: 'Todo configurado para una experiencia adaptada a tu perfil.',
                    bullets: [
                        'Inicio adaptado a tu segmento',
                        'Soporte comercial contextual',
                        'Cuenta preparada para crecer contigo',
                    ],
                };
            }

            function stepRailHtml() {
                var labels = stepTitles();
                var html = '';
                for (var i = 0; i < labels.length; i += 1) {
                    var state = '';
                    if (i < step) state = ' is-complete';
                    if (i === step) state = ' is-active';
                    html += '' +
                        '<span class="bader-onboarding__step-node' + state + '">' +
                        '<span class="bader-onboarding__step-node-index">' + (i + 1) + '</span>' +
                        '<span class="bader-onboarding__step-node-label">' + htmlEscape(labels[i]) + '</span>' +
                        '</span>';
                }
                return html;
            }

            function personaBadgeHtml() {
                var currentPersona = personaOption(profile.persona);
                if (!currentPersona) {
                    return '';
                }
                return '' +
                    '<div class="bader-onboarding__aside-card">' +
                    '<span class="bader-onboarding__aside-card-icon"><i class="fa ' + htmlEscape(currentPersona.icon) + '"></i></span>' +
                    '<div>' +
                    '<strong>' + htmlEscape(currentPersona.title) + '</strong>' +
                    '<span>' + htmlEscape(currentPersona.focus) + '</span>' +
                    '</div>' +
                    '</div>';
            }

            function asideHtml() {
                var meta = onboardingMeta();
                var noteText = isMandatory
                    ? 'Completa este onboarding para terminar tu registro y activar la cuenta.'
                    : 'Puedes salir y retomarlo luego, sin perder lo que ya completes.';
                var bullets = '';
                for (var i = 0; i < meta.bullets.length; i += 1) {
                    bullets += '<li>' + htmlEscape(meta.bullets[i]) + '</li>';
                }
                return '' +
                    '<div class="bader-onboarding__brand">' +
                    '<span class="bader-onboarding__brand-mark"><i class="fa fa-diamond"></i></span>' +
                    '<div>' +
                    '<strong>Bader Argentina</strong>' +
                    '<span>Portal profesional integrado con Odoo</span>' +
                    '</div>' +
                    '</div>' +
                    '<span class="bader-onboarding__eyebrow">' + htmlEscape(meta.eyebrow) + '</span>' +
                    '<h3 class="bader-onboarding__aside-title">' + htmlEscape(meta.title) + '</h3>' +
                    '<p class="bader-onboarding__aside-copy">' + htmlEscape(meta.copy) + '</p>' +
                    personaBadgeHtml() +
                    '<div class="bader-onboarding__aside-stats">' +
                    '<div class="bader-onboarding__aside-stat"><strong>3</strong><span>pasos claros</span></div>' +
                    '<div class="bader-onboarding__aside-stat"><strong>30 seg</strong><span>promedio</span></div>' +
                    '<div class="bader-onboarding__aside-stat"><strong>100%</strong><span>adaptado a tu perfil</span></div>' +
                    '</div>' +
                    '<ul class="bader-onboarding__aside-list">' + bullets + '</ul>' +
                    '<div class="bader-onboarding__aside-note' + (isMandatory ? ' is-mandatory' : '') + '">' +
                    '<i class="fa ' + (isMandatory ? 'fa-lock' : 'fa-clock-o') + '"></i>' +
                    '<span>' + htmlEscape(noteText) + '</span>' +
                    '</div>';
            }

            function personaSummaryHtml() {
                var currentPersona = personaOption(profile.persona);
                if (!currentPersona) return '';
                return '' +
                    '<div class="bader-onboarding__persona-summary">' +
                    '<span class="bader-onboarding__persona-summary-icon"><i class="fa ' + htmlEscape(currentPersona.icon) + '"></i></span>' +
                    '<div>' +
                    '<small>Perfil seleccionado</small>' +
                    '<strong>' + htmlEscape(currentPersona.title) + '</strong>' +
                    '<span>' + htmlEscape(currentPersona.focus) + '</span>' +
                    '</div>' +
                    '</div>';
            }

            function stepOneHtml() {
                return '' +
                    '<div class="bader-onboarding__welcome">' +
                    '<span class="bader-onboarding__icon"><i class="fa fa-star"></i></span>' +
                    '<h3>Bienvenido a una experiencia mas inteligente</h3>' +
                    '<p>Completa tu perfil una sola vez para que el portal trabaje con tu contexto comercial y profesional desde el primer minuto.</p>' +
                    '<div class="bader-onboarding__welcome-grid">' +
                    '<article class="bader-onboarding__welcome-card"><strong>Catalogo preciso</strong><span>Productos y categorias mas relevantes primero.</span></article>' +
                    '<article class="bader-onboarding__welcome-card"><strong>Soporte contextual</strong><span>Tu contacto queda listo para atencion comercial en Odoo.</span></article>' +
                    '<article class="bader-onboarding__welcome-card"><strong>Ruta corta</strong><span>Solo 5 pasos, sin formularios eternos ni ruido.</span></article>' +
                    '</div>' +
                    '</div>';
            }

            function stepTwoHtml() {
                var cards = '';
                for (var i = 0; i < personaOptions.length; i += 1) {
                    var item = personaOptions[i];
                    var isActive = profile.persona === item.key ? ' is-active' : '';
                    cards += '' +
                        '<button type="button" class="bader-onboarding__persona' + isActive + '" data-onboarding-persona="' + item.key + '">' +
                        '<span class="bader-onboarding__persona-top">' +
                        '<span class="bader-onboarding__persona-icon"><i class="fa ' + htmlEscape(item.icon) + '"></i></span>' +
                        '<span class="bader-onboarding__persona-check"><i class="fa fa-check"></i></span>' +
                        '</span>' +
                        '<strong>' + htmlEscape(item.title) + '</strong>' +
                        '<span>' + htmlEscape(item.desc) + '</span>' +
                        '<em>' + htmlEscape(item.focus) + '</em>' +
                        '</button>';
                }
                return '' +
                    '<div class="bader-onboarding__step-head">' +
                    '<h3>Selecciona tu perfil</h3>' +
                    '<p>Este dato define recomendaciones y accesos rapidos en toda la web.</p>' +
                    '</div>' +
                    '<div class="bader-onboarding__persona-grid">' + cards + '</div>';
            }

            function companyFieldLabel() {
                if (profile.persona === 'clinica') return 'Clinica o empresa';
                if (profile.persona === 'laboratorio') return 'Laboratorio o empresa';
                if (profile.persona === 'estudiantes') return 'Institucion (opcional)';
                return 'Empresa o institucion';
            }

            function stepThreeHtml() {
                return '' +
                    '<div class="bader-onboarding__step-head">' +
                    '<h3>Datos de contacto</h3>' +
                    '<p>Estos datos se guardan en tu contacto de Odoo para atencion comercial y seguimiento.</p>' +
                    '</div>' +
                    '<div class="bader-onboarding__surface">' +
                    '<div class="bader-onboarding__surface-head">' +
                    '<strong>Base comercial</strong>' +
                    '<span>Lo esencial para identificarte y ayudarte mejor.</span>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Nombre completo *</label>' +
                    '<input type="text" data-onboarding-input="name" value="' + htmlEscape(profile.name) + '" placeholder="Nombre y apellido"/>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Telefono / WhatsApp *</label>' +
                    '<input type="text" data-onboarding-input="phone" value="' + htmlEscape(profile.phone) + '" placeholder="+54 11 0000 0000"/>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Ciudad *</label>' +
                    '<input type="text" data-onboarding-input="city" value="' + htmlEscape(profile.city) + '" placeholder="Ej: Buenos Aires"/>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>' + htmlEscape(companyFieldLabel()) + '</label>' +
                    '<input type="text" data-onboarding-input="company_name" value="' + htmlEscape(profile.company_name) + '" placeholder="Opcional"/>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Documento fiscal</label>' +
                    '<input type="text" data-onboarding-input="vat" value="' + htmlEscape(profile.vat) + '" placeholder="CUIT / NIF / Documento"/>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__note">' +
                    '<i class="fa fa-lock"></i>' +
                    '<span>Usamos esta informacion para seguimiento comercial, facturacion y una experiencia de cuenta mas precisa.</span>' +
                    '</div>';
            }

            function stepCombinedHtml() {
                var profBody = '';
                if (profile.persona === 'clinica') profBody = clinicQuestionsHtml();
                if (profile.persona === 'laboratorio') profBody = labQuestionsHtml();
                if (profile.persona === 'estudiantes') profBody = studentQuestionsHtml();

                return '' +
                    '<div class="bader-onboarding__step-head">' +
                    '<h3>Completa tu informacion</h3>' +
                    '<p>Datos de contacto y perfil profesional de <strong>' + htmlEscape(personaTitle(profile.persona)) + '</strong> en un solo paso.</p>' +
                    '</div>' +
                    '<div class="bader-onboarding__surface">' +
                    '<div class="bader-onboarding__surface-head">' +
                    '<i class="fa fa-address-card-o"></i>' +
                    '<div><strong>Contacto</strong><span>Lo esencial para identificarte.</span></div>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Nombre completo *</label>' +
                    '<input type="text" data-onboarding-input="name" value="' + htmlEscape(profile.name) + '" placeholder="Nombre y apellido"/>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Telefono / WhatsApp *</label>' +
                    '<input type="text" data-onboarding-input="phone" value="' + htmlEscape(profile.phone) + '" placeholder="+54 11 0000 0000"/>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__grid">' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Ciudad *</label>' +
                    '<input type="text" data-onboarding-input="city" value="' + htmlEscape(profile.city) + '" placeholder="Ej: Buenos Aires"/>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>' + htmlEscape(companyFieldLabel()) + '</label>' +
                    '<input type="text" data-onboarding-input="company_name" value="' + htmlEscape(profile.company_name) + '" placeholder="Opcional"/>' +
                    '</div>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Documento fiscal</label>' +
                    '<input type="text" data-onboarding-input="vat" value="' + htmlEscape(profile.vat) + '" placeholder="CUIT / NIF / Documento"/>' +
                    '</div>' +
                    '</div>' +
                    (profBody ? '' +
                    '<div class="bader-onboarding__surface" style="margin-top:1rem">' +
                    '<div class="bader-onboarding__surface-head">' +
                    '<i class="fa ' + htmlEscape((personaOption(profile.persona) || {}).icon || 'fa-briefcase') + '"></i>' +
                    '<div><strong>Perfil ' + htmlEscape(personaTitle(profile.persona)) + '</strong><span>Para personalizar catalogo y soporte.</span></div>' +
                    '</div>' +
                    profBody +
                    '</div>' : '');
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
                    '<label>Nombre de la clinica *</label>' +
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
                    '<label>Nombre del laboratorio *</label>' +
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
                    '<label>Universidad *</label>' +
                    '<input type="text" data-onboarding-input="university" value="' + htmlEscape(profile.university) + '" placeholder="Ej: Universidad de Buenos Aires"/>' +
                    '</div>' +
                    '<div class="bader-onboarding__field">' +
                    '<label>Ciudad de estudio</label>' +
                    '<input type="text" data-onboarding-input="student_city" value="' + htmlEscape(profile.student_city) + '" placeholder="Ej: Buenos Aires"/>' +
                    '</div>' +
                    '</div>';
            }

            function stepFourHtml() {
                var body = '';
                if (profile.persona === 'clinica') body = clinicQuestionsHtml();
                if (profile.persona === 'laboratorio') body = labQuestionsHtml();
                if (profile.persona === 'estudiantes') body = studentQuestionsHtml();

                return '' +
                    '<div class="bader-onboarding__step-head">' +
                    '<h3>Perfil profesional</h3>' +
                    '<p>Perfil seleccionado: <strong>' + htmlEscape(personaTitle(profile.persona)) + '</strong>. Completa los datos para personalizar catalogo, ofertas y soporte.</p>' +
                    '</div>' +
                    personaSummaryHtml() +
                    '<div class="bader-onboarding__surface">' + body + '</div>';
            }

            function stepFiveHtml() {
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
                if (step === 0) contentEl.innerHTML = stepTwoHtml();
                if (step === 1) contentEl.innerHTML = stepCombinedHtml();
                if (step === 2) contentEl.innerHTML = stepFiveHtml();
                if (asideEl) asideEl.innerHTML = asideHtml();
                if (stepRailEl) stepRailEl.innerHTML = stepRailHtml();
                updateFrame();
            }

            function updateFrame() {
                var total = currentTotalSteps();
                var current = step + 1;
                var pct = Math.round((current / total) * 100);

                if (progressBarEl) progressBarEl.style.width = pct + '%';
                if (stepLabelEl) stepLabelEl.textContent = 'Paso ' + current + ' de ' + total;
                if (backBtn) backBtn.style.display = step > 0 ? '' : 'none';
                if (modalRoot) modalRoot.setAttribute('data-persona', profile.persona || '');
                if (primaryBtn) {
                    var isLast = step >= 2;
                    if (isLast) {
                        primaryBtn.textContent = isSaving ? 'Guardando...' : 'Empezar a explorar';
                    } else if (step === 0 && !profile.persona) {
                        primaryBtn.textContent = 'Selecciona tu perfil';
                    } else {
                        primaryBtn.textContent = 'Continuar';
                    }
                    primaryBtn.disabled = isSaving || !canProceedStep();
                }
                if (skipTopBtn) skipTopBtn.style.display = isMandatory ? 'none' : '';
                if (skipBottomBtn) skipBottomBtn.style.display = isMandatory ? 'none' : '';
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
                if (isMandatory) {
                    if (messageEl) {
                        messageEl.textContent = 'Completa tu perfil para terminar tu registro.';
                    }
                    return;
                }
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
                    name: profile.name,
                    phone: profile.phone,
                    city: profile.city,
                    vat: profile.vat,
                    company_name: profile.company_name,
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
                            messageEl.textContent = onboardingMissingFieldsMessage(result && result.fields);
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
                    var closeBtn = target.closest ? target.closest('[data-onboarding-close="1"]') : null;
                    var skipBtn = target.closest ? target.closest('[data-onboarding-skip="1"]') : null;
                    var backControl = target.closest ? target.closest('[data-onboarding-back="1"]') : null;
                    var nextControl = target.closest ? target.closest('[data-onboarding-next="1"]') : null;

                    if (target === modalRoot || closeBtn) {
                        skipOnboarding();
                        return;
                    }

                    var personaBtn = target.closest('[data-onboarding-persona]');
                    if (personaBtn) {
                        profile.persona = personaBtn.getAttribute('data-onboarding-persona') || '';
                        renderCurrentStep();
                        // Auto-advance to step 2 after a brief visual confirmation
                        if (step === 0 && profile.persona) {
                            setTimeout(function () {
                                step = 1;
                                renderCurrentStep();
                            }, 400);
                        }
                        return;
                    }

                    var specBtn = target.closest('[data-onboarding-specialty]');
                    if (specBtn) {
                        toggleSpecialty(specBtn.getAttribute('data-onboarding-specialty') || '');
                        specBtn.classList.toggle('is-active');
                        updateFrame();
                        return;
                    }

                    if (skipBtn) {
                        skipOnboarding();
                        return;
                    }

                    if (backControl === backBtn) {
                        if (step > 0) {
                            step -= 1;
                            renderCurrentStep();
                        }
                        return;
                    }

                    if (nextControl === primaryBtn) {
                        if (step < 2) {
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
                    if (ev.key === 'Escape' && !isMandatory) skipOnboarding();
                });
            }

            function mountModal() {
                if (modalRoot) return;
                modalRoot = document.createElement('div');
                modalRoot.className = 'bader-onboarding';
                modalRoot.innerHTML = '' +
                    '<div class="bader-onboarding__shell">' +
                    '<aside class="bader-onboarding__aside" data-onboarding-aside="1"></aside>' +
                    '<div class="bader-onboarding__dialog">' +
                    '<div class="bader-onboarding__head">' +
                    '<span class="bader-onboarding__step" data-onboarding-step="1">Paso 1 de 5</span>' +
                    '<button type="button" class="bader-onboarding__skip-top" data-onboarding-close="1" aria-label="Cerrar"><i class="fa fa-times"></i></button>' +
                    '</div>' +
                    '<div class="bader-onboarding__step-rail" data-onboarding-step-rail="1"></div>' +
                    '<div class="bader-onboarding__progress"><span data-onboarding-progress="1"></span></div>' +
                    '<div class="bader-onboarding__body" data-onboarding-content="1"></div>' +
                    '<p class="bader-onboarding__message" data-onboarding-message="1"></p>' +
                    '<div class="bader-onboarding__actions">' +
                    '<button type="button" class="btn btn-outline-secondary" data-onboarding-back="1">Volver</button>' +
                    '<button type="button" class="btn-bader" data-onboarding-next="1">Continuar</button>' +
                    '</div>' +
                    '<button type="button" class="bader-onboarding__skip-bottom" data-onboarding-skip="1">Omitir por ahora</button>' +
                    '</div>' +
                    '</div>';

                document.body.appendChild(modalRoot);
                asideEl = modalRoot.querySelector('[data-onboarding-aside="1"]');
                contentEl = modalRoot.querySelector('[data-onboarding-content="1"]');
                progressBarEl = modalRoot.querySelector('[data-onboarding-progress="1"]');
                stepLabelEl = modalRoot.querySelector('[data-onboarding-step="1"]');
                stepRailEl = modalRoot.querySelector('[data-onboarding-step-rail="1"]');
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
                isMandatory = !!result.require_onboarding;
                if (alreadyShown && !isMandatory) return;
                mergeProfile(result.profile || {});
                mountModal();
            }).catch(function () {
                // Keep web functional even if onboarding endpoint fails.
            });
        })();

        // ===================================================
        // Bottom Navigation — Active State + Scroll Hide
        // ===================================================
        (function initBottomNav() {
            var bottomNav = document.getElementById('baderBottomNav');
            if (!bottomNav) return;

            // --- Active state based on current path ---
            var path = window.location.pathname;
            var items = bottomNav.querySelectorAll('[data-bader-nav]');
            items.forEach(function (item) {
                var nav = item.getAttribute('data-bader-nav');
                var isActive = false;
                if (nav === 'inicio' && (path === '/' || path === '')) isActive = true;
                if (nav === 'productos' && (path.indexOf('/productos') === 0 || path.indexOf('/shop') === 0)) isActive = true;
                if (nav === 'cuenta' && path.indexOf('/my') === 0) isActive = true;
                if (nav === 'carrito' && path.indexOf('/shop/cart') === 0) isActive = true;
                item.classList.toggle('is-active', isActive);
            });

            // --- Scroll hide: hide on scroll down, show on scroll up ---
            var lastScroll = 0;
            var scrollThreshold = 60;
            window.addEventListener('scroll', function () {
                var currentScroll = window.pageYOffset || document.documentElement.scrollTop;
                if (currentScroll < scrollThreshold) {
                    bottomNav.classList.remove('is-hidden');
                    lastScroll = currentScroll;
                    return;
                }
                if (currentScroll > lastScroll + 10) {
                    bottomNav.classList.add('is-hidden');
                } else if (currentScroll < lastScroll - 10) {
                    bottomNav.classList.remove('is-hidden');
                }
                lastScroll = currentScroll;
            }, { passive: true });
        })();

        // ===================================================
        // Bottom Nav — Account Panel Toggle
        // ===================================================
        (function initMobileAccountToggle() {
            var avatarBtn = document.querySelector('[data-bader-mobile-account-toggle]');
            if (!avatarBtn) return;

            var panel = null;

            function createPanel() {
                var card = document.querySelector('.bader-mobile-account__card');
                if (!card) return null;
                var el = document.createElement('div');
                el.className = 'bader-mobile-account-panel';
                el.innerHTML = card.outerHTML;
                document.body.appendChild(el);
                return el;
            }

            function togglePanel() {
                if (!panel) panel = createPanel();
                if (!panel) return;
                var isOpen = panel.classList.contains('is-open');
                panel.classList.toggle('is-open', !isOpen);
            }

            function closePanel() {
                if (panel) panel.classList.remove('is-open');
            }

            avatarBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                e.preventDefault();
                togglePanel();
            });

            document.addEventListener('click', function (e) {
                if (panel && panel.classList.contains('is-open')) {
                    if (!panel.contains(e.target) && !avatarBtn.contains(e.target)) {
                        closePanel();
                    }
                }
            });
        })();

        // ===================================================
        // Cart Mini-Drawer (slide-up on add-to-cart)
        // ===================================================
        (function initCartDrawer() {
            var drawerEl = null;
            var drawerTimeout = null;

            function createDrawer() {
                var el = document.createElement('div');
                el.className = 'bader-cart-drawer';
                el.innerHTML =
                    '<div class="bader-cart-drawer__content">' +
                    '  <div class="bader-cart-drawer__header">' +
                    '    <i class="fa fa-check-circle"></i>' +
                    '    <strong>Producto agregado al carrito</strong>' +
                    '  </div>' +
                    '  <div class="bader-cart-drawer__actions">' +
                    '    <a href="/shop/cart" class="bader-cart-drawer__btn bader-cart-drawer__btn--primary">Ver carrito</a>' +
                    '    <button type="button" class="bader-cart-drawer__btn bader-cart-drawer__btn--secondary" data-cart-drawer-close="1">Seguir comprando</button>' +
                    '  </div>' +
                    '</div>';
                document.body.appendChild(el);

                el.addEventListener('click', function (ev) {
                    var closeBtn = ev.target.closest('[data-cart-drawer-close]');
                    if (closeBtn || ev.target === el) {
                        hideDrawer();
                    }
                });

                return el;
            }

            function showDrawer() {
                if (!drawerEl) drawerEl = createDrawer();
                clearTimeout(drawerTimeout);
                drawerEl.classList.add('is-visible');
                drawerTimeout = setTimeout(hideDrawer, 5000);
                updateBottomNavCartBadge();
            }

            function hideDrawer() {
                if (drawerEl) drawerEl.classList.remove('is-visible');
                clearTimeout(drawerTimeout);
            }

            function updateBottomNavCartBadge() {
                try {
                    var badgeEl = document.querySelector('.bader-bottom-nav__badge');
                    var cartItem = document.querySelector('[data-bader-nav="carrito"]');
                    if (!cartItem) return;
                    var currentQty = badgeEl ? parseInt(badgeEl.textContent, 10) || 0 : 0;
                    var newQty = currentQty + 1;
                    if (badgeEl) {
                        badgeEl.textContent = newQty;
                    } else {
                        var badge = document.createElement('em');
                        badge.className = 'bader-bottom-nav__badge';
                        badge.textContent = newQty;
                        cartItem.appendChild(badge);
                    }
                    // Bounce animation on cart icon
                    var icon = cartItem.querySelector('i');
                    if (icon) {
                        icon.style.transform = 'scale(1.3)';
                        icon.style.color = '#70D44B';
                        setTimeout(function () {
                            icon.style.transform = '';
                            icon.style.color = '';
                        }, 400);
                    }
                } catch (_) {}
            }

            // Listen for Odoo's add-to-cart events
            document.addEventListener('click', function (ev) {
                var addBtn = ev.target.closest('.a-submit, [name="add"], .js_add_cart_json');
                if (!addBtn) return;
                setTimeout(showDrawer, 600);
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


