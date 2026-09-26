const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const htmlFiles = [
  "index.html",
  "entrenamiento-online.html",
  "blog/index.html",
  "blog/primera-consulta-personal-trainer.html",
  "alumnos.html",
  "admin.html",
  "plantilla_fuerza_vitalcore.html",
  "exercises-dataset/index.html",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("todos los scripts inline tienen sintaxis válida", () => {
  for (const file of htmlFiles) {
    const source = read(file);
    const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    scripts.forEach((match, index) => {
      assert.doesNotThrow(
        () => /type=["']application\/ld\+json["']/i.test(match[1])
          ? JSON.parse(match[2])
          : new vm.Script(match[2], { filename: `${file}#script-${index + 1}` }),
      );
    });
  }
});

test("el acceso no depende de PIN ni de identidades en localStorage", () => {
  const admin = read("admin.html");
  const athlete = read("alumnos.html");

  assert.doesNotMatch(admin, /CLAVE_ADMIN_MASTER|vitalcoreadmin|admin-pin/);
  assert.doesNotMatch(athlete, /vitalcore_logged_in_user/);
  assert.match(admin, /signInWithPassword/);
  assert.match(athlete, /signInWithOtp/);
  assert.match(athlete, /\.eq\('auth_user_id', session\.user\.id\)/);
});

test("la migración habilita RLS y el borrado transaccional", () => {
  const migration = read(
    "supabase/migrations/20260728_secure_auth_and_rls.sql",
  );

  assert.match(migration, /enable row level security/gi);
  assert.match(migration, /create or replace function public\.is_admin/);
  assert.match(migration, /create or replace function public\.delete_student_cascade/);
  assert.match(migration, /auth\.uid\(\)/);
});

test("no quedan clases Tailwind inexistentes conocidas", () => {
  for (const file of htmlFiles) {
    assert.doesNotMatch(read(file), /zinc-(?:750|850)|scale-(?:98|102)/);
  }
});

test("las dependencias CDN críticas están fijadas a una versión", () => {
  for (const file of ["index.html", "alumnos.html", "admin.html", "exercises-dataset/index.html"]) {
    const source = read(file);
    assert.doesNotMatch(source, /lucide@latest|supabase-js@2(?:["/])/);
    assert.doesNotMatch(source, /src="https:\/\/cdn\.tailwindcss\.com"/);
  }
});

test("los documentos no contienen IDs HTML duplicados", () => {
  for (const file of htmlFiles) {
    const ids = [...read(file).matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(
      (match) => match[1],
    );
    assert.equal(new Set(ids).size, ids.length, `${file} contiene IDs duplicados`);
  }
});
