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

        // Find the "Productos" / "Shop" menu link in the header
        var productLink = null;
        var navLinks = document.querySelectorAll('header#top .navbar-nav .nav-link, header#top #top_menu > li > a');
        navLinks.forEach(function (link) {
            var text = (link.textContent || '').trim().toLowerCase();
            if (text === 'productos' || text === 'shop' || text.indexOf('producto') !== -1) {
                productLink = link;
            }
        });
        if (!productLink) return;

        var parentLi = productLink.closest('li');
        var hideTimeout = null;

        function showMega() {
            clearTimeout(hideTimeout);
            megaPanel.style.display = 'block';
            // Prevent Odoo's default dropdown for this item
            if (parentLi) parentLi.classList.add('bader-mega-active');
        }

        function hideMega() {
            hideTimeout = setTimeout(function () {
                megaPanel.style.display = 'none';
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

        // Prevent Odoo's default dropdown toggle on click
        productLink.addEventListener('click', function (e) {
            if (megaPanel.style.display === 'block') {
                // If mega is open, navigate to shop
                window.location.href = '/shop';
                e.preventDefault();
            }
        });

        // Close mega menu on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && megaPanel.style.display === 'block') {
                megaPanel.style.display = 'none';
            }
        });
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

});
