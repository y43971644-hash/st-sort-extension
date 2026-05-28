// Character & Persona Sorter Extension for SillyTavern
// Кнопки появляются по долгому нажатию (long press) — работает и на телефоне, и на ПК

import { saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, getContext } from '../../../extensions.js';

const EXT_NAME = 'character-persona-sorter';

function log(...args) { console.log(`[${EXT_NAME}]`, ...args); }

// ─── Хранилище порядка ───────────────────────────────────────────────────────

const CHAR_ORDER_KEY    = 'cps_char_order';
const PERSONA_ORDER_KEY = 'cps_persona_order';

function getOrder(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
}
function saveOrder(key, order) {
    localStorage.setItem(key, JSON.stringify(order));
}

// ─── Применить сохранённый порядок ──────────────────────────────────────────

function applyOrder(listSel, itemsSel, getNameFn, orderKey) {
    const list = document.querySelector(listSel);
    if (!list) return;
    const order = getOrder(orderKey);
    if (!order.length) return;

    const items = [...list.querySelectorAll(itemsSel)];
    const top = [], bottom = [], rest = [];

    items.forEach(el => {
        const name  = getNameFn(el);
        const entry = order.find(e => (typeof e === 'object' ? e.name : e) === name);
        if (!entry)                                              { rest.push(el);   return; }
        if (typeof entry === 'object' && entry.pos === 'bottom') bottom.push(el);
        else                                                     top.push(el);
    });

    [...top, ...rest, ...bottom].forEach(el => list.appendChild(el));
}

function applyCharOrder() {
    applyOrder('#character_list', '.character_select', getCharName, CHAR_ORDER_KEY);
}
function applyPersonaOrder() {
    [
        ['#persona_list',    '.persona_item'],
        ['.persona_list',    '.persona_item'],
        ['#personas-list',   '.persona_item'],
        ['#user_avatar_block', '.avatar-container'],
    ].forEach(([ls, is]) => applyOrder(ls, is, getPersonaName, PERSONA_ORDER_KEY));
}

// ─── Имена ──────────────────────────────────────────────────────────────────

function getCharName(el) {
    return (
        el.querySelector('.ch_name')?.textContent.trim() ||
        el.dataset.chid ||
        el.getAttribute('chid') ||
        el.textContent.trim().split('\n')[0]
    );
}
function getPersonaName(el) {
    return (
        el.dataset.name ||
        el.querySelector('.persona_name, .avatar_name')?.textContent.trim() ||
        el.querySelector('img')?.alt ||
        el.textContent.trim().split('\n')[0]
    );
}

// ─── Закрепить позицию ──────────────────────────────────────────────────────

function pin(key, name, pos, applyFn) {
    let order = getOrder(key).filter(e => (typeof e === 'object' ? e.name : e) !== name);
    if (pos === 'top') order = [{ name, pos }, ...order];
    else               order = [...order, { name, pos }];
    saveOrder(key, order);
    applyFn();
}

// ─── Long-press логика ───────────────────────────────────────────────────────
// 500 мс — показываем меню; при движении пальца/мыши — отменяем

const LONG_PRESS_MS = 500;

function attachLongPress(el, onLongPress) {
    let timer   = null;
    let moved   = false;
    let startX  = 0;
    let startY  = 0;

    function start(x, y) {
        moved  = false;
        startX = x;
        startY = y;
        timer  = setTimeout(() => {
            if (!moved) onLongPress();
        }, LONG_PRESS_MS);
    }

    function cancel() { clearTimeout(timer); }

    function move(x, y) {
        if (Math.abs(x - startX) > 8 || Math.abs(y - startY) > 8) {
            moved = true;
            cancel();
        }
    }

    // Touch
    el.addEventListener('touchstart',  e => start(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    el.addEventListener('touchend',    cancel,                { passive: true });
    el.addEventListener('touchcancel', cancel,                { passive: true });
    el.addEventListener('touchmove',   e => move(e.touches[0].clientX, e.touches[0].clientY), { passive: true });

    // Mouse (ПК)
    el.addEventListener('mousedown', e => start(e.clientX, e.clientY));
    el.addEventListener('mouseup',   cancel);
    el.addEventListener('mousemove', e => move(e.clientX, e.clientY));
    el.addEventListener('mouseleave', cancel);
}

// ─── Всплывающее меню ────────────────────────────────────────────────────────

let activeMenu = null;

function closeActiveMenu() {
    if (activeMenu) { activeMenu.remove(); activeMenu = null; }
}

function showSortMenu(anchorEl, name, isPersona) {
    closeActiveMenu();

    const menu = document.createElement('div');
    menu.className = 'cps-menu';

    const title = document.createElement('div');
    title.className = 'cps-menu-title';
    title.textContent = name;
    menu.appendChild(title);

    const btnTop = document.createElement('button');
    btnTop.className = 'cps-menu-btn cps-menu-btn-top';
    btnTop.innerHTML = '⬆ В начало списка';
    btnTop.addEventListener('click', e => {
        e.stopPropagation();
        if (isPersona) pin(PERSONA_ORDER_KEY, name, 'top', applyPersonaOrder);
        else           pin(CHAR_ORDER_KEY,    name, 'top', applyCharOrder);
        showToast(`«${name}» → начало`);
        closeActiveMenu();
    });

    const btnBot = document.createElement('button');
    btnBot.className = 'cps-menu-btn cps-menu-btn-bot';
    btnBot.innerHTML = '⬇ В конец списка';
    btnBot.addEventListener('click', e => {
        e.stopPropagation();
        if (isPersona) pin(PERSONA_ORDER_KEY, name, 'bottom', applyPersonaOrder);
        else           pin(CHAR_ORDER_KEY,    name, 'bottom', applyCharOrder);
        showToast(`«${name}» → конец`);
        closeActiveMenu();
    });

    const btnReset = document.createElement('button');
    btnReset.className = 'cps-menu-btn cps-menu-btn-reset';
    btnReset.innerHTML = '✕ Сбросить позицию';
    btnReset.addEventListener('click', e => {
        e.stopPropagation();
        const key = isPersona ? PERSONA_ORDER_KEY : CHAR_ORDER_KEY;
        saveOrder(key, getOrder(key).filter(en => (typeof en === 'object' ? en.name : en) !== name));
        if (isPersona) applyPersonaOrder(); else applyCharOrder();
        showToast(`«${name}» — сброшено`);
        closeActiveMenu();
    });

    menu.appendChild(btnTop);
    menu.appendChild(btnBot);
    menu.appendChild(btnReset);
    document.body.appendChild(menu);
    activeMenu = menu;

    // Позиционируем рядом с карточкой
    const rect = anchorEl.getBoundingClientRect();
    const mw   = 220;
    let left   = rect.left + rect.width / 2 - mw / 2;
    let top    = rect.bottom + 6 + window.scrollY;

    // Не выходим за правый край
    if (left + mw > window.innerWidth - 8) left = window.innerWidth - mw - 8;
    if (left < 8) left = 8;

    menu.style.left  = `${left}px`;
    menu.style.top   = `${top}px`;
    menu.style.width = `${mw}px`;

    // Вибрация на телефоне
    if (navigator.vibrate) navigator.vibrate(40);
}

// Закрывать меню при тапе вне него
document.addEventListener('touchstart', e => {
    if (activeMenu && !activeMenu.contains(e.target)) closeActiveMenu();
}, { passive: true });
document.addEventListener('mousedown', e => {
    if (activeMenu && !activeMenu.contains(e.target)) closeActiveMenu();
});

// ─── Навешиваем long press на карточки ──────────────────────────────────────

function injectCharButtons() {
    document.querySelectorAll('.character_select').forEach(el => {
        if (el.dataset.cpsReady) return;
        el.dataset.cpsReady = '1';
        const name = getCharName(el);
        attachLongPress(el, () => showSortMenu(el, name, false));
    });
}

function injectPersonaButtons() {
    const selectors = [
        '#persona_list .persona_item',
        '.persona_list .persona_item',
        '#personas-list .persona_item',
        '#user_avatar_block .avatar-container',
    ];
    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            if (el.dataset.cpsReady) return;
            el.dataset.cpsReady = '1';
            const name = getPersonaName(el);
            attachLongPress(el, () => showSortMenu(el, name, true));
        });
    });
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'cps-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('cps-toast-show'), 10);
    setTimeout(() => {
        t.classList.remove('cps-toast-show');
        setTimeout(() => t.remove(), 300);
    }, 2200);
}

// ─── MutationObserver ────────────────────────────────────────────────────────

let injectTimeout = null;
function scheduleInject() {
    clearTimeout(injectTimeout);
    injectTimeout = setTimeout(() => {
        injectCharButtons();
        injectPersonaButtons();
        applyCharOrder();
        applyPersonaOrder();
    }, 300);
}

const observer = new MutationObserver(mutations => {
    const relevant = mutations.some(m =>
        [...m.addedNodes].some(n =>
            n.nodeType === 1 && (
                n.matches?.('.character_select, .persona_item, .avatar-container') ||
                n.querySelector?.('.character_select, .persona_item, .avatar-container')
            )
        )
    );
    if (relevant) scheduleInject();
});

// ─── Init ────────────────────────────────────────────────────────────────────

jQuery(async () => {
    log('Extension loaded');

    setTimeout(() => {
        injectCharButtons();
        injectPersonaButtons();
        applyCharOrder();
        applyPersonaOrder();
    }, 1500);

    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', e => {
        if (e.target.closest('#rm_button_characters, #show_more_messages')) {
            scheduleInject();
        }
    });

    log('Ready — long press a card to sort');
});
