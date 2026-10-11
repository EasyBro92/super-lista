-- Super Lista: listas compartidas. Pegar entero en Supabase → SQL Editor → Run.
create table if not exists public.listas (
  id uuid primary key,
  datos jsonb not null,
  rev bigint not null default 1,
  actualizado timestamptz not null default now()
);
-- Sin políticas: nadie puede leer ni recorrer la tabla directamente.
-- Solo se entra con las dos funciones de abajo, y hay que saber el código (uuid) de la lista.
alter table public.listas enable row level security;
revoke all on table public.listas from anon, authenticated;

create or replace function public.leer_lista(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('datos', datos, 'rev', rev) from public.listas where id = p_id;
$$;

-- Guarda solo si nadie ha guardado entre medias (rev); si no, devuelve lo último para juntarlo.
create or replace function public.guardar_lista(p_id uuid, p_datos jsonb, p_rev bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r public.listas;
begin
  if octet_length(p_datos::text) > 1000000 then raise exception 'lista demasiado grande'; end if;
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
