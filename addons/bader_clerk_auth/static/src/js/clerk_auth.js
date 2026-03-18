/**
 * Clerk Authentication Frontend Integration
 *
 * Powers the website's Clerk integration. The shared website auth modal
 * handles email/password locally, while Clerk is used for social sign-in.
 * After Clerk authentication, creates an Odoo session via /clerk/callback
 * and hydrates the shared avatar + dropdown menu.
 *
 * IMPORTANT: This file is registered in web.assets_frontend and loaded
 * on every website page. It must:
 *   1. Fetch /clerk/config to get the publishable key
 *   2. Dynamically inject the Clerk.js CDN script with data-clerk-publishable-key
 *   3. Intercept clicks on [data-bader-auth-open] before the native modal
 *   4. Prevent duplicate initialization when assets are loaded twice
 */
(function () {
    'use strict';

    if (window.__baderClerkAuthBootstrapped) {
        return;
    }

    window.__baderClerkAuthBootstrapped = true;

    var CLERK_PK = '';
    var CLERK_FRONTEND_API = '';
    var CLERK_SCRIPT_ID = 'bader-clerk-sdk';
    var _clerkReady = false;
    var _clerkLoading = null;
    var _pendingRedirect = '/';

    function isClerkAuthEnabled() {
        var header = document.querySelector('header#top');
        return !!header && header.getAttribute('data-bader-auth-provider') === 'clerk';
    }

    function hasOdooSession() {
        var header = document.querySelector('header#top');
        return !!header && header.getAttribute('data-bader-odoo-authenticated') === '1';
    }

    function isCurrentOdooUserClerkLinked(clerkUser) {
        var header = document.querySelector('header#top');
        if (!header || header.getAttribute('data-bader-odoo-clerk-user') !== '1') {
            return false;
        }
        var odooClerkId = header.getAttribute('data-bader-odoo-clerk-id') || '';
        if (!odooClerkId || !clerkUser || !clerkUser.id) {
            return false;
        }
        return odooClerkId === clerkUser.id;
    }

    function normalizeRedirect(path) {
        var value = (path || '').trim();
        if (!value || value.charAt(0) !== '/' || value.indexOf('//') === 0) {
            return '/';
        }
        if (value.indexOf('/clerk/') === 0) {
            return '/';
        }
        return value;
    }

    function currentRedirectFromWindow() {
        try {
            var currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('clerk_login');
            currentUrl.searchParams.delete('redirect');
            return normalizeRedirect(
                currentUrl.pathname
                + (currentUrl.search || '')
                + (currentUrl.hash || '')
            );
        } catch (err) {
            return normalizeRedirect(
                window.location.pathname + (window.location.search || '') + (window.location.hash || '')
            );
        }
    }

    function resolveTriggerRedirect(trigger) {
        if (!trigger) {
            return currentRedirectFromWindow();
        }

        var explicitRedirect = trigger.getAttribute('data-bader-auth-redirect');
        if (explicitRedirect) {
            return normalizeRedirect(explicitRedirect);
        }

        var href = trigger.getAttribute('href') || '';
        if (href) {
            try {
                var targetUrl = new URL(href, window.location.origin);
                var redirectParam = targetUrl.searchParams.get('redirect');
                if (redirectParam) {
                    return normalizeRedirect(redirectParam);
                }
            } catch (err) {
                return normalizeRedirect(href);
            }
        }

        return currentRedirectFromWindow();
    }

    function openNativeAuthModal(tab, redirectPath) {
        var payload = {
            tab: tab || 'login',
            redirect: normalizeRedirect(redirectPath || currentRedirectFromWindow()),
        };
        window.__baderAuthAutoOpen = payload;
        window.dispatchEvent(new CustomEvent('bader:auth-open', { detail: payload }));
    }

    function consumeAutoOpenRedirect() {
        try {
            var currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get('clerk_login') !== '1') {
                return '';
            }
            var redirectPath = normalizeRedirect(currentUrl.searchParams.get('redirect') || '/');
            currentUrl.searchParams.delete('clerk_login');
            currentUrl.searchParams.delete('redirect');
            var cleanUrl = currentUrl.pathname;
            if (currentUrl.searchParams.toString()) {
                cleanUrl += '?' + currentUrl.searchParams.toString();
            }
            cleanUrl += currentUrl.hash || '';
            window.history.replaceState({}, document.title, cleanUrl || '/');
            return redirectPath;
        } catch (err) {
            return '';
        }
    }

    function consumeAutoLogoutRedirect() {
        try {
            var currentUrl = new URL(window.location.href);
            if (currentUrl.searchParams.get('clerk_logout') !== '1') {
                return '';
            }
            var redirectPath = normalizeRedirect(currentUrl.searchParams.get('redirect') || '/');
            currentUrl.searchParams.delete('clerk_logout');
            currentUrl.searchParams.delete('redirect');
            var cleanUrl = currentUrl.pathname;
            if (currentUrl.searchParams.toString()) {
                cleanUrl += '?' + currentUrl.searchParams.toString();
            }
            cleanUrl += currentUrl.hash || '';
            window.history.replaceState({}, document.title, cleanUrl || '/');
            return redirectPath;
        } catch (err) {
            return '';
        }
    }

    // ------------------------------------------------------------------
    // 1. Fetch Clerk config from Odoo (publishable key + frontend API)
    // ------------------------------------------------------------------
    function fetchConfig() {
        return fetch('/clerk/config', { credentials: 'same-origin' })
            .then(function (r) {
                if (!r.ok) throw new Error('Config HTTP ' + r.status);
                return r.json();
            })
            .then(function (cfg) {
                CLERK_PK = cfg.publishable_key || '';
                CLERK_FRONTEND_API = cfg.frontend_api || '';
                console.log('[Clerk] Config loaded, pk starts with:', CLERK_PK.substring(0, 12));
            })
            .catch(function (err) {
                console.warn('[Clerk] Could not load config:', err);
            });
    }

    // ------------------------------------------------------------------
    // 2. Load Clerk.js CDN script with data-clerk-publishable-key
    //    The v5 browser SDK auto-initializes when it finds this attribute
    // ------------------------------------------------------------------
    function loadClerkSDK() {
        return new Promise(function (resolve, reject) {
            if (window.Clerk && typeof window.Clerk.openSignIn === 'function') {
                resolve(window.Clerk);
                return;
            }

            var existingScript = document.getElementById(CLERK_SCRIPT_ID);
            if (existingScript) {
                waitForClerkReady(resolve, reject, 0);
                return;
            }

            var script = document.createElement('script');
            script.id = CLERK_SCRIPT_ID;
            script.src = 'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
            script.crossOrigin = 'anonymous';
            script.async = true;
            // Critical: v5 browser SDK reads this to auto-initialize
            script.setAttribute('data-clerk-publishable-key', CLERK_PK);
            script.onload = function () {
                console.log('[Clerk] SDK script loaded');
                waitForClerkReady(resolve, reject, 0);
            };
            script.onerror = function () {
                reject(new Error('[Clerk] Failed to load SDK script'));
            };
            document.head.appendChild(script);
        });
    }

    // The SDK auto-initializes asynchronously, wait until Clerk is ready
    // IMPORTANT: Even after auto-init, we must call clerk.load() to mount
    // the UI components (openSignIn, openUserProfile, etc.)
    function waitForClerkReady(resolve, reject, attempts) {
        if (attempts > 100) {
            reject(new Error('[Clerk] Timed out waiting for Clerk.loaded'));
            return;
        }

        // window.Clerk can be a Promise in the browser bundle
        var clerk = window.Clerk;
        if (!clerk) {
            setTimeout(function () { waitForClerkReady(resolve, reject, attempts + 1); }, 100);
            return;
        }

        // If it's a thenable (Promise), wait for it to resolve
        if (typeof clerk.then === 'function') {
            clerk.then(function (resolvedClerk) {
                // After the promise resolves, window.Clerk is the real instance
                loadClerkComponents(resolve, reject);
            }).catch(function (err) {
                reject(err);
            });
            return;
        }

        // Clerk instance exists — now load UI components
        loadClerkComponents(resolve, reject);
    }

    function loadClerkComponents(resolve, reject) {
        var clerk = window.Clerk;
        if (!clerk) {
            reject(new Error('[Clerk] No Clerk instance after init'));
            return;
        }

        // clerk.load() mounts the UI components (sign-in, user profile, etc.)
        // Without this, calling openSignIn() throws "components are not ready"
        if (typeof clerk.load === 'function') {
            console.log('[Clerk] Loading UI components...');
            clerk.load()
                .then(function () {
                    _clerkReady = true;
                    console.log('[Clerk] Components ready! User:', clerk.user ? clerk.user.fullName : 'none');
                    resolve(clerk);
                })
                .catch(function (err) {
                    console.error('[Clerk] Failed to load components:', err);
                    reject(err);
                });
        } else if (clerk.loaded) {
            // Fallback: already loaded
            _clerkReady = true;
            console.log('[Clerk] Already loaded! User:', clerk.user ? clerk.user.fullName : 'none');
            resolve(clerk);
        } else {
            setTimeout(function () { waitForClerkReady(resolve, reject, 50); }, 100);
        }
    }

    // ------------------------------------------------------------------
    // 3. Initialize: fetch config → load SDK
    // ------------------------------------------------------------------
    function ensureClerk() {
        if (_clerkReady && window.Clerk) return Promise.resolve(window.Clerk);
        if (_clerkLoading) return _clerkLoading;

        _clerkLoading = fetchConfig()
            .then(function () {
                if (!CLERK_PK) {
                    console.warn('[Clerk] No publishable key, falling back to native auth');
                    return null;
                }
                return loadClerkSDK();
            })
            .catch(function (err) {
                console.error('[Clerk] Init failed:', err);
                _clerkLoading = null;
                return null;
            });

        return _clerkLoading;
    }

    // ------------------------------------------------------------------
    // 4. After Clerk login, send JWT to Odoo /clerk/callback
    // ------------------------------------------------------------------
    function syncClerkSessionToOdoo(session) {
        if (!session) return;

        session.getToken().then(function (jwt) {
            if (!jwt) {
                console.warn('[Clerk] No JWT from session');
                return;
            }
            var callbackUrl = '/clerk/callback?token=' + encodeURIComponent(jwt);
            callbackUrl += '&redirect=' + encodeURIComponent(_pendingRedirect || currentRedirectFromWindow());
            console.log('[Clerk] Syncing session to Odoo...');
            window.location.href = callbackUrl;
        }).catch(function (err) {
            console.error('[Clerk] Failed to get token:', err);
        });
    }

    function performClerkLogout(clerk, redirectPath) {
        var targetPath = normalizeRedirect(redirectPath || '/');
        var targetUrl = new URL(targetPath, window.location.origin).toString();

        if (!clerk || typeof clerk.signOut !== 'function') {
            window.location.href = targetPath;
            return;
        }

        if (!clerk.user && !clerk.session) {
            window.location.href = targetPath;
            return;
        }

        clerk.signOut({ redirectUrl: targetUrl }).catch(function (err) {
            console.error('[Clerk] Failed to sign out:', err);
            window.location.href = targetPath;
        });
    }

    // ------------------------------------------------------------------
    // 5. Open Clerk sign-in popup for social login
    // ------------------------------------------------------------------
    function openClerkSignIn(e, redirectPath) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }

        _pendingRedirect = normalizeRedirect(redirectPath || currentRedirectFromWindow());

        ensureClerk().then(function (clerk) {
            if (!clerk) {
                // Fallback to native Odoo login
                window.location.href = '/web/login?native=1';
                return;
            }

            if (clerk.session) {
                syncClerkSessionToOdoo(clerk.session);
                return;
            }

            // Close native modal if somehow open
            hideNativeAuthModal();

            // Register listener BEFORE opening sign-in to catch the event
            // (adding after openSignIn causes a race condition)
            var _syncing = false;
            clerk.addListener(function (payload) {
                if (_syncing) return;
                if (payload && payload.session && payload.user) {
                    _syncing = true;
                    console.log('[Clerk] Sign-in detected:', payload.user.firstName);
                    syncClerkSessionToOdoo(payload.session);
                }
            });

            // Open Clerk sign-in popup
            // DO NOT set afterSignInUrl — it causes page reload before
            // our listener can fire and sync the session to Odoo
            clerk.openSignIn();
        });
    }

    // ------------------------------------------------------------------
    // 6. Hide native auth modal
    // ------------------------------------------------------------------
    function hideNativeAuthModal() {
        var modal = document.getElementById('baderAuthModal');
        if (modal) {
            modal.classList.remove('is-open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('bader-auth-modal-open');
        }
    }

    function getClerkUserEmail(user) {
        if (!user) {
            return '';
        }
        if (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) {
            return user.primaryEmailAddress.emailAddress;
        }
        if (user.emailAddresses && user.emailAddresses.length && user.emailAddresses[0].emailAddress) {
            return user.emailAddresses[0].emailAddress;
        }
        return '';
    }

    function getUserInitials(name, email) {
        var source = (name || '').trim();
        if (source) {
            var parts = source.split(/\s+/).filter(Boolean);
            if (parts.length > 1) {
                return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
            }
            return parts[0].charAt(0).toUpperCase();
        }
        return ((email || 'U').charAt(0) || 'U').toUpperCase();
    }

    function updateAvatarElements(imageUrl, name, fallbackText) {
        var wrappers = document.querySelectorAll('[data-bader-user-avatar]');
        wrappers.forEach(function (wrapper) {
            var img = wrapper.querySelector('[data-bader-user-avatar-img]');
            var fallback = wrapper.querySelector('[data-bader-user-avatar-fallback]');

            if (img) {
                if (imageUrl) {
                    img.setAttribute('src', imageUrl);
                    img.setAttribute('alt', name || 'Usuario');
                    img.classList.remove('d-none');
                } else {
                    img.removeAttribute('src');
                    img.classList.add('d-none');
                }
            }

            if (fallback) {
                fallback.textContent = fallbackText;
                fallback.classList.toggle('d-none', !!imageUrl);
            }
        });
    }

    function updateTextElements(selector, value) {
        document.querySelectorAll(selector).forEach(function (element) {
            element.textContent = value || '';
        });
    }

    function updateLogoutLinks(logoutUrl) {
        document.querySelectorAll('[data-bader-user-logout]').forEach(function (link) {
            link.setAttribute(
                'href',
                logoutUrl || link.getAttribute('data-bader-user-logout-native') || '/web/session/logout?redirect=/'
            );
        });
    }

    // ------------------------------------------------------------------
    // 7. Hydrate the shared Odoo user menu with Clerk identity data
    // ------------------------------------------------------------------
    function showUserAvatar(clerk) {
        var user = clerk.user;
        if (!user) return;

        var name = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(' ');
        var email = getClerkUserEmail(user);
        var initials = getUserInitials(name, email);

        updateTextElements('[data-bader-user-name]', name || 'Usuario');
        updateTextElements('[data-bader-user-email]', email);
        updateAvatarElements(user.imageUrl || '', name, initials);
        updateLogoutLinks('/clerk/logout');

        var authModal = document.getElementById('baderAuthModal');
        if (authModal) {
            authModal.style.display = 'none';
        }
    }

    // ------------------------------------------------------------------
    // 8. Intercept Clerk-specific triggers BEFORE main.js
    // ------------------------------------------------------------------
    function bindAuthTriggers() {
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest
                ? e.target.closest('[data-bader-clerk-open]')
                : null;

            if (trigger) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                openClerkSignIn(e, resolveTriggerRedirect(trigger));
            }
        }, true);
    }

    // ------------------------------------------------------------------
    // 9. Initialize
    // ------------------------------------------------------------------
    function init() {
        if (!isClerkAuthEnabled()) {
            return;
        }

        _pendingRedirect = currentRedirectFromWindow();
        console.log('[Clerk] Initializing auth integration...');

        // Bind click handler FIRST (capture phase, before main.js)
        bindAuthTriggers();

        var autoOpenRedirect = consumeAutoOpenRedirect();
        var autoLogoutRedirect = consumeAutoLogoutRedirect();
        if (autoOpenRedirect) {
            _pendingRedirect = autoOpenRedirect;
        }

        // Then initialize Clerk SDK
        ensureClerk().then(function (clerk) {
            if (autoLogoutRedirect) {
                performClerkLogout(clerk, autoLogoutRedirect);
                return;
            }

            if (!clerk) return;

            // If user is already signed in via Clerk, show avatar
            if (clerk.user) {
                if (isCurrentOdooUserClerkLinked(clerk.user)) {
                    showUserAvatar(clerk);
                }

                // If user is signed in via Clerk but not in Odoo,
                // sync the session
                if (clerk.session) {
                    if (!hasOdooSession()) {
                        syncClerkSessionToOdoo(clerk.session);
                    }
                }
                return;
            }

            if (autoOpenRedirect) {
                openNativeAuthModal('login', autoOpenRedirect);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
