const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/measurement.js'), 'utf8');
const base = 'https://vitalcore-tienda.github.io/vitalcoretrainer/';
const id = 'G-1234567890';
const key = 'vitalcore_measurement_choice_v1';
const slugs = ['primera-consulta-personal-trainer', 'cada-cuanto-cambiar-rutina', 'como-registrar-cargas-entrenamiento', 'maquinas-o-pesos-libres', 'fuerza-e-hipertrofia'];

function harness(options = {}) {
  const nodes = [];
  const listeners = {};
  const stored = new Map(options.choice ? [[key, options.choice]] : []);
  const cookies = new Map([['_ga', 'abc'], ['_ga_1234567890', 'def'], ['_ga_OTHER', 'keep'], ['unrelated', 'keep']]);
  const deletions = [];
  function node(tag) {
    const handlers = {};
    const children = new Map();
    const value = {
      tag, handlers, hidden: true, removed: false, focused: false,
      addEventListener(type, fn) { handlers[type] = fn; },
      setAttribute() {},
      querySelector(selector) {
        if (!children.has(selector)) children.set(selector, node('button'));
        return children.get(selector);
      },
      focus() { this.focused = true; },
      remove() { this.removed = true; }
    };
    nodes.push(value);
    return value;
  }
  const preference = node('button');
  preference.hidden = true;
  const document = {
    referrer: 'https://www.google.com/search?q=persona%40example.com#private',
    head: { append(value) { value.inHead = true; } },
    body: { append(value) { value.inBody = true; } },
    createElement: node,
    querySelectorAll() { return [preference]; },
    addEventListener(type, fn) { listeners[type] = fn; }
  };
  Object.defineProperty(document, 'cookie', {
    get() { return [...cookies].map(([name, value]) => `${name}=${value}`).join('; '); },
    set(value) { if (value.includes('Max-Age=0')) { deletions.push(value); cookies.delete(value.split('=')[0]); } }
  });
  const window = {
    location: new URL(options.url || base + 'blog/' + slugs[0] + '.html?email=persona@example.com#private'),
    VITALCORE_MEASUREMENT: { measurementId: options.id === undefined ? id : options.id },
    localStorage: {
      getItem(name) { if (options.storageBlocked) throw Error('Unavailable'); return stored.get(name) || null; },
      setItem(name, value) { if (options.storageBlocked) throw Error('Unavailable'); stored.set(name, value); }
    }
  };
  vm.runInNewContext(source, { window, document, URL, Date });
  const panel = nodes.find(value => value.tag === 'aside');
  function click(href, location = 'article', options = {}) {
    let prevented = false;
    const link = { href, closest(selector) { return selector === location ? {} : null; } };
    const event = { target: { closest() { return link; } }, preventDefault() { prevented = true; }, ...options };
    listeners.click?.(event);
    assert.equal(prevented, false, 'la medición no debe bloquear la navegación');
    assert.equal(link.href, href, 'el enlace original conserva su texto y destino');
  }
  return {
    window, document, stored, cookies, deletions, panel, preference, click,
    accept() { panel.querySelector('[data-measurement-accept]').handlers.click(); },
    decline() { panel.querySelector('[data-measurement-decline]').handlers.click(); },
    tags() { return nodes.filter(value => value.tag === 'script' && value.inHead && !value.removed); },
    events() { return JSON.parse(JSON.stringify((window.dataLayer || []).filter(args => args[0] === 'event').map(args => [args[1], args[2]]))); }
  };
}

test('sin ID válido no hay solicitudes a Google, eventos ni controles de medición visibles', () => {
  for (const measurementId of ['', 'G-invalid', 'UA-12345678', 'G-123&other=private']) {
    const app = harness({ id: measurementId });
    assert.equal(app.tags().length, 0);
    assert.equal(app.panel, undefined);
    assert.equal(app.preference.hidden, true);
    assert.equal(app.preference.handlers.click, undefined);
    app.click('https://wa.me/5491165846235?text=private#private');
    assert.deepEqual(app.events(), []);
    assert.equal(app.tags().length, 0);
  }
});

test('con ID válido la medición espera una aceptación explícita', () => {
  const app = harness();
  assert.equal(app.preference.hidden, false);
  assert.equal(app.panel.hidden, false);
  assert.doesNotMatch(source, /showModal|aria-modal/);
  assert.equal(app.tags().length, 0);
  app.click('https://wa.me/5491165846235?text=private');
  assert.deepEqual(app.events(), []);
  app.decline();
  assert.equal(app.stored.get(key), 'declined');
  assert.equal(app.tags().length, 0);
  assert.equal(app.window[`ga-disable-${id}`], true);
});

test('la aceptación carga un solo tag y sanea la visita y los clics a WhatsApp', () => {
  const app = harness();
  app.accept();
  assert.equal(app.stored.get(key), 'accepted');
  assert.equal(app.tags().length, 1);
  assert.equal(app.tags()[0].src, 'https://www.googletagmanager.com/gtag/js?id=' + id);
  const config = app.window.dataLayer.find(args => args[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.cookie_domain, 'none');
  assert.equal(config.cookie_path, '/vitalcoretrainer/blog/');
  assert.equal(config.page_location, base + 'blog/' + slugs[0] + '.html');
  assert.equal(config.page_referrer, 'https://www.google.com/');
  app.click('https://wa.me/5491165846235?text=persona%40example.com#private');
  app.click('https://wa.me/5491165846235', 'footer');
  assert.deepEqual(app.events().map(([name]) => name), ['page_view', 'whatsapp_click', 'whatsapp_click']);
  const [, article] = app.events()[1];
  assert.deepEqual(article, { art_slug: slugs[0], cta_location: 'article', link_url: 'https://wa.me/5491165846235', transport_type: 'beacon' });
  assert.equal(app.events()[2][1].cta_location, 'footer');
  assert.doesNotMatch(JSON.stringify(app.events()), /private|example\.com|%40|\?|#/);
  app.preference.handlers.click();
  app.accept();
  assert.equal(app.tags().length, 1);
});

test('el evento exige el dominio, protocolo y número exactos de WhatsApp', () => {
  const app = harness({ choice: 'accepted' });
  for (const url of ['https://wa.me/other', 'http://wa.me/5491165846235', 'https://wa.me.evil.test/5491165846235', 'https://example.com/?next=https://wa.me/5491165846235', 'mailto:test@example.com']) app.click(url);
  app.click('https://wa.me/5491165846235', 'article', { defaultPrevented: true });
  app.click('https://wa.me/5491165846235', 'article', { button: 1 });
  assert.equal(app.events().length, 1);
});

test('revocar detiene los eventos y elimina las cookies de Analytics', () => {
  const app = harness({ choice: 'accepted' });
  assert.equal(app.tags().length, 1);
  app.preference.handlers.click();
  app.decline();
  assert.equal(app.window[`ga-disable-${id}`], true);
  assert.equal(app.tags().length, 0);
  assert.deepEqual([...app.cookies], [['_ga_OTHER', 'keep'], ['unrelated', 'keep']]);
  assert.equal(app.deletions.length, 2);
  for (const deletion of app.deletions) assert.match(deletion, /path=\/vitalcoretrainer\/blog\/; SameSite=Lax$/);
  assert.equal(app.panel.hidden, true);
  assert.equal(app.preference.focused, true);
  app.click('https://wa.me/5491165846235?text=private');
  assert.deepEqual(app.events(), []);
  app.preference.handlers.click();
  app.accept();
  assert.equal(app.window[`ga-disable-${id}`], false);
  assert.equal(app.tags().length, 1);
  assert.equal(app.events().length, 1);
});

test('se respetan preferencias guardadas y el bloqueo de localStorage no activa Analytics', () => {
  const rejected = harness({ choice: 'declined' });
  assert.equal(rejected.panel.hidden, true);
  assert.equal(rejected.tags().length, 0);
  const blocked = harness({ storageBlocked: true });
  assert.equal(blocked.tags().length, 0);
  blocked.decline();
  assert.deepEqual(blocked.events(), []);
});

test('la medición se limita a los cinco artículos y excluye el portal y otras páginas', () => {
  for (const file of ['alumnos.html', 'admin.html', 'index.html', 'entrenamiento-online.html', 'blog/index.html', 'blog/otro.html', 'exercises-dataset/index.html']) {
    const app = harness({ url: base + file, choice: 'accepted' });
    assert.equal(app.tags().length, 0, file);
    assert.equal(app.panel, undefined, file);
    assert.deepEqual(app.events(), []);
  }
  for (const slug of slugs) {
    const file = 'blog/' + slug + '.html';
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /<script defer src="\.\.\/assets\/measurement-config\.js"><\/script>\s*<script defer src="\.\.\/assets\/measurement\.js"><\/script>/);
    assert.match(html, /data-measurement-preferences/);
    assert.match(html, /<button hidden type="button" data-measurement-preferences/);
    assert.match(html, /href="\.\.\/privacidad\.html"/);
    const app = harness({ url: base + file, choice: 'accepted' });
    assert.equal(app.tags().length, 1);
    assert.equal(app.events()[0][1].page_title, html.match(/<title>(.*?)<\/title>/)[1]);
  }
  const config = fs.readFileSync(path.join(root, 'assets/measurement-config.js'), 'utf8');
  const context = { window: {} };
  vm.runInNewContext(config, context);
  assert.ok(context.window.VITALCORE_MEASUREMENT.measurementId === '' || /^G-[A-Z0-9]{6,20}$/.test(context.window.VITALCORE_MEASUREMENT.measurementId));
});
