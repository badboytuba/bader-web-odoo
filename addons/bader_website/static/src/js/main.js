/** ============================================
 *  Bader Website — JavaScript
 *  ============================================
 *  - Mega menu hover toggle
 *  - Scroll fade-in animations (IntersectionObserver)
 *  - Testimonials carousel
 *  - Header scroll effect
 */

document.addEventListener('DOMContentLoaded', function () {

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

    // ---- 10. Product Card Hover Animations ----
    (function initCardAnimations() {
        var cards = document.querySelectorAll('.oe_product_cart');
        if (cards.length === 0) return;

        cards.forEach(function (card) {
            card.addEventListener('mouseenter', function () {
                this.style.transform = 'translateY(-4px)';
                this.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
            });
            card.addEventListener('mouseleave', function () {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
        });
    })();

    // ---- 11. Product Detail — JS-Injected Enhancements ----
    // (Replaces XML xpath approach which was brittle for Odoo 16)
    (function initProductDetailEnhancements() {
        // Only run on product detail pages
        var productPage = document.querySelector('#product_detail, .oe_website_sale .o_wsale_product_page');
        if (!productPage) return;

        // Add Bader class
        productPage.classList.add('bader-product-detail');

        // --- IVA Note ---
        var priceDiv = document.querySelector('.product_price, [itemprop="price"]');
        if (priceDiv && !priceDiv.querySelector('.bader-price-note')) {
            var ivaNote = document.createElement('span');
            ivaNote.className = 'bader-price-note d-block mt-1';
            ivaNote.style.cssText = 'font-size: 14px; color: #64748B;';
            ivaNote.textContent = 'IVA incluido';
            priceDiv.appendChild(ivaNote);
        }

        // --- Benefits Panel ---
        var addToCart = document.querySelector('#add_to_cart, .a-submit');
        if (addToCart) {
            var parent = addToCart.closest('div') || addToCart.parentElement;
            if (parent && !parent.querySelector('.bader-product-benefits')) {
                var benefits = document.createElement('div');
                benefits.className = 'bader-product-benefits mt-4';
                benefits.innerHTML =
                    '<div class="bader-benefit">' +
                    '<i class="fa fa-truck"></i>' +
                    '<span>Envío a todo Argentina</span>' +
                    '</div>' +
                    '<div class="bader-benefit">' +
                    '<i class="fa fa-shield"></i>' +
                    '<span>Garantía oficial Bader</span>' +
                    '</div>' +
                    '<div class="bader-benefit">' +
                    '<i class="fa fa-credit-card"></i>' +
                    '<span>Hasta 12 cuotas sin interés</span>' +
                    '</div>' +
                    '<div class="bader-benefit">' +
                    '<i class="fa fa-refresh"></i>' +
                    '<span>30 días para devoluciones</span>' +
                    '</div>';

                // Insert after the add-to-cart button's container
                parent.parentElement.insertBefore(benefits, parent.nextSibling);
            }
        }

        // --- Cart Benefits ---
        var cartSummary = document.querySelector('.oe_cart .card, .oe_cart_summary .card');
        if (cartSummary && !cartSummary.querySelector('.bader-checkout-benefits')) {
            var cartBenefits = document.createElement('div');
            cartBenefits.className = 'bader-checkout-benefits';
            cartBenefits.innerHTML =
                '<div class="bader-benefit">' +
                '<i class="fa fa-truck"></i>' +
                '<span>Envío gratis a todo Argentina</span>' +
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

});
