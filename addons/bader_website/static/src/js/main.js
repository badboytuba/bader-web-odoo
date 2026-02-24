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

    console.log('[Bader] Module loaded, initializing...');

    // Direct execution — by the time a lazy-loaded module runs, the DOM is ready
    function initBader() {
        console.log('[Bader] initBader() running');

        // Mark body as JS-ready
        document.body.classList.add('bader-js-ready');

        // ---- 1. MEGA MENU — Products hover toggle ----
        (function initMegaMenu() {
            var megaPanel = document.getElementById('baderMegaMenu');
            if (!megaPanel) return;

            function findProductLink() {
                var productLink = null;
                // Strategy 1: check by href containing /shop
                var allLinks = document.querySelectorAll('header#top a.nav-link, header#top #top_menu a');
                allLinks.forEach(function (link) {
                    var href = (link.getAttribute('href') || '').toLowerCase();
                    var text = (link.textContent || '').trim().toLowerCase();
                    if (text === 'productos' || text === 'shop' || text.indexOf('producto') !== -1 ||
                        href.indexOf('/shop') !== -1) {
                        productLink = link;
                    }
                });
                return productLink;
            }

            function setupMegaMenu(productLink) {
                var parentLi = productLink.closest('li');
                var hideTimeout = null;

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

                // Hover on the nav link
                productLink.addEventListener('mouseenter', showMega);
                if (parentLi) {
                    parentLi.addEventListener('mouseenter', showMega);
                    parentLi.addEventListener('mouseleave', hideMega);
                }

                // Hover on the mega panel itself
                megaPanel.addEventListener('mouseenter', function () {
                    clearTimeout(hideTimeout);
                });
                megaPanel.addEventListener('mouseleave', hideMega);

                // Click navigates to shop
                productLink.addEventListener('click', function (e) {
                    if (megaPanel.classList.contains('bader-mega--open')) {
                        window.location.href = '/shop';
                        e.preventDefault();
                    }
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
            var pill = document.getElementById('baderSearchPill');
            if (!pill) return;

            pill.addEventListener('click', function (e) {
                e.preventDefault();
                // Try Odoo's built-in search toggle
                var searchToggle = document.querySelector('.o_searchbar_form input[type="search"], .o_searchbar_form input[type="text"]');
                if (searchToggle) {
                    searchToggle.focus();
                    return;
                }
                // Fallback: navigate to shop search
                window.location.href = '/shop';
            });

            // Keyboard shortcut: press Q to open search
            document.addEventListener('keydown', function (e) {
                if (e.key === 'q' && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    var tag = (e.target.tagName || '').toLowerCase();
                    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
                    e.preventDefault();
                    pill.click();
                }
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
                // Dots
                document.querySelectorAll('.bader-hero__image-dots .dot[data-persona]').forEach(function (dot) {
                    dot.classList.toggle('active', dot.getAttribute('data-persona') === persona);
                });
            }

            tabs.forEach(function (tab) {
                tab.addEventListener('click', function (e) {
                    e.preventDefault();
                    switchPersona(this.getAttribute('data-persona'));
                });
            });

            // Also clicking dots switches persona
            document.querySelectorAll('.bader-hero__image-dots .dot[data-persona]').forEach(function (dot) {
                dot.addEventListener('click', function () {
                    switchPersona(this.getAttribute('data-persona'));
                });
            });

            // Auto-rotate every 6 seconds
            var personas = ['clinica', 'laboratorio', 'estudiantes'];
            var currentIdx = 0;
            setInterval(function () {
                currentIdx = (currentIdx + 1) % personas.length;
                switchPersona(personas[currentIdx]);
            }, 6000);
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

                // Create lightbox
                var lightbox = document.createElement('div');
                lightbox.className = 'bader-lightbox';
                lightbox.innerHTML =
                    '<div class="bader-lightbox__content">' +
                    '<button class="bader-lightbox__close">&times;</button>' +
                    '<img src="' + src + '" alt="Zoom"/>' +
                    '</div>';

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

            addBtn.addEventListener('click', function () {
                var btn = this;
                var originalText = btn.innerHTML;

                btn.classList.add('bader-added');
                btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg> ¡Agregado!';

                setTimeout(function () {
                    btn.classList.remove('bader-added');
                    btn.innerHTML = originalText;
                }, 2000);
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
                    heroHtml += '<a href="/pt/shop">Productos</a>' +
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
                        '<a href="/pt/shop/category/clinica-dental" class="bader-segment-card">' +
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
                        '<a href="/pt/shop/category/laboratorio-dental" class="bader-segment-card">' +
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
                        '<a href="/pt/shop/category/estudiantes" class="bader-segment-card">' +
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
            (function injectFilterChips() {
                var toolbar = document.querySelector('.products_header, #products_grid');
                if (!toolbar || document.querySelector('.bader-active-filters')) return;

                // Parse current URL for active filters
                var params = new URLSearchParams(window.location.search);
                var activeFilters = [];
                params.forEach(function (val, key) {
                    if (key === 'attrib') {
                        activeFilters.push({ key: key, val: val, label: 'Filtro: ' + val });
                    } else if (key === 'order') {
                        var orderLabels = { 'website_sequence asc': 'Destacados', 'create_date desc': 'Nuevos', 'price asc': 'Menor precio', 'price desc': 'Mayor precio', 'name asc': 'A-Z' };
                        activeFilters.push({ key: key, val: val, label: orderLabels[val] || val });
                    } else if (key === 'search') {
                        activeFilters.push({ key: key, val: val, label: '"' + val + '"' });
                    }
                });

                // Build active filter chips if any
                if (activeFilters.length > 0) {
                    var chipsEl = document.createElement('div');
                    chipsEl.className = 'bader-active-filters';
                    var chipHtml = '';
                    activeFilters.forEach(function (f) {
                        var removeUrl = new URL(window.location.href);
                        removeUrl.searchParams.delete(f.key);
                        chipHtml += '<a href="' + removeUrl.pathname + removeUrl.search + '" class="bader-active-chip">' +
                            f.label + ' <span class="bader-chip-x">✕</span></a>';
                    });
                    chipHtml += '<a href="' + window.location.pathname + '" class="bader-clear-all">Limpiar todo</a>';
                    chipsEl.innerHTML = chipHtml;

                    var insertTarget = document.querySelector('.products_header') || document.querySelector('#products_grid');
                    if (insertTarget) {
                        insertTarget.parentElement.insertBefore(chipsEl, insertTarget.nextSibling);
                    }
                }

                // Quick filter chips
                var gridArea = document.querySelector('#products_grid');
                if (!gridArea || document.querySelector('.bader-filter-chips')) return;
                var chips = document.createElement('div');
                chips.className = 'bader-filter-chips';
                chips.innerHTML =
                    '<span class="bader-filter-chips__label">Filtros rápidos:</span>' +
                    '<a href="/pt/shop?order=website_sequence+asc" class="bader-chip"><i class="fa fa-tag"></i> Ofertas</a>' +
                    '<a href="/pt/shop?order=create_date+desc" class="bader-chip"><i class="fa fa-star"></i> Nuevos</a>' +
                    '<a href="/pt/shop?order=price+asc" class="bader-chip"><i class="fa fa-sort-amount-asc"></i> Menor precio</a>' +
                    '<a href="/pt/shop?order=price+desc" class="bader-chip"><i class="fa fa-sort-amount-desc"></i> Mayor precio</a>';
                var headerEl = gridArea.querySelector('.products_header');
                if (headerEl) {
                    headerEl.parentElement.insertBefore(chips, headerEl.nextSibling);
                } else {
                    gridArea.insertBefore(chips, gridArea.querySelector('.o_wsale_products_grid_table_wrapper'));
                }
            })();

            // ── 10d. Premium Product Card Enhancements ──
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
                        cartBtn.setAttribute('aria-label', 'Ver producto');
                        imageSection.appendChild(cartBtn);

                        cartBtn.addEventListener('click', function (e) {
                            e.preventDefault();
                            e.stopPropagation();
                            var link = card.querySelector('a[href*="/shop/"]');
                            if (link) window.location.href = link.href;
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
                    var currentPath = window.location.pathname.toLowerCase();
                    var segmentos = [
                        { name: 'Clínica Dental', icon: 'fa-hospital-o', url: '/pt/shop/category/clinica-dental', count: '7' },
                        { name: 'Laboratorio Dental', icon: 'fa-flask', url: '/pt/shop/category/laboratorio-dental', count: '6' },
                        { name: 'Estudiantes', icon: 'fa-graduation-cap', url: '/pt/shop/category/estudiantes', count: '6' }
                    ];
                    var segHtml = '<div class="bader-filter-section bader-filter-section--segmento">' +
                        '<div class="bader-filter-section__title">Segmento <span class="bader-chevron is-open">▾</span></div>' +
                        '<div class="bader-filter-section__body"><div class="bader-segmento-list">';
                    segmentos.forEach(function (s) {
                        var isActive = currentPath.indexOf(s.url) !== -1;
                        segHtml += '<a href="' + s.url + '" class="bader-segmento-item' + (isActive ? ' bader-segmento-item--active' : '') + '">' +
                            '<i class="fa ' + s.icon + '"></i> ' + s.name +
                            '<span class="bader-segmento-count">' + s.count + '</span></a>';
                    });
                    segHtml += '</div></div></div>';

                    var segEl = document.createElement('div');
                    segEl.innerHTML = segHtml;
                    var segSection = segEl.firstChild;

                    if (existingFilters) {
                        rail.insertBefore(segSection, existingFilters);
                    } else {
                        rail.appendChild(segSection);
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
                        '<span class="bader-currency-symbol">€</span>' +
                        '<input type="number" id="bader_price_min" placeholder="0" min="0">' +
                        '</div>' +
                        '<span class="bader-price-range__separator">—</span>' +
                        '<div class="bader-price-range__input-group">' +
                        '<label>Máximo</label>' +
                        '<span class="bader-currency-symbol">€</span>' +
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
                var cartSummary = document.querySelector('.oe_cart .card, .oe_cart_summary .card');
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

    } // end initBader

    // Execute: by the time a lazy-loaded Odoo module runs, the DOM is always ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBader);
    } else {
        initBader();
    }

}); // end odoo.define
