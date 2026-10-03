(() => {
  'use strict';

  const articles = {
    'primera-consulta-personal-trainer': 'Primera consulta con un personal trainer | VitalCore',
    'cada-cuanto-cambiar-rutina': '¿Cada cuánto cambiar la rutina del gimnasio? | VitalCore',
    'como-registrar-cargas-entrenamiento': 'Cómo registrar tus cargas de entrenamiento | VitalCore',
    'maquinas-o-pesos-libres': 'Máquinas o pesos libres: cómo elegir | VitalCore',
    'fuerza-e-hipertrofia': 'Fuerza e hipertrofia: diferencias y objetivos | VitalCore'
  };
  const match = window.location.pathname.match(/^\/(?:vitalcoretrainer\/)?blog\/([a-z-]+)\.html$/);
  if (!match || !Object.hasOwn(articles, match[1])) return;

  const slug = match[1];
  const canonical = `https://vitalcore-tienda.github.io/vitalcoretrainer/blog/${slug}.html`;
  const whatsapp = 'https://wa.me/5491165846235';
  const key = 'vitalcore_measurement_choice_v1';
  const id = window.VITALCORE_MEASUREMENT?.measurementId;
  const configured = typeof id === 'string' && /^G-[A-Z0-9]{6,20}$/.test(id);
  // Sin una propiedad aprobada no hay medición ni controles sin función.
  if (!configured) return;
  const cookiePath = window.location.pathname.startsWith('/vitalcoretrainer/') ? '/vitalcoretrainer/blog/' : '/blog/';
  let choice = null;
  let started = false;
  let script;
  let preferenceButton;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === 'accepted' || saved === 'declined') choice = saved;
  } catch (_) { /* La elección funciona también sin almacenamiento disponible. */ }

  function referrerOrigin() {
    try {
      const url = new URL(document.referrer);
      return /^https?:$/.test(url.protocol) ? url.origin + '/' : '';
    } catch (_) { return ''; }
  }

  function gtag() {
    window.dataLayer.push(arguments);
  }

  function start() {
    if (!configured || choice !== 'accepted' || started) return;
    started = true;
    window[`ga-disable-${id}`] = false;
    window.dataLayer = window.dataLayer || [];
    gtag('js', new Date());
    gtag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_domain: 'none',
      cookie_path: cookiePath,
      page_location: canonical,
      page_title: articles[slug],
      page_referrer: referrerOrigin()
    });
    gtag('event', 'page_view', {
      page_location: canonical,
      page_title: articles[slug],
      page_referrer: referrerOrigin(),
      art_slug: slug
    });
    script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
    script.id = 'vitalcore-measurement-tag';
    document.head.append(script);
  }

  function clearCookies() {
    for (const item of document.cookie.split(';')) {
      const name = item.trim().split('=')[0];
      if (name !== '_ga' && name !== '_ga_' + id.slice(2)) continue;
      document.cookie = `${name}=; Max-Age=0; path=${cookiePath}; SameSite=Lax`;
    }
  }

  function choose(value) {
    choice = value;
    try { window.localStorage.setItem(key, value); } catch (_) { /* Preferencia en memoria. */ }
    if (value === 'accepted') start();
    else {
      if (configured) window[`ga-disable-${id}`] = true;
      script?.remove();
      if (window.dataLayer) window.dataLayer.length = 0;
      started = false;
      clearCookies();
    }
    panel.hidden = true;
    preferenceButton?.focus();
  }

  const style = document.createElement('style');
  style.textContent = '.vc-measurement{box-sizing:border-box;position:fixed;bottom:1rem;right:1rem;z-index:50;max-width:32rem;width:calc(100% - 2rem);max-height:80vh;overflow:auto;padding:1.5rem;border:1px solid #3f3f46;border-radius:1rem;background:#18181b;color:#f4f4f5;font:inherit;box-shadow:0 1rem 3rem rgba(0,0,0,.35)}.vc-measurement[hidden]{display:none}.vc-measurement h2{font-size:1.35rem;font-weight:700;margin:0 0 .75rem}.vc-measurement p{line-height:1.65;margin:.75rem 0}.vc-measurement a{text-decoration:underline;color:#22c55e}.vc-measurement-actions{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.25rem}.vc-measurement button{border:1px solid #71717a;border-radius:.65rem;padding:.75rem 1rem;cursor:pointer;font:inherit}.vc-measurement button[data-measurement-accept]{background:#22c55e;color:#09090b;font-weight:700;border-color:#22c55e}.vc-measurement button:focus-visible,.vc-measurement a:focus-visible{outline:2px solid #22c55e;outline-offset:3px}';
  document.head.append(style);
  const panel = document.createElement('aside');
  panel.className = 'vc-measurement';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'measurement-heading');
  panel.innerHTML = '<h2 id="measurement-heading" tabindex="-1">Preferencias de medición</h2><p>Podés permitir que usemos Google Analytics para medir visitas y clics a WhatsApp en estos cinco artículos. No enviamos a Analytics el texto del mensaje ni los datos del área de alumnos.</p><p>Podés seguir leyendo y usar WhatsApp sin aceptar. Consultá la <a href="../privacidad.html">información de privacidad</a> y cambiá tu elección desde el pie de página.</p><div class="vc-measurement-actions"><button type="button" data-measurement-decline>Seguir sin medición</button><button type="button" data-measurement-accept>Aceptar medición</button></div>';
  document.body.append(panel);
  const accept = panel.querySelector('[data-measurement-accept]');
  accept.addEventListener('click', () => choose('accepted'));
  panel.querySelector('[data-measurement-decline]').addEventListener('click', () => choose('declined'));
  document.querySelectorAll('[data-measurement-preferences]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      preferenceButton = button;
      panel.hidden = false;
      panel.querySelector('h2').focus();
    });
  });

  document.addEventListener('click', event => {
    if (!configured || choice !== 'accepted' || !started) return;
    if (event.defaultPrevented || (event.button !== undefined && event.button !== 0)) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    let url;
    try { url = new URL(link.href, window.location.href); } catch (_) { return; }
    if (url.origin !== 'https://wa.me' || url.pathname !== '/5491165846235') return;
    gtag('event', 'whatsapp_click', {
      art_slug: slug,
      cta_location: link.closest('footer') ? 'footer' : link.closest('article') ? 'article' : 'other',
      link_url: whatsapp,
      transport_type: 'beacon'
    });
  });

  if (choice === 'accepted') start();
  if (choice === null) panel.hidden = false;
})();
