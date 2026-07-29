begin;

-- Cada atleta queda vinculado a una identidad real de Supabase Auth.
alter table public.usuarios_alumnos
    add column if not exists auth_user_id uuid;

create unique index if not exists usuarios_alumnos_auth_user_id_uidx
    on public.usuarios_alumnos(auth_user_id);

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'usuarios_alumnos_auth_user_id_fkey'
           and conrelid = 'public.usuarios_alumnos'::regclass
    ) then
        alter table public.usuarios_alumnos
            add constraint usuarios_alumnos_auth_user_id_fkey
            foreign key (auth_user_id)
            references auth.users(id)
            on delete set null;
    end if;
end;
$$;

-- Los roles administrativos se gestionan exclusivamente desde SQL.
create table if not exists public.user_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('admin')),
    created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

drop policy if exists "users_read_own_role" on public.user_roles;
create policy "users_read_own_role"
    on public.user_roles
    for select
    to authenticated
    using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.user_roles
        where user_id = auth.uid()
          and role = 'admin'
    );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Al crear una identidad, la enlaza automáticamente si el entrenador ya
-- registró ese correo en usuarios_alumnos.
create or replace function public.link_student_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.usuarios_alumnos
       set auth_user_id = new.id
     where auth_user_id is null
       and lower(email) = lower(new.email);
    return new;
end;
$$;

drop trigger if exists link_student_after_signup on auth.users;
drop trigger if exists link_student_after_email_change on auth.users;
create trigger link_student_after_signup
    after insert on auth.users
    for each row execute function public.link_student_on_signup();
create trigger link_student_after_email_change
    after update of email on auth.users
    for each row execute function public.link_student_on_signup();

-- También cubre el caso inverso: el atleta inició Auth antes de que el
-- entrenador lo registrara en la tabla de alumnos.
create or replace function public.link_existing_auth_user_to_student()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.auth_user_id is null then
        select usuario.id
          into new.auth_user_id
          from auth.users usuario
         where lower(usuario.email) = lower(new.email)
         limit 1;
    end if;
    return new;
end;
$$;

drop trigger if exists link_auth_user_before_student_insert
    on public.usuarios_alumnos;
drop trigger if exists link_auth_user_before_student_email_change
    on public.usuarios_alumnos;
create trigger link_auth_user_before_student_insert
    before insert on public.usuarios_alumnos
    for each row execute function public.link_existing_auth_user_to_student();
create trigger link_auth_user_before_student_email_change
    before update of email on public.usuarios_alumnos
    for each row execute function public.link_existing_auth_user_to_student();

-- Vincula identidades que ya existían antes de aplicar la migración.
update public.usuarios_alumnos alumno
   set auth_user_id = usuario.id
  from auth.users usuario
 where alumno.auth_user_id is null
   and lower(alumno.email) = lower(usuario.email);

alter table public.usuarios_alumnos enable row level security;
alter table public.rutinas_asignadas enable row level security;
alter table public.registros_cargas enable row level security;

-- Quita cualquier política anterior, incluso si tenía otro nombre. En PostgreSQL
-- las políticas permisivas se combinan con OR, por lo que dejar una política
-- pública antigua anularía las restricciones nuevas.
do $$
declare
    policy_record record;
begin
    for policy_record in
        select schemaname, tablename, policyname
          from pg_policies
         where schemaname = 'public'
           and tablename in (
               'usuarios_alumnos',
               'rutinas_asignadas',
               'registros_cargas'
           )
    loop
        execute format(
            'drop policy %I on %I.%I',
            policy_record.policyname,
            policy_record.schemaname,
            policy_record.tablename
        );
    end loop;
end;
$$;

create policy "alumnos_select"
    on public.usuarios_alumnos
    for select
    to authenticated
    using (auth_user_id = auth.uid() or public.is_admin());

create policy "alumnos_insert"
    on public.usuarios_alumnos
    for insert
    to authenticated
    with check (public.is_admin());

create policy "alumnos_update"
    on public.usuarios_alumnos
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "alumnos_delete"
    on public.usuarios_alumnos
    for delete
    to authenticated
    using (public.is_admin());

create policy "rutinas_select"
    on public.rutinas_asignadas
    for select
    to authenticated
    using (
        public.is_admin()
        or exists (
            select 1
            from public.usuarios_alumnos alumno
            where alumno.id = rutinas_asignadas.alumno_id
              and alumno.auth_user_id = auth.uid()
        )
    );

create policy "rutinas_insert"
    on public.rutinas_asignadas
    for insert
    to authenticated
    with check (public.is_admin());

create policy "rutinas_update"
    on public.rutinas_asignadas
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "rutinas_delete"
    on public.rutinas_asignadas
    for delete
    to authenticated
    using (public.is_admin());

create policy "cargas_select"
    on public.registros_cargas
    for select
    to authenticated
    using (
        public.is_admin()
        or exists (
            select 1
            from public.usuarios_alumnos alumno
            where alumno.id = registros_cargas.alumno_id
              and alumno.auth_user_id = auth.uid()
        )
    );

create policy "cargas_insert"
    on public.registros_cargas
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.usuarios_alumnos alumno
            where alumno.id = registros_cargas.alumno_id
              and alumno.auth_user_id = auth.uid()
        )
    );

create policy "cargas_update"
    on public.registros_cargas
    for update
    to authenticated
    using (
        public.is_admin()
        or exists (
            select 1
            from public.usuarios_alumnos alumno
            where alumno.id = registros_cargas.alumno_id
              and alumno.auth_user_id = auth.uid()
        )
    )
    with check (
        public.is_admin()
        or exists (
            select 1
            from public.usuarios_alumnos alumno
            where alumno.id = registros_cargas.alumno_id
              and alumno.auth_user_id = auth.uid()
        )
    );

create policy "cargas_delete"
    on public.registros_cargas
    for delete
    to authenticated
    using (
        public.is_admin()
        or exists (
            select 1
            from public.usuarios_alumnos alumno
            where alumno.id = registros_cargas.alumno_id
              and alumno.auth_user_id = auth.uid()
        )
    );

-- Una función RPC mantiene el borrado completo dentro de una sola transacción.
create or replace function public.delete_student_cascade(target_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Acceso denegado';
    end if;

    delete from public.registros_cargas where alumno_id = target_student_id;
    delete from public.rutinas_asignadas where alumno_id = target_student_id;
    delete from public.usuarios_alumnos where id = target_student_id;

    if not found then
        raise exception 'El atleta no existe';
    end if;
end;
$$;

revoke all on function public.delete_student_cascade(uuid) from public;
grant execute on function public.delete_student_cascade(uuid) to authenticated;

commit;
