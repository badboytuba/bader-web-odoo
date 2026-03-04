/* Product page enhancements: loaded only on website_sale.product pages for performance. */
'use strict';

(function bootstrapBaderProductPage() {
    window.__baderPageScripts = window.__baderPageScripts || {};
    if (window.__baderPageScripts.productPage) {
        return;
    }
    window.__baderPageScripts.productPage = true;
    if (document.documentElement) {
        document.documentElement.setAttribute('data-bader-product-js', '1');
    }

    var started = false;

    function startIfReady() {
        if (started) return true;
        var productRoot = document.querySelector('#product_detail');
        if (!productRoot) return false;
        started = true;
        initBaderProductPage(productRoot);
        return true;
    }

    function initBaderProductPage(productRoot) {

    function parseIntSafe(raw, fallback) {
        var parsed = parseInt(String(raw || '').replace(/[^\d-]/g, ''), 10);
        return isNaN(parsed) ? fallback : parsed;
    }

    function parsePriceSafe(raw) {
        var normalized = String(raw || '').trim();
        if (!normalized) return null;
        normalized = normalized.replace(/[^\d.,]/g, '');
        if (!normalized) return null;
        if (normalized.indexOf(',') !== -1) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        }
        var parsed = parseFloat(normalized);
        return isNaN(parsed) ? null : parsed;
    }

    function moneySymbolFromPriceContainer(container) {
        if (!container) return '$ ';
        var textValue = container.textContent || '';
        if (textValue.indexOf('$') !== -1) return '$ ';
        return String.fromCharCode(8364) + ' ';
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
        var productInput = form ? form.querySelector('input[name="product_id"]') : null;
        var qtyInput = form ? form.querySelector('input[name="add_qty"], .css_quantity input') : null;
        var productId = parseIntSafe(productInput ? productInput.value : '', 0);
        var addQty = parseIntSafe(qtyInput ? qtyInput.value : '1', 1);
        if (!productId) return Promise.reject(new Error('missing_product_id'));
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
            if (!response.ok) throw new Error('invalid_add_to_cart_response');
            return response.json();
        }).then(function (payload) {
            var data = payload && payload.result ? payload.result : payload || {};
            if (typeof data.cart_quantity !== 'undefined') {
                renderHeaderCartQty(data.cart_quantity);
            }
            document.dispatchEvent(new Event('bader:cart-open'));
            return data;
        });
    }

    // ---- 1. Gallery lightbox ----
    function initGalleryLightbox() {
        var mainImage = productRoot.querySelector('.o_carousel_product_outer img, .carousel-inner img, img[itemprop="image"]');
        if (!mainImage || mainImage.getAttribute('data-bader-lightbox') === '1') return;
        mainImage.setAttribute('data-bader-lightbox', '1');
        mainImage.style.cursor = 'zoom-in';

        mainImage.addEventListener('click', function () {
            var src = mainImage.getAttribute('src') || mainImage.getAttribute('data-src');
            if (!src) return;

            var lightbox = document.createElement('div');
            lightbox.className = 'bader-lightbox';

            var content = document.createElement('div');
            content.className = 'bader-lightbox__content';

            var closeBtn = document.createElement('button');
            closeBtn.className = 'bader-lightbox__close';
            closeBtn.type = 'button';
            closeBtn.setAttribute('aria-label', 'Cerrar');
            closeBtn.textContent = 'x';

            var img = document.createElement('img');
            img.src = src;
            img.alt = mainImage.getAttribute('alt') || 'Zoom del producto';

            content.appendChild(closeBtn);
            content.appendChild(img);
            lightbox.appendChild(content);
            document.body.appendChild(lightbox);
            document.body.style.overflow = 'hidden';

            function closeLightbox() {
                if (document.body.contains(lightbox)) {
                    document.body.removeChild(lightbox);
                }
                document.body.style.overflow = '';
                document.removeEventListener('keydown', onEsc);
            }

            function onEsc(ev) {
                if (ev.key === 'Escape') closeLightbox();
            }

            lightbox.addEventListener('click', function (ev) {
                if (ev.target === lightbox || ev.target === closeBtn) {
                    closeLightbox();
                }
            });
            document.addEventListener('keydown', onEsc);
        });
    }

    // ---- 2. Qty style ----
    function initQtySelectorStyle() {
        var qtyInput = productRoot.querySelector('input[name="add_qty"], .css_quantity input');
        if (!qtyInput) return;

        var parent = qtyInput.closest('.input-group, .css_quantity');
        if (!parent) return;

        parent.querySelectorAll('a, button').forEach(function (btn) {
            btn.classList.add('bader-qty-btn');
        });
    }

    // ---- 3. Add-to-cart feedback (delegated; survives DOM re-render) ----
    (function initAddToCartFeedbackDelegated() {
        if (document.body.getAttribute('data-bader-product-add-delegated') === '1') return;
        document.body.setAttribute('data-bader-product-add-delegated', '1');

        document.addEventListener('click', function (ev) {
            var button = ev.target && ev.target.closest ? ev.target.closest('#product_detail #add_to_cart, #product_detail .a-submit') : null;
            if (!button) return;

            var form = button.closest('form');
            var shouldForceManual = !!(
                form &&
                button.matches &&
                button.matches('a.a-submit[href="#"], a.a-submit[href=""]')
            );

            if (shouldForceManual) {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof ev.stopImmediatePropagation === 'function') {
                    ev.stopImmediatePropagation();
                }
            }

            if (button.getAttribute('data-bader-feedback-running') !== '1') {
                var originalHtml = button.innerHTML;
                button.setAttribute('data-bader-feedback-running', '1');
                button.classList.add('bader-added');
                button.innerHTML = '<i class="fa fa-check-circle"></i> Agregado';
                window.setTimeout(function () {
                    button.classList.remove('bader-added');
                    button.innerHTML = originalHtml;
                    button.removeAttribute('data-bader-feedback-running');
                }, 1800);
            }

            if (shouldForceManual && !button.getAttribute('data-bader-force-submit')) {
                button.setAttribute('data-bader-force-submit', '1');
                addToCartJson(form)
                    .catch(function () {
                        if (form && form.submit) form.submit();
                    })
                    .finally(function () {
                        button.removeAttribute('data-bader-force-submit');
                    });
            }
        }, true);
    })();

    // ---- 4. Header cart badge sync ----
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
            if (document.querySelector('.bader-cart-popover--empty')) return 0;
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
            if (document.querySelector('.js_cart_lines.bader-empty-cart')) return 0;
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
            if (totalQty === null || lastRenderedQty === totalQty) return;
            var badgeText = totalQty > maxBadgeQty ? String(maxBadgeQty) + '+' : String(totalQty);
            document.querySelectorAll(badgeSelector).forEach(function (badge) {
                if (badge.textContent !== badgeText) {
                    badge.textContent = badgeText;
                }
                badge.classList.remove('d-none');
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
        window.setTimeout(scheduleSync, 300);
        window.setTimeout(scheduleSync, 1200);

        if ('MutationObserver' in window) {
            var observer = new MutationObserver(scheduleSync);
            [
                document.querySelector('.bader-cart-popover'),
                document.querySelector('.js_cart_lines'),
            ].forEach(function (root) {
                if (root) observer.observe(root, { childList: true, subtree: true, characterData: true });
            });
        }

        document.addEventListener('change', function (ev) {
            if (ev.target && ev.target.matches('.js_cart_lines .js_quantity')) {
                scheduleSync();
            }
        });
    })();

    // ---- 5. Product premium blocks ----
    function injectFloatingStockBadge() {
        if (productRoot.querySelector('.bader-stock-floating')) return;

        var gallery = productRoot.querySelector('.o_carousel_product_outer, .carousel, img[itemprop="image"]');
        if (!gallery) return;

        var galleryParent = gallery.closest('.o_wsale_product_images, .col-lg-6, .col-md-6') || gallery.parentElement;
        if (!galleryParent) return;

        if (window.getComputedStyle(galleryParent).position === 'static') {
            galleryParent.style.position = 'relative';
        }

        var status = productRoot.querySelector('.bader-stock-status span:last-child');
        var label = status ? (status.textContent || '').trim() : 'En stock';

        var badge = document.createElement('div');
        badge.className = 'bader-stock-floating';

        var icon = document.createElement('i');
        icon.className = 'fa fa-check-circle';
        var text = document.createElement('span');
        text.textContent = label || 'En stock';

        badge.appendChild(icon);
        badge.appendChild(text);
        galleryParent.appendChild(badge);
    }

    function injectDetailMeta() {
        var detailsCol = productRoot.querySelector('#product_details');
        if (!detailsCol || detailsCol.querySelector('.bader-detail-meta')) return;

        var productName = detailsCol.querySelector('h1[itemprop="name"], h1:not(.d-none)');
        if (!productName) return;

        var categoryText = '';
        var categoryTag = detailsCol.querySelector('.bader-product-category');
        if (categoryTag) categoryText = (categoryTag.textContent || '').trim();

        if (!categoryText) {
            var breadcrumbs = document.querySelectorAll('.breadcrumb-item, .breadcrumb li');
            for (var i = 1; i < breadcrumbs.length - 1; i++) {
                if (categoryText) categoryText += ' / ';
                categoryText += (breadcrumbs[i].textContent || '').trim();
            }
        }

        if (!categoryText) categoryText = 'Productos';

        var meta = document.createElement('div');
        meta.className = 'bader-detail-meta';

        var cat = document.createElement('span');
        cat.className = 'bader-detail-meta__category';
        cat.textContent = categoryText;

        var rating = document.createElement('div');
        rating.className = 'bader-detail-meta__rating';
        var stars = document.createElement('span');
        stars.className = 'bader-stars';
        stars.innerHTML = '<i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i>';
        var count = document.createElement('span');
        count.className = 'bader-rating-count';
        count.textContent = '(4.9)';

        rating.appendChild(stars);
        rating.appendChild(count);
        meta.appendChild(cat);
        meta.appendChild(rating);
        productName.parentElement.insertBefore(meta, productName);
    }

    function injectInstallmentNote() {
        var detailsCol = productRoot.querySelector('#product_details');
        if (!detailsCol) return;

        var priceContainer = detailsCol.querySelector('.product_price, [itemprop="offers"]');
        var priceValueEl = detailsCol.querySelector('.oe_price .oe_currency_value, [itemprop="price"], .oe_currency_value');
        if (!priceContainer || !priceValueEl) return;

        var note = detailsCol.querySelector('.bader-price-note');
        if (!note || note.querySelector('[data-bader-installments="1"]')) return;

        var price = parsePriceSafe(priceValueEl.textContent || '');
        if (!price || price <= 0) return;

        var symbol = moneySymbolFromPriceContainer(priceContainer);
        var installment = price / 12;
        var formatted = installment.toLocaleString('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        var installmentTag = document.createElement('span');
        installmentTag.className = 'bader-price-installment-note';
        installmentTag.setAttribute('data-bader-installments', '1');
        installmentTag.textContent = '12x ' + symbol + formatted + ' sin interes';
        note.appendChild(installmentTag);
    }

    function injectActionButtons() {
        var detailsCol = productRoot.querySelector('#product_details');
        if (!detailsCol || detailsCol.querySelector('.bader-product-actions')) return;

        var addToCart = detailsCol.querySelector('#add_to_cart, .a-submit');
        if (!addToCart) return;

        var ctaWrapper = addToCart.closest('#o_wsale_cta_wrapper') || addToCart.parentElement;
        if (!ctaWrapper || !ctaWrapper.parentElement) return;

        var actions = document.createElement('div');
        actions.className = 'bader-product-actions';

        var buyNow = document.createElement('button');
        buyNow.type = 'button';
        buyNow.className = 'bader-add-to-cart bader-buy-now-btn';
        buyNow.innerHTML = '<i class="fa fa-bolt"></i> Comprar ahora';

        var wishlist = document.createElement('button');
        wishlist.type = 'button';
        wishlist.className = 'bader-btn-wishlist';
        wishlist.setAttribute('title', 'Favoritos');
        wishlist.setAttribute('aria-label', 'Favoritos');
        wishlist.innerHTML = '<i class="fa fa-heart-o"></i>';

        var share = document.createElement('button');
        share.type = 'button';
        share.className = 'bader-btn-share';
        share.setAttribute('title', 'Compartir');
        share.setAttribute('aria-label', 'Compartir');
        share.innerHTML = '<i class="fa fa-share-alt"></i>';

        buyNow.addEventListener('click', function () {
            addToCart.click();
            window.setTimeout(function () {
                window.location.href = '/shop/cart';
            }, 450);
        });

        wishlist.addEventListener('click', function () {
            var wishlistTrigger = detailsCol.querySelector('.o_add_wishlist, [data-action="o_wishlist_submit"]');
            if (wishlistTrigger && typeof wishlistTrigger.click === 'function') {
                wishlistTrigger.click();
            }
        });

        share.addEventListener('click', function () {
            var shareData = {
                title: document.title,
                url: window.location.href,
            };
            if (navigator.share) {
                navigator.share(shareData).catch(function () {
                    // Ignore share cancel.
                });
                return;
            }
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(window.location.href).catch(function () {
                    // Ignore clipboard errors.
                });
            }
        });

        actions.appendChild(buyNow);
        actions.appendChild(wishlist);
        actions.appendChild(share);
        ctaWrapper.parentElement.insertBefore(actions, ctaWrapper.nextSibling);
    }

    function enhanceBenefitsPanel() {
        var detailsCol = productRoot.querySelector('#product_details');
        if (!detailsCol) return;
        var benefits = detailsCol.querySelector('.bader-product-benefits');
        if (!benefits) return;
        benefits.classList.add('bader-product-benefits--enhanced');
    }

    function applyEnhancements() {
        initGalleryLightbox();
        initQtySelectorStyle();
        injectFloatingStockBadge();
        injectDetailMeta();
        injectInstallmentNote();
        injectActionButtons();
        enhanceBenefitsPanel();
    }

    var applyScheduled = false;
    function scheduleEnhancements() {
        if (applyScheduled) return;
        applyScheduled = true;
        window.requestAnimationFrame(function () {
            applyScheduled = false;
            applyEnhancements();
        });
    }

    // Initial and delayed passes for async website_sale updates.
    scheduleEnhancements();
    window.setTimeout(scheduleEnhancements, 300);
    window.setTimeout(scheduleEnhancements, 1000);
    window.setTimeout(scheduleEnhancements, 2000);

    if ('MutationObserver' in window) {
        var observer = new MutationObserver(function () {
            scheduleEnhancements();
        });
        observer.observe(productRoot, { childList: true, subtree: true });

        // Keep observer focused to initial composition period.
        window.setTimeout(function () {
            if (observer && observer.disconnect) {
                observer.disconnect();
            }
        }, 25000);
    }
    }

    if (startIfReady()) return;

    document.addEventListener('DOMContentLoaded', startIfReady, { once: true });
    window.addEventListener('load', startIfReady, { once: true });

    if ('MutationObserver' in window && document.documentElement) {
        var bootObserver = new MutationObserver(function () {
            if (startIfReady() && bootObserver && bootObserver.disconnect) {
                bootObserver.disconnect();
            }
        });
        bootObserver.observe(document.documentElement, { childList: true, subtree: true });
        window.setTimeout(function () {
            if (bootObserver && bootObserver.disconnect) {
                bootObserver.disconnect();
            }
        }, 12000);
    }
})();

