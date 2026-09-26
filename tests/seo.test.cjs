const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const base = 'https://vitalcore-tienda.github.io/vitalcoretrainer/';
const blogPages = ['blog/index.html','blog/primera-consulta-personal-trainer.html'];
const publicPages = ['index.html','exercises-dataset/index.html','entrenamiento-online.html',...blogPages];
test('sitemap y canonical incluyen solamente páginas públicas del proyecto', () => {
 const urls = [...read('sitemap.xml').matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>m[1]);
 assert.deepEqual(urls, publicPages.map(file=>base+(file==='index.html'?'':file)));
 for(const file of publicPages) {
  const html = read(file);
  assert.equal((html.match(/rel="canonical"/g)||[]).length,1);
  assert.ok(html.includes(`href="${base+(file==='index.html'?'':file)}"`));
  assert.match(html, /name="robots" content="index, follow"/);
  for (const property of ['og:title','og:description','og:url','og:image']) assert.ok(html.includes(`property="${property}"`));
 }
});
test('accesos y plantilla operativa llevan noindex, sin bloqueo de rastreo', () => {
 for(const file of ['alumnos.html','admin.html','plantilla_fuerza_vitalcore.html']) {
  assert.match(read(file),/name="robots" content="noindex, follow"/);
  assert.ok(!read('sitemap.xml').includes(file));
 }
});
test('los enlaces locales del blog apuntan a páginas y secciones existentes', () => {
 for(const file of blogPages) {
  for(const match of read(file).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
   const href = match[1].replace(/&amp;/g,'&');
   const url = new URL(href,base+file);
   if(!url.href.startsWith(base)) continue;
   let destination = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));
   if(!destination || destination.endsWith('/')) destination += 'index.html';
   assert.ok(fs.existsSync(path.join(root,destination)),`${file}: ${href}`);
   if(url.hash) {
    const ids = [...read(destination).matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1]);
    assert.ok(ids.includes(decodeURIComponent(url.hash.slice(1))),`${file}: ${href}`);
   }
  }
 }
});
test('las páginas Tailwind usan CSS local y conservan estilos dinámicos', () => {
 for(const file of [...publicPages,'alumnos.html','admin.html']) {
  const html = read(file);
  assert.doesNotMatch(html,/cdn\.tailwindcss\.com|tailwind\.config/);
  const cssPath = html.match(/rel="stylesheet" href="([^"]+)"/)[1];
  assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),cssPath)));
 }
 const css = read('assets/trainer.css');
 for(const selector of ['.hidden','.bg-brand-500','.text-red-400','.line-through']) assert.ok(css.includes(selector),selector);
 assert.ok(fs.existsSync(path.join(root,'assets/vitalcore.jpg')));
});
