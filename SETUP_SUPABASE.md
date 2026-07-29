# Configuración segura de Supabase

La web ahora usa Supabase Auth y políticas RLS. El `anon key` puede estar en el
navegador; la seguridad depende de aplicar la migración y de no publicar una
`service_role key`.

## 1. Aplicar la migración

Ejecutá el contenido de
`supabase/migrations/20260728_secure_auth_and_rls.sql` en el SQL Editor del
proyecto Supabase. La migración:

- vincula cada atleta con `auth.users`;
- restringe atletas, rutinas y cargas mediante RLS;
- crea el rol `admin`;
- crea un borrado transaccional de atletas.

Antes de ejecutarla en producción, hacé una copia de seguridad de la base.

## 2. Crear la cuenta administradora

1. En Supabase, abrí **Authentication → Users**.
2. Creá el usuario administrador con correo y contraseña.
3. Copiá su UUID.
4. Ejecutá, reemplazando el UUID:

```sql
insert into public.user_roles (user_id, role)
values ('UUID-DEL-ADMIN', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

El panel `admin.html` rechazará cualquier cuenta que no figure en esta tabla.

## 3. Configurar los enlaces de acceso

En **Authentication → URL Configuration**:

- configurá la URL pública del sitio como `Site URL`;
- agregá la URL pública de `index.html` a `Redirect URLs`;
- para desarrollo local, agregá también la URL del servidor local.

Los atletas reciben un enlace de un solo uso. Si el entrenador registró primero
su correo en `usuarios_alumnos`, la migración enlaza automáticamente la nueva
identidad.

## 4. Verificación

```powershell
npm test
```

Probá con una cuenta atleta y otra administradora antes de publicar.
