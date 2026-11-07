-- Super Lista: pasar tus datos o una lista a otro móvil con un código corto, o mandárselos a una persona con cuenta.
-- Pegar entero en Supabase → SQL Editor → Run (se puede volver a ejecutar sin problema).
-- Necesita que antes esté supabase/comunidad.sql (usa la tabla de perfiles para buscar a la persona por su nombre).
create table if not exists public.envios (
  codigo text primary key,          -- 6 letras para escribirlas a mano; los envíos a una persona llevan uno largo
  tipo text not null check (tipo in ('copia', 'lista')),
  datos jsonb not null,
  de uuid references auth.users (id) on delete set null,
  para uuid references auth.users (id) on delete cascade,
  creado timestamptz not null default now(),
  caduca timestamptz not null
);
create index if not exists envios_para on public.envios (para) where para is not null;
create index if not exists envios_creado on public.envios (creado);
-- Sin políticas: nadie puede leer ni recorrer la tabla. Solo se entra con las funciones de abajo.
alter table public.envios enable row level security;
revoke all on table public.envios from anon, authenticated;

-- Límites para que nadie pueda llenar la base de datos gratuita:
--   · cada envío, como mucho 4 MB (una copia con todo y unas cuantas fotos tuyas cabe de sobra);
--   · entre todos, como mucho 300 envíos por hora; cada persona con cuenta, 30 por hora;
--   · si los envíos ya ocupan 150 MB, no se aceptan más hasta que caduquen los viejos.
create or replace function public.env_comprobar(p_tipo text, p_datos jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_tipo not in ('copia', 'lista') or jsonb_typeof(p_datos) <> 'object' then raise exception 'Envío no válido.' using errcode = 'P0001'; end if;
  if octet_length(p_datos::text) > 4000000 then raise exception 'Es demasiado grande para enviarlo.' using errcode = 'P0001'; end if;
  delete from public.envios where caduca < now();
  if (select count(*) from public.envios where creado > now() - interval '1 hour') >= 300 then
    raise exception 'Ahora mismo no se pueden hacer más envíos. Prueba dentro de un rato.' using errcode = 'P0001';
  end if;
  if auth.uid() is not null and (select count(*) from public.envios where de = auth.uid() and creado > now() - interval '1 hour') >= 30 then
    raise exception 'Has enviado muchas cosas seguidas. Espera un rato.' using errcode = 'P0001';
  end if;
  if pg_total_relation_size('public.envios') > 150 * 1024 * 1024 then
    raise exception 'Ahora mismo no queda sitio para envíos. Prueba mañana.' using errcode = 'P0001';
  end if;
end $$;

-- Letras sin las que se confunden (ni 0/O ni 1/I/L).
create or replace function public.env_letras(n int) returns text
language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, n);
$$;

-- Con o sin cuenta: guarda el envío 24 horas y devuelve un código de 6 letras.
create or replace function public.env_crear(p_tipo text, p_datos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  perform public.env_comprobar(p_tipo, p_datos);
  loop
    c := public.env_letras(6);
    begin
      insert into public.envios (codigo, tipo, datos, de, caduca) values (c, p_tipo, p_datos, auth.uid(), now() + interval '24 hours');
      return c;
    exception when unique_violation then -- ese código ya estaba: se prueba otro
    end;
  end loop;
end $$;

-- Recoger con el código (da igual mayúsculas, espacios o guiones). Los envíos a una persona solo los recoge esa persona.
create or replace function public.env_recoger(p_codigo text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('tipo', e.tipo, 'datos', e.datos, 'creado', e.creado, 'de', (select nombre from public.perfiles where id = e.de))
  from public.envios e
  where e.codigo = upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')) and e.caduca > now()
    and (e.para is null or e.para = auth.uid());
$$;

-- Con cuenta: mandar a una persona por su nombre en la app. Le llega a su buzón y dura 30 días.
create or replace function public.env_enviar(p_nombre text, p_tipo text, p_datos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); a uuid; n text;
begin
  if u is null then raise exception 'Entra en tu cuenta para enviar a una persona.' using errcode = 'P0001'; end if;
  select id, nombre into a, n from public.perfiles where lower(nombre) = lower(btrim(coalesce(p_nombre, '')));
  if a is null then raise exception 'No hay nadie con ese nombre en la app. Revisa cómo lo ha escrito.' using errcode = 'P0001'; end if;
  perform public.env_comprobar(p_tipo, p_datos);
  insert into public.envios (codigo, tipo, datos, de, para, caduca)
    values ('P' || public.env_letras(23), p_tipo, p_datos, u, a, now() + interval '30 days');
  return n;
end $$;

-- Con cuenta: lo que te han mandado (sin los datos, que se piden al abrirlo).
create or replace function public.env_buzon() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('codigo', e.codigo, 'tipo', e.tipo, 'creado', e.creado,
      'de', coalesce((select nombre from public.perfiles where id = e.de), 'Alguien'),
      'nombre', e.datos->>'name', 'n', coalesce(jsonb_array_length(case when jsonb_typeof(e.datos->'items') = 'array' then e.datos->'items' end), 0))
    order by e.creado desc), '[]'::jsonb)
  from public.envios e where auth.uid() is not null and e.para = auth.uid() and e.caduca > now();
$$;

-- Con cuenta: quitar del buzón algo que te han mandado (o retirar algo que mandaste tú).
create or replace function public.env_borrar(p_codigo text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  delete from public.envios where codigo = p_codigo and (para = auth.uid() or de = auth.uid());
  return found;
end $$;

revoke all on function public.env_comprobar(text, jsonb), public.env_letras(int) from public, anon, authenticated;
revoke all on function public.env_crear(text, jsonb), public.env_recoger(text) from public;
revoke all on function public.env_enviar(text, text, jsonb), public.env_buzon(), public.env_borrar(text) from public, anon;
grant execute on function public.env_crear(text, jsonb), public.env_recoger(text) to anon, authenticated;
grant execute on function public.env_enviar(text, text, jsonb), public.env_buzon(), public.env_borrar(text) to authenticated;
