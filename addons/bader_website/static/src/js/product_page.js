/* Product page enhancements aligned with the Bader-AR reference page. */
'use strict';

(function bootstrapBaderProductPage() {
    window.__baderPageScripts = window.__baderPageScripts || {};
    if (window.__baderPageScripts.productPage) {
        return;
    }
    window.__baderPageScripts.productPage = true;

    var started = false;

    function startIfReady() {
        if (started) return true;
        var productRoot = document.querySelector('#product_detail.bader-product-detail');
        if (!productRoot) return false;
        started = true;
        initBaderProductPage(productRoot);
        return true;
    }

    function initBaderProductPage(productRoot) {
        var PDP_PERSONA_STORAGE_KEY = 'baderPdpPersona';
        var RECENT_VIEWED_PRODUCTS_STORAGE_KEY = 'baderRecentViewedProductIdsV1';

        function parseIntSafe(rawValue, fallback) {
            var parsed = parseInt(String(rawValue || '').replace(/[^\d-]/g, ''), 10);
            return isNaN(parsed) ? fallback : parsed;
        }

        function parsePriceSafe(rawValue) {
            var normalized = String(rawValue || '').trim();
            if (!normalized) return null;
            normalized = normalized.replace(/[^\d.,]/g, '');
            if (!normalized) return null;

            var lastComma = normalized.lastIndexOf(',');
            var lastDot = normalized.lastIndexOf('.');

            if (lastComma !== -1 && lastDot !== -1) {
                if (lastComma > lastDot) {
                    normalized = normalized.replace(/\./g, '').replace(',', '.');
                } else {
                    normalized = normalized.replace(/,/g, '');
                }
            } else if (lastComma !== -1) {
                var commaDecimals = normalized.length - lastComma - 1;
                normalized = commaDecimals <= 2
                    ? normalized.replace(/\./g, '').replace(',', '.')
                    : normalized.replace(/,/g, '');
            } else if (lastDot !== -1) {
                var dotDecimals = normalized.length - lastDot - 1;
                normalized = dotDecimals <= 2 ? normalized : normalized.replace(/\./g, '');
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
                // Ignore storage failures.
            }
        }

        function addToCartJson(form) {
            var productInput = form ? form.querySelector('input[name="product_id"], .product_id') : null;
            var qtyInput = form ? form.querySelector('input[name="add_qty"], .css_quantity input') : null;
            var productId = parseIntSafe(productInput ? productInput.value : '', 0);
            var addQty = parseIntSafe(qtyInput ? qtyInput.value : '1', 1);

            if (!productId) {
                return Promise.reject(new Error('missing_product_id'));
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
                if (!response.ok) throw new Error('invalid_add_to_cart_response');
                return response.json();
            }).then(function (payload) {
                var data = payload && payload.result ? payload.result : payload || {};
                if (typeof data.cart_quantity !== 'undefined') {
                    renderHeaderCartQty(data.cart_quantity);
                }
                return data;
            });
        }

        function openLightbox(src, altText) {
            if (!src) return;
            if (document.querySelector('.bader-lightbox')) return;

            var lightbox = document.createElement('div');
            lightbox.className = 'bader-lightbox';

            var content = document.createElement('div');
            content.className = 'bader-lightbox__content';

            var closeButton = document.createElement('button');
            closeButton.className = 'bader-lightbox__close';
            closeButton.type = 'button';
            closeButton.setAttribute('aria-label', 'Cerrar');
            closeButton.textContent = 'x';

            var image = document.createElement('img');
            image.src = src;
            image.alt = altText || 'Zoom del producto';

            content.appendChild(closeButton);
            content.appendChild(image);
            lightbox.appendChild(content);
            document.body.appendChild(lightbox);
            document.body.style.overflow = 'hidden';

            function closeLightbox() {
                if (lightbox.parentNode) {
                    lightbox.parentNode.removeChild(lightbox);
                }
                document.body.style.overflow = '';
                document.removeEventListener('keydown', onEscape);
            }

            function onEscape(event) {
                if (event.key === 'Escape') {
                    closeLightbox();
                }
            }

            lightbox.addEventListener('click', function (event) {
                if (event.target === lightbox || event.target === closeButton) {
                    closeLightbox();
                }
            });
            document.addEventListener('keydown', onEscape);
        }

        function initGalleryLightbox() {
            var gallery = productRoot.querySelector('#o-carousel-product .carousel-inner');
            if (!gallery || gallery.getAttribute('data-bader-lightbox-ready') === '1') {
                return;
            }
            gallery.setAttribute('data-bader-lightbox-ready', '1');
            gallery.addEventListener('click', function (event) {
                var image = event.target && event.target.closest ? event.target.closest('img') : null;
                if (!image) {
                    image = gallery.querySelector('.carousel-item.active img, img[itemprop="image"]');
                }
                if (!image) return;
                openLightbox(
                    image.getAttribute('src') || image.getAttribute('data-src'),
                    image.getAttribute('alt') || 'Zoom del producto'
                );
            });
        }

        function initQtyControls() {
            var qtyControl = productRoot.querySelector('#o_wsale_cta_wrapper .css_quantity');
            if (!qtyControl) return;
            qtyControl.querySelectorAll('a, button').forEach(function (button) {
                button.classList.add('bader-app-qty-button');
            });
            var input = qtyControl.querySelector('input');
            if (input) {
                input.setAttribute('inputmode', 'numeric');
            }
        }

        function initInstallmentNote() {
            var note = productRoot.querySelector('[data-bader-installment-note]');
            var priceContainer = productRoot.querySelector('#product_details .product_price, #product_details [itemprop="offers"]');
            var priceValue = productRoot.querySelector('#product_details .oe_price .oe_currency_value, #product_details [itemprop="price"], #product_details .oe_currency_value');
            if (!note || !priceContainer || !priceValue) return;

            var price = parsePriceSafe(priceValue.textContent || '');
            if (!price || price <= 0) return;

            var symbol = moneySymbolFromPriceContainer(priceContainer);
            var installment = (price / 12).toLocaleString('es-AR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            });
            note.textContent = 'o 12x ' + symbol + installment + ' sin interes';
        }

        function initDescriptionToggle() {
            var wrap = productRoot.querySelector('[data-bader-description-wrap="1"]');
            var button = productRoot.querySelector('[data-bader-description-toggle="1"]');
            if (!wrap || !button || button.getAttribute('data-bader-ready') === '1') {
                return;
            }

            var collapsedLabel = 'Ver descripcion completa';
            var expandedLabel = 'Ver descripcion resumida';

            function syncExpandedState(isExpanded) {
                wrap.classList.toggle('is-expanded', !!isExpanded);
                button.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                button.textContent = isExpanded ? expandedLabel : collapsedLabel;
            }

            var shouldClamp = wrap.scrollHeight > 760;
            if (!shouldClamp) {
                wrap.classList.add('is-short');
                button.hidden = true;
                button.setAttribute('data-bader-ready', '1');
                return;
            }

            syncExpandedState(false);
            button.addEventListener('click', function () {
                var isExpanded = button.getAttribute('aria-expanded') === 'true';
                syncExpandedState(!isExpanded);
            });
            button.setAttribute('data-bader-ready', '1');
        }

        function readStoredPersona() {
            try {
                return window.localStorage ? window.localStorage.getItem(PDP_PERSONA_STORAGE_KEY) || '' : '';
            } catch (err) {
                return '';
            }
        }

        function writeStoredPersona(persona) {
            if (!persona) return;
            try {
                if (window.localStorage) {
                    window.localStorage.setItem(PDP_PERSONA_STORAGE_KEY, persona);
                }
            } catch (err) {
                // Ignore storage failures.
            }
        }

        function readRecentViewedProductIds() {
            try {
                if (!window.localStorage) return [];
                var rawValue = window.localStorage.getItem(RECENT_VIEWED_PRODUCTS_STORAGE_KEY) || '';
                if (!rawValue) return [];
                var parsed = JSON.parse(rawValue);
                if (!Array.isArray(parsed)) return [];
                return parsed
                    .map(function (item) {
                        return parseIntSafe(item, 0);
                    })
                    .filter(function (item) {
                        return item > 0;
                    });
            } catch (err) {
                return [];
            }
        }

        function writeRecentViewedProductIds(items) {
            try {
                if (!window.localStorage) return;
                window.localStorage.setItem(
                    RECENT_VIEWED_PRODUCTS_STORAGE_KEY,
                    JSON.stringify((items || []).slice(0, 8))
                );
            } catch (err) {
                // Ignore storage failures.
            }
        }

        function storeCurrentProductContext() {
            var productId = parseIntSafe(productRoot.getAttribute('data-bader-product-id'), 0);
            if (!productId) return;

            var next = readRecentViewedProductIds().filter(function (item) {
                return item !== productId;
            });
            next.unshift(productId);
            writeRecentViewedProductIds(next);
        }

        function initPersonaSwitcher() {
            var switcher = productRoot.querySelector('.bader-app-persona-switch__list');
            if (!switcher || switcher.getAttribute('data-bader-ready') === '1') {
                return false;
            }

            var chips = switcher.querySelectorAll('.bader-app-persona-switch__chip[data-persona-key]');
            if (!chips.length) {
                switcher.setAttribute('data-bader-ready', '1');
                return false;
            }

            var activePersona = switcher.getAttribute('data-active-persona') || '';
            var storedPersona = readStoredPersona();
            var isPersonaPath = /\/shop\/persona\/[^/]+\//.test(window.location.pathname || '');

            if (isPersonaPath && activePersona) {
                writeStoredPersona(activePersona);
            } else if (storedPersona && storedPersona !== activePersona) {
                var targetChip = switcher.querySelector(
                    '.bader-app-persona-switch__chip[data-persona-key="' + storedPersona + '"]'
                );
                var targetHref = targetChip ? targetChip.getAttribute('href') : '';
                if (targetHref) {
                    window.location.replace(targetHref);
                    return true;
                }
            }

            chips.forEach(function (chip) {
                chip.addEventListener('click', function () {
                    writeStoredPersona(chip.getAttribute('data-persona-key') || '');
                });
            });

            switcher.setAttribute('data-bader-ready', '1');
            return false;
        }

        function initMobileDock() {
            var dock = productRoot.querySelector('[data-bader-mobile-dock="1"]');
            if (!dock || dock.getAttribute('data-bader-ready') === '1') {
                return;
            }

            var form = productRoot.querySelector('#product_details form');
            var mainAddButton = productRoot.querySelector('#add_to_cart, .a-submit');
            var actionAnchor = productRoot.querySelector('#o_wsale_cta_wrapper');
            var priceOutput = dock.querySelector('[data-bader-mobile-dock-price]');
            var addButton = dock.querySelector('[data-bader-mobile-add]');
            var priceContainer = productRoot.querySelector('#product_details .product_price, #product_details [itemprop="offers"]');
            var mainPriceValue = productRoot.querySelector('#product_details .oe_price .oe_currency_value, #product_details [itemprop="price"], #product_details .oe_currency_value');
            var actionAnchorVisible = false;
            var scrollTicking = false;
            var dockRevealOffset = 240;

            function setDockVisible(isVisible) {
                dock.classList.toggle('is-visible', !!isVisible);
                dock.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
            }

            function refreshDockVisibility() {
                var isMobileViewport = window.matchMedia ? window.matchMedia('(max-width: 767px)').matches : window.innerWidth <= 767;
                var isPastIntro = (window.scrollY || window.pageYOffset || 0) > dockRevealOffset;
                setDockVisible(isMobileViewport && isPastIntro && !actionAnchorVisible);
            }

            function queueDockRefresh() {
                if (scrollTicking) return;
                scrollTicking = true;
                window.requestAnimationFrame(function () {
                    scrollTicking = false;
                    refreshDockVisibility();
                });
            }

            function syncDockPrice() {
                if (!priceOutput || !priceContainer || !mainPriceValue) return;
                var price = parsePriceSafe(mainPriceValue.textContent || '');
                if (!price || price <= 0) return;
                priceOutput.textContent = moneySymbolFromPriceContainer(priceContainer) + price.toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                });
            }

            if (addButton) {
                addButton.addEventListener('click', function () {
                    if (!form) return;
                    addButton.disabled = true;
                    addButton.classList.add('is-loading');
                    addToCartJson(form)
                        .then(function () {
                            addButton.textContent = 'Agregado';
                            window.setTimeout(function () {
                                addButton.textContent = 'Agregar';
                            }, 1600);
                        })
                        .catch(function () {
                            if (mainAddButton && typeof mainAddButton.click === 'function') {
                                mainAddButton.click();
                            }
                        })
                        .finally(function () {
                            addButton.disabled = false;
                            addButton.classList.remove('is-loading');
                        });
                });
            }

            syncDockPrice();
            dock.setAttribute('data-bader-ready', '1');
            refreshDockVisibility();

            if ('MutationObserver' in window && mainPriceValue) {
                var priceObserver = new MutationObserver(syncDockPrice);
                priceObserver.observe(mainPriceValue, { childList: true, characterData: true, subtree: true });
                window.setTimeout(function () {
                    if (priceObserver && priceObserver.disconnect) {
                        priceObserver.disconnect();
                    }
                }, 25000);
            }

            if ('IntersectionObserver' in window && actionAnchor) {
                var visibilityObserver = new IntersectionObserver(function (entries) {
                    var entry = entries && entries[0];
                    if (!entry) return;
                    actionAnchorVisible = !!entry.isIntersecting;
                    refreshDockVisibility();
                }, {
                    threshold: 0.2,
                    rootMargin: '0px 0px -84px 0px',
                });
                visibilityObserver.observe(actionAnchor);
            }

            window.addEventListener('scroll', queueDockRefresh, { passive: true });
            window.addEventListener('resize', queueDockRefresh);
        }

        function initSecondaryActions() {
            var actions = productRoot.querySelector('.bader-app-secondary-actions');
            if (!actions || actions.getAttribute('data-bader-ready') === '1') {
                return;
            }

            var form = productRoot.querySelector('#product_details form');
            var addToCartButton = productRoot.querySelector('#add_to_cart, .a-submit');
            var buyNowButton = actions.querySelector('[data-bader-buy-now]');
            var wishlistButton = actions.querySelector('[data-bader-wishlist]');
            var shareButton = actions.querySelector('[data-bader-share]');

            if (buyNowButton) {
                buyNowButton.addEventListener('click', function () {
                    if (!form) return;
                    buyNowButton.disabled = true;
                    buyNowButton.classList.add('is-loading');
                    addToCartJson(form)
                        .then(function () {
                            window.location.href = '/shop/cart';
                        })
                        .catch(function () {
                            if (addToCartButton && typeof addToCartButton.click === 'function') {
                                addToCartButton.click();
                            }
                            window.setTimeout(function () {
                                window.location.href = '/shop/cart';
                            }, 650);
                        })
                        .finally(function () {
                            buyNowButton.disabled = false;
                            buyNowButton.classList.remove('is-loading');
                        });
                });
            }

            if (wishlistButton) {
                wishlistButton.addEventListener('click', function () {
                    var wishlistTrigger = productRoot.querySelector('#product_option_block .o_add_wishlist_dyn, #product_option_block [data-action="o_wishlist"]');
                    if (wishlistTrigger && typeof wishlistTrigger.click === 'function') {
                        wishlistTrigger.click();
                        wishlistButton.classList.toggle('is-active');
                    }
                });
            }

            if (shareButton) {
                shareButton.addEventListener('click', function () {
                    var sharePayload = {
                        title: document.title,
                        url: window.location.href,
                    };
                    if (navigator.share) {
                        navigator.share(sharePayload).catch(function () {
                            // Ignore share cancellation.
                        });
                        return;
                    }
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(window.location.href).catch(function () {
                            // Ignore clipboard failures.
                        });
                    }
                });
            }

            actions.setAttribute('data-bader-ready', '1');
        }

        function initAddToCartFeedback() {
            if (document.body.getAttribute('data-bader-product-add-feedback') === '1') {
                return;
            }
            document.body.setAttribute('data-bader-product-add-feedback', '1');

            document.addEventListener('click', function (event) {
                var button = event.target && event.target.closest ? event.target.closest('#product_detail #add_to_cart, #product_detail .a-submit') : null;
                if (!button) return;

                var form = button.closest('form');
                var shouldForceManual = !!(
                    form &&
                    button.matches &&
                    button.matches('a.a-submit[href="#"], a.a-submit[href=""]')
                );

                if (shouldForceManual) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (typeof event.stopImmediatePropagation === 'function') {
                        event.stopImmediatePropagation();
                    }
                }

                if (button.getAttribute('data-bader-feedback-running') !== '1') {
                    var originalHtml = button.innerHTML;
                    button.setAttribute('data-bader-feedback-running', '1');
                    button.classList.add('bader-added');
                    button.innerHTML = '<i class="fa fa-check-circle"></i><span>Agregado</span>';
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
                            if (form && form.submit) {
                                form.submit();
                            }
                        })
                        .finally(function () {
                            button.removeAttribute('data-bader-force-submit');
                        });
                }
            }, true);
        }

        function syncHeaderCartBadge() {
            if (document.body.getAttribute('data-bader-cart-badge-sync') === '1') {
                return;
            }
            document.body.setAttribute('data-bader-cart-badge-sync', '1');

            function parseQty(rawValue) {
                var cleaned = String(rawValue || '').replace(/[^\d]/g, '');
                var qty = parseInt(cleaned, 10);
                return isNaN(qty) ? null : qty;
            }

            function qtyFromCartPopover() {
                if (document.querySelector('.bader-cart-popover--empty')) return 0;
                var rows = document.querySelectorAll('.bader-cart-popover__item');
                if (!rows.length) return null;

                var total = 0;
                rows.forEach(function (row) {
                    var qtyNode = row.querySelector('.bader-cart-popover__meta span');
                    var qty = parseQty(qtyNode ? qtyNode.textContent : '');
                    total += qty === null ? 1 : qty;
                });
                return total;
            }

            function qtyFromCartPage() {
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

            function syncQty() {
                var totalQty = qtyFromCartPopover();
                if (totalQty === null) {
                    totalQty = qtyFromCartPage();
                }
                if (totalQty !== null) {
                    renderHeaderCartQty(totalQty);
                }
            }

            syncQty();
            window.setTimeout(syncQty, 300);
            window.setTimeout(syncQty, 1200);

            document.addEventListener('change', function (event) {
                if (event.target && event.target.matches('.js_cart_lines .js_quantity')) {
                    syncQty();
                }
            });
        }

        function applyEnhancements() {
            initGalleryLightbox();
            initQtyControls();
            initInstallmentNote();
            initDescriptionToggle();
            initMobileDock();
            initSecondaryActions();
        }

        storeCurrentProductContext();
        initAddToCartFeedback();
        syncHeaderCartBadge();
        if (initPersonaSwitcher()) {
            return;
        }
        applyEnhancements();
        window.setTimeout(applyEnhancements, 400);
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
