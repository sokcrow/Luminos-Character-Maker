import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../hoja_personaje.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../hoja_personaje.css', import.meta.url), 'utf8');
const start = source.indexOf('  const notificationBadges = new Map();');
const end = source.indexOf('  const refreshUnreadChat =', start);
assert.ok(start >= 0 && end > start, 'Notification runtime must be present');
const runtime = source.slice(start, end);

function setupViewport(width, height, unreadBank = true) {
    const frames = [];
    const main = { parentElement: null, getBoundingClientRect: () => ({ left: 0, top: 0, right: width, bottom: height }) };
    const clipped = {
        parentElement: main,
        overflowX: 'hidden',
        overflowY: 'hidden',
        getBoundingClientRect: () => ({ left: 0, top: 0, right: width, bottom: height }),
    };
    const button = {
        isConnected: true,
        parentElement: clipped,
        textContent: 'Banco',
        rect: { left: 40, top: 70, right: 150, bottom: 120, width: 110, height: 50 },
        attrs: {},
        getBoundingClientRect() { return this.rect; },
        getAttribute(name) { return this.attrs[name] ?? null; },
        setAttribute(name, value) { this.attrs[name] = value; },
        removeAttribute(name) { delete this.attrs[name]; },
    };
    const anchors = new Map([['button[name="act_tab_banco"]', button]]);
    const body = {
        parentElement: null,
        children: [],
        appendChild(child) { this.children.push(child); child.parentElement = this; },
    };
    const document = {
        body,
        querySelector: (selector) => anchors.get(selector) ?? null,
        createElement: () => ({
            style: {},
            attrs: {},
            setAttribute(name, value) { this.attrs[name] = value; },
            remove() { this.parentElement.children = this.parentElement.children.filter((child) => child !== this); },
        }),
        addEventListener() {},
    };
    const window = {
        innerWidth: width,
        innerHeight: height,
        isPhoneMuted: false,
        __luminousUnreadGroupChat: false,
        requestAnimationFrame(callback) { frames.push(callback); },
        getComputedStyle: (element) => ({
            display: 'block',
            visibility: 'visible',
            contentVisibility: 'visible',
            opacity: element.opacity ?? '1',
            overflowX: element.overflowX ?? 'visible',
            overflowY: element.overflowY ?? 'visible',
        }),
        addEventListener() {},
    };

    const api = new Function('window', 'document', 'unreadBank', 'unreadMail', 'unreadChat',
        runtime + '\nreturn { update: window.updateNotifications, badges: notificationBadges, setUnreadBank: (value) => { unreadBank = value; } };'
    )(window, document, unreadBank, false, false);

    return {
        button, body, clipped, window, ...api,
        flush() { while (frames.length) frames.shift()(); },
    };
}

test('badges float outside clipped controls at all TX-01 screen sizes', () => {
    for (const [width, height] of [[360, 800], [390, 844], [844, 390], [768, 1024], [1280, 720], [1920, 1080]]) {
        const page = setupViewport(width, height);
        page.update();
        page.flush();
        const badge = page.badges.get('button[name="act_tab_banco"]');
        assert.ok(badge, `badge exists on ${width}x${height}`);
        assert.equal(badge.parentElement, page.body, 'badge must not be a clipped button descendant');
        assert.equal(badge.hidden, false);
        assert.equal(badge.style.left, '28px', 'half the badge must be outside the button');
        assert.equal(badge.style.top, '58px');
        assert.match(page.button.attrs['aria-label'], /notificación sin leer/);
    }
});

test('hidden or offscreen controls hide the badge, and dismissal clears it', () => {
    const page = setupViewport(390, 844);
    page.update();
    page.flush();
    assert.equal(page.body.children.length, 1);
    page.clipped.opacity = '0';
    page.update();
    page.flush();
    assert.equal(page.body.children[0].hidden, true, 'closed ancestor hides floating badge');
    page.clipped.opacity = '1';
    page.button.rect = { left: -100, right: -30, top: 70, bottom: 120, width: 70, height: 50 };
    page.update();
    page.flush();
    assert.equal(page.body.children[0].hidden, true, 'offscreen badge stays hidden');
    page.setUnreadBank(false);
    page.update();
    page.flush();
    assert.equal(page.body.children.length, 0, 'read notification removes the badge');
    assert.equal(page.button.getAttribute('aria-label'), null, 'original accessible name is restored');
});

test('notification styles are independent of button clipping', () => {
    assert.match(css, /\.limbus-badge--floating\s*\{[\s\S]*?position:\s*fixed;/);
    assert.match(css, /\.limbus-badge--floating\[hidden\]\s*\{[\s\S]*?display:\s*none\s*!important;/);
    assert.doesNotMatch(runtime, /el\.appendChild\(badge\)/);
});
