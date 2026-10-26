-- Super Lista: listas compartidas. Pegar entero en Supabase → SQL Editor → Run.
create table if not exists public.listas (
  id uuid primary key,
  datos jsonb not null,
  rev bigint not null default 1,
  actualizado timestamptz not null default now()
);
-- Cuándo se creó cada lista (las que ya había toman la fecha de su último cambio).
alter table public.listas add column if not exists creado timestamptz;
update public.listas set creado = actualizado where creado is null;
alter table public.listas alter column creado set default now();
create index if not exists listas_creado on public.listas (creado);
-- Sin políticas: nadie puede leer ni recorrer la tabla directamente.
-- Solo se entra con las dos funciones de abajo, y hay que saber el código (uuid) de la lista.
alter table public.listas enable row level security;
revoke all on table public.listas from anon, authenticated;

create or replace function public.leer_lista(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('datos', datos, 'rev', rev) from public.listas where id = p_id;
$$;

-- Guarda solo si nadie ha guardado entre medias (rev); si no, devuelve lo último para juntarlo.
-- Límites para que nadie pueda llenar la base de datos gratuita (se puede usar sin cuenta):
--   · cada lista, como mucho 500 KB (una lista de 500 productos ocupa unos 250 KB);
--   · entre todos, como mucho 300 listas nuevas por hora;
--   · si las listas ya ocupan 200 MB, no se crean más ni se hacen más grandes (las que hay se siguen usando).
create or replace function public.guardar_lista(p_id uuid, p_datos jsonb, p_rev bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.listas; n int := octet_length(p_datos::text); antes int;
begin
  if jsonb_typeof(p_datos) <> 'object' then raise exception 'Lista no válida.' using errcode = 'P0001'; end if;
  if n > 500000 then raise exception 'La lista es demasiado grande para compartirla. Quita algunos productos.' using errcode = 'P0001'; end if;
  select octet_length(datos::text) into antes from public.listas where id = p_id;
  if antes is null and (select count(*) from public.listas where creado > now() - interval '1 hour') >= 300 then
    raise exception 'Ahora mismo no se pueden compartir más listas. Prueba dentro de un rato.' using errcode = 'P0001';
  end if;
  if n > coalesce(antes, 0) and pg_total_relation_size('public.listas') > 200 * 1024 * 1024 then
    raise exception 'No queda sitio para compartir más listas.' using errcode = 'P0001';
  end if;
  insert into public.listas as l (id, datos, rev) values (p_id, p_datos, 1)
  on conflict (id) do update set datos = excluded.datos, rev = l.rev + 1, actualizado = now()
    where l.rev = p_rev
  returning * into r;
  if r.id is null then
    select * into r from public.listas where id = p_id;
    return jsonb_build_object('ok', false, 'datos', r.datos, 'rev', r.rev);
  end if;
  return jsonb_build_object('ok', true, 'rev', r.rev);
end $$;

revoke all on function public.leer_lista(uuid) from public;
revoke all on function public.guardar_lista(uuid, jsonb, bigint) from public;
grant execute on function public.leer_lista(uuid) to anon, authenticated;
grant execute on function public.guardar_lista(uuid, jsonb, bigint) to anon, authenticated;
