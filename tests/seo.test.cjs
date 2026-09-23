const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');
const base = 'https://vitalcore-tienda.github.io/vitalcoretrainer/';
const publicPages = ['index.html','exercises-dataset/index.html'];
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
test('las cuatro páginas Tailwind usan CSS local y conservan estilos dinámicos', () => {
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
