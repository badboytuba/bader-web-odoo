/* Product page enhancements: loaded only on website_sale.product pages for performance. */
'use strict';

(function initBaderProductPage() {
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
})();
