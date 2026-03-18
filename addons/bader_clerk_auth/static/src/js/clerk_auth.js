/**
 * Clerk Authentication Frontend Integration
 *
 * Replaces the native Odoo auth modal (baderAuthModal) with
 * Clerk's sign-in popup. After authentication, creates an Odoo session
 * via /clerk/callback and shows user avatar + dropdown menu.
 *
 * IMPORTANT: This file is registered in web.assets_frontend and loaded
 * on every page. It must:
 *   1. Fetch /clerk/config to get the publishable key
 *   2. Dynamically inject the Clerk.js CDN script with data-clerk-publishable-key
 *   3. Intercept clicks on [data-bader-auth-open] BEFORE main.js (capture phase)
 *   4. Prevent the native baderAuthModal from opening
 */
(function () {
    'use strict';

    var CLERK_PK = '';
    var CLERK_FRONTEND_API = '';
    var _clerkReady = false;
    var _clerkLoading = null;

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

            var script = document.createElement('script');
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
            callbackUrl += '&redirect=' + encodeURIComponent(window.location.pathname);
            console.log('[Clerk] Syncing session to Odoo...');
            window.location.href = callbackUrl;
        }).catch(function (err) {
            console.error('[Clerk] Failed to get token:', err);
        });
    }

    // ------------------------------------------------------------------
    // 5. Open Clerk sign-in popup (replaces native modal)
    // ------------------------------------------------------------------
    function openClerkSignIn(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
        }

        ensureClerk().then(function (clerk) {
            if (!clerk) {
                // Fallback to native Odoo login
                window.location.href = '/web/login?native=1';
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

    // ------------------------------------------------------------------
    // 7. Replace "Tu Cuenta" with user avatar when logged in
    // ------------------------------------------------------------------
    function showUserAvatar(clerk) {
        var user = clerk.user;
        if (!user) return;

        var name = user.fullName || '';
        var email = (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) || '';

        var triggers = document.querySelectorAll('.bader-auth-trigger, [data-bader-auth-open]');
        triggers.forEach(function (trigger) {
            var avatar = document.createElement('div');
            avatar.className = 'bader-clerk-avatar';
            avatar.title = name || email || 'Tu Cuenta';

            if (user.imageUrl) {
                var img = document.createElement('img');
                img.src = user.imageUrl;
                img.alt = name;
                img.className = 'bader-clerk-avatar__img';
                avatar.appendChild(img);
            } else {
                var initial = document.createElement('span');
                initial.className = 'bader-clerk-avatar__initial';
                initial.textContent = (user.firstName || email || 'U')[0].toUpperCase();
                avatar.appendChild(initial);
            }

            avatar.addEventListener('click', function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                clerk.openUserProfile();
            });

            if (trigger.parentNode) {
                trigger.parentNode.replaceChild(avatar, trigger);
            }
        });

        // Also hide the native auth modal completely
        var authModal = document.getElementById('baderAuthModal');
        if (authModal) {
            authModal.style.display = 'none';
        }
    }

    // ------------------------------------------------------------------
    // 8. Intercept [data-bader-auth-open] clicks BEFORE main.js
    //    Using capture phase = true so we fire before bubbling handlers
    // ------------------------------------------------------------------
    function bindAuthTriggers() {
        document.addEventListener('click', function (e) {
            var trigger = e.target.closest
                ? e.target.closest('.bader-auth-trigger, [data-bader-auth-open]')
                : null;

            if (trigger) {
                // Prevent native auth modal from opening
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                openClerkSignIn(e);
            }
        }, true); // capture phase = runs BEFORE main.js bubbling handler
    }

    // ------------------------------------------------------------------
    // 9. Initialize
    // ------------------------------------------------------------------
    function init() {
        console.log('[Clerk] Initializing auth integration...');

        // Bind click handler FIRST (capture phase, before main.js)
        bindAuthTriggers();

        // Then initialize Clerk SDK
        ensureClerk().then(function (clerk) {
            if (!clerk) return;

            // If user is already signed in via Clerk, show avatar
            if (clerk.user) {
                showUserAvatar(clerk);

                // If user is signed in via Clerk but not in Odoo,
                // sync the session
                if (clerk.session) {
                    var hasOdooSession = document.cookie.indexOf('session_id=') !== -1;
                    if (!hasOdooSession) {
                        syncClerkSessionToOdoo(clerk.session);
                    }
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
