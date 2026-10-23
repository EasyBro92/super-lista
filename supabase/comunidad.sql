-- Super Lista: cuentas y comunidad (recetas de la gente, valoraciones, comentarios, charla, fotos y denuncias).
-- Pegar entero en Supabase → SQL Editor → Run. Se puede volver a ejecutar sin perder nada.
--
-- Las tablas no se pueden leer ni tocar directamente: todo pasa por las funciones «com_…» de abajo,
-- que comprueban quién eres, que no estás bloqueado, el tamaño de lo que mandas y cuántas cosas has publicado en la última hora.
-- Hilos de comentarios: «r:Nombre de receta» (recetas de la app), «c:<id>» (recetas de la comunidad) y «charla» (la charla general).

create extension if not exists pgcrypto;

-- ---------- Tablas ----------
create table if not exists public.perfiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 30),
  bloqueado boolean not null default false,
  creado timestamptz not null default now()
);
create unique index if not exists perfiles_nombre on public.perfiles (lower(nombre));

-- Quien está aquí puede ocultar, borrar y bloquear. Para hacerte moderador, mira el final del archivo.
create table if not exists public.moderadores (
  id uuid primary key references auth.users on delete cascade
);

create table if not exists public.recetas_com (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null references auth.users on delete cascade,
  datos jsonb not null,
  foto text,
  creado timestamptz not null default now(),
  editado timestamptz not null default now(),
  oculto boolean not null default false
);
create index if not exists recetas_com_creado on public.recetas_com (creado desc);

create table if not exists public.valoraciones (
  receta text not null,
  autor uuid not null references auth.users on delete cascade,
  estrellas smallint not null check (estrellas between 1 and 5),
  creado timestamptz not null default now(),
  primary key (receta, autor)
);

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  hilo text not null,
  autor uuid not null references auth.users on delete cascade,
  texto text not null check (char_length(texto) <= 1000),
  foto text,
  creado timestamptz not null default now(),
  oculto boolean not null default false
);
create index if not exists comentarios_hilo on public.comentarios (hilo, creado desc);
create index if not exists comentarios_autor on public.comentarios (autor, creado desc);

create table if not exists public.denuncias (
  tipo text not null check (tipo in ('receta', 'comentario')),
  objeto uuid not null,
  autor uuid not null references auth.users on delete cascade,
  motivo text not null default '' check (char_length(motivo) <= 200),
  creado timestamptz not null default now(),
  revisada boolean not null default false,
  primary key (tipo, objeto, autor)
);

alter table public.perfiles enable row level security;
alter table public.moderadores enable row level security;
alter table public.recetas_com enable row level security;
alter table public.valoraciones enable row level security;
alter table public.comentarios enable row level security;
alter table public.denuncias enable row level security;
revoke all on table public.perfiles, public.moderadores, public.recetas_com, public.valoraciones, public.comentarios, public.denuncias from anon, authenticated;

-- ---------- Ayudas internas ----------
create or replace function public.com_es_mod() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.moderadores where id = auth.uid());
$$;

-- Para las normas de las fotos: ¿tienes cuenta y no estás bloqueado?
create or replace function public.com_puede_subir() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not exists (select 1 from public.perfiles where id = auth.uid() and bloqueado);
$$;

-- Devuelve tu id si puedes publicar; si no, un error que la app enseña tal cual.
create or replace function public.com_quien() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); p public.perfiles;
begin
  if u is null then raise exception 'Tienes que entrar en tu cuenta.' using errcode = 'P0001'; end if;
  select * into p from public.perfiles where id = u;
  if p.id is null then raise exception 'Elige primero tu nombre en la comunidad.' using errcode = 'P0001'; end if;
  if p.bloqueado then raise exception 'Tu cuenta está bloqueada por incumplir las normas.' using errcode = 'P0001'; end if;
  return u;
end $$;

create or replace function public.com_hilo_ok(h text) returns boolean
language sql immutable as $$
  select h = 'charla' or h ~ '^r:.{1,80}$' or h ~ '^c:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
$$;

-- Las fotos se guardan como «<tu id>/<nombre>.jpg» dentro del cajón «fotos».
create or replace function public.com_foto_ok(f text, u uuid) returns boolean
language sql immutable as $$
  select f is null or f ~ ('^' || u::text || '/[A-Za-z0-9_-]{1,60}\.(jpg|jpeg|png|webp)$');
$$;

-- ---------- Tu cuenta ----------
create or replace function public.com_yo() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'id', auth.uid(),
    'nombre', (select nombre from public.perfiles where id = auth.uid()),
    'bloqueado', coalesce((select bloqueado from public.perfiles where id = auth.uid()), false),
    'moderador', public.com_es_mod()) end;
$$;

create or replace function public.com_perfil(p_nombre text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
begin
  if u is null then raise exception 'Tienes que entrar en tu cuenta.' using errcode = 'P0001'; end if;
  if char_length(n) < 2 or char_length(n) > 30 then raise exception 'El nombre debe tener entre 2 y 30 letras.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfiles where lower(nombre) = lower(n) and id <> u) then
    raise exception 'Ese nombre ya lo usa otra persona. Prueba con otro.' using errcode = 'P0001';
  end if;
  insert into public.perfiles (id, nombre) values (u, n) on conflict (id) do update set nombre = excluded.nombre;
  return public.com_yo();
end $$;

-- Borra tu cuenta y todo lo que has publicado (las fotos las borra la app antes de llamar aquí).
create or replace function public.com_borrar_cuenta() returns boolean
language plpgsql security definer set search_path = public, auth as $$
declare u uuid := auth.uid();
begin
  if u is null then return false; end if;
  delete from public.comentarios c using public.recetas_com r where r.autor = u and c.hilo = 'c:' || r.id::text;
  delete from public.valoraciones v using public.recetas_com r where r.autor = u and v.receta = 'c:' || r.id::text;
  delete from auth.users where id = u;
  return true;
end $$;

-- ---------- Recetas de la comunidad ----------
-- datos: { n: nombre, e: dibujo, t: minutos, r: raciones, d: dificultad, m: momentos, i: [[ingrediente, cantidad]], p: [pasos] }
create or replace function public.com_publicar(p_datos jsonb, p_foto text default null, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := public.com_quien(); r public.recetas_com; d jsonb;
begin
  if jsonb_typeof(p_datos) <> 'object' or octet_length(p_datos::text) > 30000 then raise exception 'La receta es demasiado larga.' using errcode = 'P0001'; end if;
  if char_length(coalesce(p_datos->>'n', '')) not between 2 and 80 then raise exception 'Ponle un nombre a la receta.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_datos->'i') <> 'array' or jsonb_array_length(p_datos->'i') not between 1 and 60 then raise exception 'Añade entre 1 y 60 ingredientes.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_datos->'p') <> 'array' or jsonb_array_length(p_datos->'p') not between 1 and 40 then raise exception 'Añade entre 1 y 40 pasos.' using errcode = 'P0001'; end if;
  if not public.com_foto_ok(p_foto, u) then raise exception 'Foto no válida.' using errcode = 'P0001'; end if;
  -- Solo se guarda lo que la app usa.
  d := jsonb_strip_nulls(jsonb_build_object('n', p_datos->'n', 'e', p_datos->'e', 't', p_datos->'t', 'r', p_datos->'r', 'd', p_datos->'d',
    'm', p_datos->'m', 'i', p_datos->'i', 'p', p_datos->'p', 'tags', p_datos->'tags'));
  if p_id is not null then
    update public.recetas_com set datos = d, foto = p_foto, editado = now() where id = p_id and autor = u returning * into r;
    if r.id is null then raise exception 'No puedes cambiar esa receta.' using errcode = 'P0001'; end if;
    return r.id;
  end if;
  if (select count(*) from public.recetas_com where autor = u and creado > now() - interval '1 hour') >= 10 then
    raise exception 'Has compartido muchas recetas seguidas. Espera un rato.' using errcode = 'P0001';
  end if;
  insert into public.recetas_com (autor, datos, foto) values (u, d, p_foto) returning * into r;
  return r.id;
end $$;

create or replace function public.com_receta_json(r public.recetas_com) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'datos', r.datos, 'foto', r.foto, 'creado', r.creado, 'oculto', r.oculto,
    'autor', coalesce(p.nombre, 'Alguien'), 'mia', coalesce(r.autor = auth.uid(), false),
    'media', (select round(avg(estrellas)::numeric, 1) from public.valoraciones where receta = 'c:' || r.id::text),
    'votos', (select count(*) from public.valoraciones where receta = 'c:' || r.id::text),
    'comentarios', (select count(*) from public.comentarios where hilo = 'c:' || r.id::text and not oculto))
  from (select 1) x left join public.perfiles p on p.id = r.autor;
$$;

-- p_orden: 'nuevas' (lo último) o 'mejores' (más estrellas); p_desde para ir cargando más.
create or replace function public.com_recetas(p_orden text default 'nuevas', p_desde int default 0, p_buscar text default '') returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.com_receta_json(r) order by x.k), '[]'::jsonb)
  from (
    select r.id, row_number() over (order by case when p_orden = 'mejores' then v.m end desc nulls last,
                                             case when p_orden = 'mejores' then v.c else 0 end desc, r.creado desc) as k
    from public.recetas_com r
    left join lateral (select avg(estrellas) as m, count(*) as c from public.valoraciones where receta = 'c:' || r.id::text) v on true
    where (not r.oculto or r.autor = auth.uid() or public.com_es_mod())
      and (coalesce(p_buscar, '') = '' or r.datos->>'n' ilike '%' || replace(replace(p_buscar, '%', ''), '_', '') || '%'
           or (r.datos->'i')::text ilike '%' || replace(replace(p_buscar, '%', ''), '_', '') || '%')
    order by k offset greatest(p_desde, 0) limit 30
  ) x join public.recetas_com r on r.id = x.id;
$$;

create or replace function public.com_receta(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.com_receta_json(r) from public.recetas_com r
  where r.id = p_id and (not r.oculto or r.autor = auth.uid() or public.com_es_mod());
$$;

-- ---------- Valoraciones ----------
-- 1 a 5 estrellas; 0 quita tu voto.
create or replace function public.com_valorar(p_receta text, p_estrellas int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public.com_quien();
begin
  if not public.com_hilo_ok(p_receta) or p_receta = 'charla' then raise exception 'Receta no válida.' using errcode = 'P0001'; end if;
  if p_receta like 'c:%' and exists (select 1 from public.recetas_com where id = substr(p_receta, 3)::uuid and autor = u) then
    raise exception 'No puedes valorar tu propia receta.' using errcode = 'P0001';
  end if;
  if coalesce(p_estrellas, 0) = 0 then delete from public.valoraciones where receta = p_receta and autor = u;
  elsif p_estrellas between 1 and 5 then
    insert into public.valoraciones (receta, autor, estrellas) values (p_receta, u, p_estrellas)
    on conflict (receta, autor) do update set estrellas = excluded.estrellas, creado = now();
  else raise exception 'De 1 a 5 estrellas.' using errcode = 'P0001'; end if;
  return public.com_notas(array[p_receta])->p_receta;
end $$;

-- { "r:Tortilla de patatas": { m: 4.5, v: 12, mia: 5, c: 3 }, … } (c = comentarios)
create or replace function public.com_notas(p_recetas text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object(
      'm', (select round(avg(estrellas)::numeric, 1) from public.valoraciones where receta = k),
      'v', (select count(*) from public.valoraciones where receta = k),
      'mia', (select estrellas from public.valoraciones where receta = k and autor = auth.uid()),
      'c', (select count(*) from public.comentarios where hilo = k and not oculto))), '{}'::jsonb)
  from unnest(p_recetas[1:200]) k;
$$;

-- ---------- Comentarios y charla ----------
create or replace function public.com_comentario_json(c public.comentarios) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'hilo', c.hilo, 'texto', c.texto, 'foto', c.foto, 'creado', c.creado, 'oculto', c.oculto,
    'autor', coalesce((select nombre from public.perfiles where id = c.autor), 'Alguien'), 'mio', coalesce(c.autor = auth.uid(), false));
$$;

create or replace function public.com_comentar(p_hilo text, p_texto text, p_foto text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := public.com_quien(); t text := btrim(coalesce(p_texto, '')); c public.comentarios;
begin
  if not public.com_hilo_ok(p_hilo) then raise exception 'Conversación no válida.' using errcode = 'P0001'; end if;
  if t = '' and p_foto is null then raise exception 'Escribe algo.' using errcode = 'P0001'; end if;
  if char_length(t) > 1000 then raise exception 'Máximo 1000 letras.' using errcode = 'P0001'; end if;
  if not public.com_foto_ok(p_foto, u) then raise exception 'Foto no válida.' using errcode = 'P0001'; end if;
  if p_hilo like 'c:%' and not exists (select 1 from public.recetas_com where id = substr(p_hilo, 3)::uuid) then
    raise exception 'Esa receta ya no existe.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.comentarios where autor = u and creado > now() - interval '1 hour') >= 40 then
    raise exception 'Has escrito mucho en poco tiempo. Espera un rato.' using errcode = 'P0001';
  end if;
  insert into public.comentarios (hilo, autor, texto, foto) values (p_hilo, u, t, p_foto) returning * into c;
  return public.com_comentario_json(c);
end $$;

-- Los 40 más recientes (o los de antes de p_antes), del más nuevo al más viejo.
create or replace function public.com_comentarios(p_hilo text, p_antes timestamptz default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.com_comentario_json(c) order by c.creado desc), '[]'::jsonb)
  from (select * from public.comentarios c
        where c.hilo = p_hilo and (p_antes is null or c.creado < p_antes)
          and (not c.oculto or c.autor = auth.uid() or public.com_es_mod())
        order by c.creado desc limit 40) c;
$$;

-- Borra lo tuyo (o cualquier cosa si eres moderador). Devuelve la foto para que la app la quite también.
create or replace function public.com_borrar(p_tipo text, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); f text; a uuid;
begin
  if u is null then raise exception 'Tienes que entrar en tu cuenta.' using errcode = 'P0001'; end if;
  if p_tipo = 'receta' then
    delete from public.recetas_com where id = p_id and (autor = u or public.com_es_mod()) returning foto, autor into f, a;
    if a is not null then
      delete from public.comentarios where hilo = 'c:' || p_id::text;
      delete from public.valoraciones where receta = 'c:' || p_id::text;
    end if;
  elsif p_tipo = 'comentario' then
    delete from public.comentarios where id = p_id and (autor = u or public.com_es_mod()) returning foto, autor into f, a;
  end if;
  if a is null then raise exception 'No puedes borrar eso.' using errcode = 'P0001'; end if;
  delete from public.denuncias where tipo = p_tipo and objeto = p_id;
  return jsonb_build_object('foto', f, 'suya', a = u);
end $$;

-- ---------- Denuncias y moderación ----------
-- Con 3 denuncias de personas distintas, se oculta solo hasta que un moderador lo revise.
create or replace function public.com_denunciar(p_tipo text, p_id uuid, p_motivo text default '') returns boolean
language plpgsql security definer set search_path = public as $$
declare u uuid := public.com_quien(); a uuid;
begin
  if p_tipo = 'receta' then select autor into a from public.recetas_com where id = p_id;
  elsif p_tipo = 'comentario' then select autor into a from public.comentarios where id = p_id; end if;
  if a is null then raise exception 'Eso ya no existe.' using errcode = 'P0001'; end if;
  if a = u then raise exception 'No puedes denunciar algo tuyo.' using errcode = 'P0001'; end if;
  insert into public.denuncias (tipo, objeto, autor, motivo) values (p_tipo, p_id, u, left(coalesce(p_motivo, ''), 200))
  on conflict do nothing;
  if (select count(*) from public.denuncias where tipo = p_tipo and objeto = p_id and not revisada) >= 3 then
    if p_tipo = 'receta' then update public.recetas_com set oculto = true where id = p_id;
    else update public.comentarios set oculto = true where id = p_id; end if;
  end if;
  return true;
end $$;

create or replace function public.com_pendientes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.com_es_mod() then raise exception 'Solo para moderadores.' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(x order by x->>'ultima' desc) from (
    select jsonb_build_object('tipo', d.tipo, 'id', d.objeto, 'denuncias', count(*), 'ultima', max(d.creado),
      'motivos', jsonb_agg(distinct d.motivo) filter (where d.motivo <> ''),
      'cosa', case when d.tipo = 'receta' then (select public.com_receta_json(r) from public.recetas_com r where r.id = d.objeto)
                   else (select public.com_comentario_json(c) from public.comentarios c where c.id = d.objeto) end) as x
    from public.denuncias d where not d.revisada group by d.tipo, d.objeto) y where x->'cosa' <> 'null'::jsonb), '[]'::jsonb);
end $$;

-- p_accion: 'mostrar' (estaba bien), 'ocultar', 'bloquear' (oculta todo lo del autor y no le deja publicar más).
-- Para borrar, com_borrar.
create or replace function public.com_moderar(p_tipo text, p_id uuid, p_accion text) returns boolean
language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  if not public.com_es_mod() then raise exception 'Solo para moderadores.' using errcode = 'P0001'; end if;
  if p_tipo = 'receta' then select autor into a from public.recetas_com where id = p_id;
  else select autor into a from public.comentarios where id = p_id; end if;
  if a is null then raise exception 'Eso ya no existe.' using errcode = 'P0001'; end if;
  if p_accion in ('mostrar', 'ocultar') then
    if p_tipo = 'receta' then update public.recetas_com set oculto = (p_accion = 'ocultar') where id = p_id;
    else update public.comentarios set oculto = (p_accion = 'ocultar') where id = p_id; end if;
  elsif p_accion = 'bloquear' then
    if exists (select 1 from public.moderadores where id = a) then raise exception 'No puedes bloquear a un moderador.' using errcode = 'P0001'; end if;
    update public.perfiles set bloqueado = true where id = a;
    update public.recetas_com set oculto = true where autor = a;
    update public.comentarios set oculto = true where autor = a;
  else raise exception 'Acción no válida.' using errcode = 'P0001'; end if;
  update public.denuncias set revisada = true where tipo = p_tipo and objeto = p_id;
  return true;
end $$;

-- ---------- Permisos de las funciones ----------
do $$ declare f text; begin
  foreach f in array array['com_es_mod()', 'com_puede_subir()', 'com_quien()', 'com_hilo_ok(text)', 'com_foto_ok(text, uuid)', 'com_receta_json(public.recetas_com)',
    'com_comentario_json(public.comentarios)', 'com_yo()', 'com_perfil(text)', 'com_borrar_cuenta()', 'com_publicar(jsonb, text, uuid)',
    'com_recetas(text, int, text)', 'com_receta(uuid)', 'com_valorar(text, int)', 'com_notas(text[])', 'com_comentar(text, text, text)',
    'com_comentarios(text, timestamptz)', 'com_borrar(text, uuid)', 'com_denunciar(text, uuid, text)', 'com_pendientes()', 'com_moderar(text, uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  -- Leer: cualquiera, aunque no tenga cuenta.
  foreach f in array array['com_yo()', 'com_recetas(text, int, text)', 'com_receta(uuid)', 'com_notas(text[])', 'com_comentarios(text, timestamptz)'] loop
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
  -- Escribir: solo con cuenta. (com_es_mod y com_puede_subir las usan las normas de las fotos.)
  foreach f in array array['com_es_mod()', 'com_puede_subir()', 'com_perfil(text)', 'com_borrar_cuenta()', 'com_publicar(jsonb, text, uuid)', 'com_valorar(text, int)',
    'com_comentar(text, text, text)', 'com_borrar(text, uuid)', 'com_denunciar(text, uuid, text)', 'com_pendientes()', 'com_moderar(text, uuid, text)'] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- Fotos ----------
-- Cajón público «fotos»: cualquiera las ve; cada persona solo sube y borra en su carpeta (su id). Máximo 2 MB por foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos: subir en tu carpeta" on storage.objects;
drop policy if exists "fotos: ver tu carpeta" on storage.objects;
drop policy if exists "fotos: borrar de tu carpeta" on storage.objects;
create policy "fotos: subir en tu carpeta" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.com_puede_subir()));
create policy "fotos: ver tu carpeta" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.com_es_mod())));
create policy "fotos: borrar de tu carpeta" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and ((storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.com_es_mod())));

-- ---------- Hacerte moderador ----------
-- Cuando ya te hayas creado la cuenta en la app, cambia el correo y ejecuta solo esta línea:
-- insert into public.moderadores select id from auth.users where email = 'tu-correo@ejemplo.com' on conflict do nothing;
