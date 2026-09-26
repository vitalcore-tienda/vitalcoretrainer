# SEO técnico

Origen público: https://vitalcore-tienda.github.io/vitalcoretrainer/

La portada, la biblioteca y entrenamiento-online.html son públicas y están en sitemap.xml. Alumnos,
administración y la plantilla operativa llevan noindex y quedan fuera del sitemap.
Noindex no sustituye autenticación ni permisos de datos.

Enviar https://vitalcore-tienda.github.io/vitalcoretrainer/sitemap.xml en Search
Console y solicitar inspección de la portada. La indexación no es instantánea.

Este repositorio se publica en una subruta de GitHub Pages: un robots.txt aquí
no controla el rastreo. Si se administra el sitio raíz vitalcore-tienda.github.io,
se puede añadir allí la línea Sitemap con la URL anterior. No bloquear las
páginas noindex: el rastreador debe poder leer esa etiqueta.

## CSS

Instalar dependencias con pnpm install --frozen-lockfile. Tras cambiar clases en
los HTML ejecutar pnpm run build:css y guardar assets/trainer.css en Git.
Las clases deben aparecer completas en el HTML/JavaScript para que Tailwind las
detecte. Los estilos inline propios de cada página se conservan.

Ejecutar pnpm run test:seo. La suite histórica de seguridad es independiente:
incluye los flujos de acceso y recuperación de contraseña de Supabase Auth.

Al agregar páginas públicas, actualizar sitemap.xml, canonical y metadatos.
Los metadatos sociales usan la imagen existente de la marca VitalCore.

## Entrenamiento online

La página del servicio describe la revisión mensual de rutinas, el seguimiento
por WhatsApp y la revisión de cargas confirmados por el entrenador. Los precios
se consultan para evitar duplicar importes que se actualizan. Se enlaza desde
la portada y contiene metadatos sociales, Service y BreadcrumbList.
