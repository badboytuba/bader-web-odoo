/* Checkout/cart enhancements: loaded only on checkout flow pages for performance. */
'use strict';

(function initCheckoutPageEnhancements() {
    var path = window.location.pathname || '';
    if (
        path.indexOf('/shop/cart') !== 0 &&
        path.indexOf('/checkout') !== 0 &&
        path.indexOf('/shop/checkout') !== 0 &&
        path.indexOf('/shop/address') !== 0 &&
        path.indexOf('/shop/payment') !== 0
    ) {
        return;
    }

    var cartSummary = document.querySelector('#o_cart_summary .card, .js_cart_summary.bader-summary-card, .bader-summary-card');
    if (!cartSummary || cartSummary.querySelector('.bader-checkout-benefits')) return;

    var cartBenefits = document.createElement('div');
    cartBenefits.className = 'bader-checkout-benefits';
    cartBenefits.innerHTML =
        '<div class="bader-benefit">' +
        '<i class="fa fa-truck"></i>' +
        '<span>Envio gratis a todo el pais</span>' +
        '</div>' +
        '<div class="bader-benefit">' +
        '<i class="fa fa-shield"></i>' +
        '<span>Pago seguro</span>' +
        '</div>' +
        '<div class="bader-benefit">' +
        '<i class="fa fa-credit-card"></i>' +
        '<span>Hasta 12 cuotas sin interes</span>' +
        '</div>';

    cartSummary.appendChild(cartBenefits);
})();