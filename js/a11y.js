(function () {
    'use strict';

    const CLICKABLE_SELECTORS = [
        '[onclick]',   
        '.nearby-place-card',
        '.terminal-info-icon',
        '.integration-more-info'
    ];

    const NATIVE_FOCUSABLE = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];

    const FOCUSABLE = [
        'a[href]', 'button:not([disabled])', 'input:not([disabled])',
        'select:not([disabled])', 'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const OVERLAYS = [
        { selector: '.modal-overlay',            activeClass: 'active', closer: '.close-btn',                trap: true  },
        { selector: '.info-sidebar',             activeClass: 'active', closer: '#sidebarCloseBtn',          trap: false },
        { selector: '.route-panel',              activeClass: 'active', closer: '#closePanelBtn',            trap: false },
        { selector: '.chat-assistant-container', activeClass: 'active', closer: '#closeChatBtn',             trap: false },
        { selector: '.mobile-actions-sidebar',   activeClass: 'active', closer: '#mobileActionsCloseBtn',    trap: false }
    ];

    const POPUP_SELECTOR = '.integration-info-popup';
    const POPUP_CLOSER   = '.integration-info-close';

    function isVisible(el) {
        return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    }

    function focusableWithin(container) {
        if (!container) return [];
        return Array.prototype.filter.call(
            container.querySelectorAll(FOCUSABLE),
            isVisible
        );
    }

    function collapseText(el) {
        return (el.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function injectStyles() {
        if (document.getElementById('rh-a11y-styles')) return;
        const css = `
        .rh-skip-link {
            position: absolute;
            left: 12px;
            top: -56px;
            z-index: 6000;
            background: var(--primary, #4f46e5);
            color: #fff;
            padding: 10px 18px;
            border-radius: 10px;
            font-weight: 700;
            font-size: 0.95rem;
            text-decoration: none;
            box-shadow: 0 6px 18px rgba(0,0,0,0.2);
            transition: top 0.2s ease;
        }
        .rh-skip-link:focus {
            top: 12px;
            outline: 3px solid #fff;
            outline-offset: 2px;
        }
        /* Foco visível consistente apenas para navegação por teclado.
           Não afeta cliques de mouse (graças ao :focus-visible). */
        a:focus-visible,
        button:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible,
        [tabindex]:focus-visible,
        [role="button"]:focus-visible {
            outline: 3px solid var(--primary, #4f46e5);
            outline-offset: 2px;
            border-radius: 6px;
        }
        .rh-sr-only {
            position: absolute;
            width: 1px; height: 1px;
            padding: 0; margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }`;
        const style = document.createElement('style');
        style.id = 'rh-a11y-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    function addSkipLink() {
        if (document.querySelector('.rh-skip-link')) return;
        const main = document.querySelector('main');
        if (!main) return;
        if (!main.id) main.id = 'rh-main-content';
        main.setAttribute('tabindex', '-1');

        const link = document.createElement('a');
        link.className = 'rh-skip-link';
        link.href = '#' + main.id;
        link.textContent = 'Pular para o conteúdo';
        link.addEventListener('click', function () {

            setTimeout(function () { main.focus(); }, 0);
        });
        document.body.insertBefore(link, document.body.firstChild);
    }

    function hardenIconsAndLabels(root) {
        const scope = root || document;

        scope.querySelectorAll('i.fa-solid, i.fa-regular, i.fa-brands, i[class*="fa-"]').forEach(function (icon) {
            if (!icon.hasAttribute('aria-hidden')) icon.setAttribute('aria-hidden', 'true');
        });

        scope.querySelectorAll('button, a').forEach(function (el) {
            const hasLabel = el.getAttribute('aria-label') ||
                             el.getAttribute('aria-labelledby') ||
                             collapseText(el);
            if (!hasLabel && el.title) {
                el.setAttribute('aria-label', el.title);
            }
        });
    }

    function makeClickablesAccessible(root) {
        const scope = root || document;
        const seen = new Set();

        CLICKABLE_SELECTORS.forEach(function (sel) {
            scope.querySelectorAll(sel).forEach(function (el) {
                if (seen.has(el)) return;
                seen.add(el);

                if (NATIVE_FOCUSABLE.indexOf(el.tagName) !== -1) return;
                if (el.dataset.rhKeyable === 'true') return;

                el.dataset.rhKeyable = 'true';
                if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
                if (!el.hasAttribute('role')) el.setAttribute('role', 'button');

                if (!el.getAttribute('aria-label')) {
                    const label = collapseText(el);
                    if (label) el.setAttribute('aria-label', label);
                }
            });
        });

        scope.querySelectorAll('.dropdown-list li').forEach(function (li) {
            if (li.dataset.rhKeyable === 'true') return;
            if (!li.querySelector('.route-name')) return;
            li.dataset.rhKeyable = 'true';
            li.setAttribute('tabindex', '0');
            li.setAttribute('role', 'button');
            const name = li.querySelector('.route-name');
            if (name && !li.getAttribute('aria-label')) {
                li.setAttribute('aria-label', collapseText(name));
            }
        });
    }

    function labelVLibras(root) {
        const scope = root || document;
        const btn = scope.querySelector('[vw-access-button]');
        if (btn && !btn.getAttribute('aria-label')) {
            btn.setAttribute('aria-label', 'Ativar tradução em Libras (VLibras)');
            btn.setAttribute('role', 'button');
            if (!btn.hasAttribute('tabindex')) btn.setAttribute('tabindex', '0');
        }
    }

    function handleActivationKeydown(e) {
        if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;

        const target = e.target;
        if (!target || NATIVE_FOCUSABLE.indexOf(target.tagName) !== -1) return;

        const isKeyable = target.dataset && target.dataset.rhKeyable === 'true';
        const looksLikeButton = target.getAttribute && target.getAttribute('role') === 'button';
        if (!isKeyable && !looksLikeButton) return;

        e.preventDefault();
        target.click();
    }


    const openerMap = new WeakMap();
    const stateMap = new WeakMap();

    function isOverlayActive(el, cfg) {
        if (cfg.popup) return document.body.contains(el);
        return el.classList.contains(cfg.activeClass);
    }

    function focusInto(el) {
        const focusables = focusableWithin(el);
        const target = focusables[0] || el;
        try {
            if (target === el && !el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '-1');
            }
            target.focus({ preventScroll: false });
        } catch (_) {}
    }

    function restoreFocus(opener) {
        if (opener && document.body.contains(opener) && isVisible(opener)) {
            try { opener.focus(); } catch (_) {}
        }
    }

    function evaluateOverlays() {
        const all = [];

        OVERLAYS.forEach(function (cfg) {
            document.querySelectorAll(cfg.selector).forEach(function (el) {
                all.push({ el: el, cfg: cfg });
            });
        });
        document.querySelectorAll(POPUP_SELECTOR).forEach(function (el) {
            all.push({ el: el, cfg: { selector: POPUP_SELECTOR, closer: POPUP_CLOSER, trap: true, popup: true } });
        });

        all.forEach(function (item) {
            const active = isOverlayActive(item.el, item.cfg);
            const was = stateMap.get(item.el) === true;

            if (active && !was) {

                openerMap.set(item.el, document.activeElement);
                stateMap.set(item.el, true);

                setTimeout(function () {
                    if (isOverlayActive(item.el, item.cfg)) focusInto(item.el);
                }, 30);
            } else if (!active && was) {
                stateMap.set(item.el, false);
                restoreFocus(openerMap.get(item.el));
                openerMap.delete(item.el);
            }
        });
    }

    function topmostActiveOverlay() {

        const priority = [
            { selector: POPUP_SELECTOR, closer: POPUP_CLOSER, trap: true, popup: true },
            { selector: '.mobile-actions-sidebar',   activeClass: 'active', closer: '#mobileActionsCloseBtn', trap: false },
            { selector: '.modal-overlay',            activeClass: 'active', closer: '.close-btn',             trap: true  },
            { selector: '.info-sidebar',             activeClass: 'active', closer: '#sidebarCloseBtn',       trap: false },
            { selector: '.route-panel',              activeClass: 'active', closer: '#closePanelBtn',         trap: false },
            { selector: '.chat-assistant-container', activeClass: 'active', closer: '#closeChatBtn',          trap: false }
        ];

        for (let i = 0; i < priority.length; i++) {
            const cfg = priority[i];
            const els = document.querySelectorAll(cfg.selector);
            for (let j = 0; j < els.length; j++) {
                if (isOverlayActive(els[j], cfg)) {
                    return { el: els[j], cfg: cfg };
                }
            }
        }
        return null;
    }

    function closeOverlay(item) {
        const closerEl = item.el.querySelector(item.cfg.closer) ||
                         document.querySelector(item.cfg.closer);
        if (closerEl) {

            closerEl.click();
        } else if (item.cfg.popup) {
            item.el.remove();
        } else if (item.cfg.activeClass) {
            item.el.classList.remove(item.cfg.activeClass);
        }
    }

    function handleGlobalKeydown(e) {

        if (e.key === 'Escape' || e.key === 'Esc') {
            const top = topmostActiveOverlay();
            if (top) {
                e.preventDefault();
                closeOverlay(top);

                setTimeout(evaluateOverlays, 0);
            }
            return;
        }

        if (e.key === 'Tab') {
            const top = topmostActiveOverlay();
            if (!top || !top.cfg.trap) return;

            const focusables = focusableWithin(top.el);
            if (focusables.length === 0) {
                e.preventDefault();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const activeEl = document.activeElement;
            const inside = top.el.contains(activeEl);

            if (!inside) {
                e.preventDefault();
                first.focus();
                return;
            }
            if (e.shiftKey && activeEl === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && activeEl === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    function hardenPass(root) {
        hardenIconsAndLabels(root);
        makeClickablesAccessible(root);
        labelVLibras(root);
    }

    function startObserver() {
        const observer = new MutationObserver(function (mutations) {
            let needHarden = false;
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === 'childList' && m.addedNodes.length) needHarden = true;
                if (m.type === 'attributes') {}
            }
            if (needHarden) hardenPass(document);
            evaluateOverlays();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function init() {
        injectStyles();
        addSkipLink();
        hardenPass(document);
        startObserver();

        document.addEventListener('keydown', handleActivationKeydown, true);
        document.addEventListener('keydown', handleGlobalKeydown, true);

        setTimeout(function () { labelVLibras(document); }, 1500);
        setTimeout(function () { labelVLibras(document); }, 4000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();