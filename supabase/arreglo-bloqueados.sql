-- Arreglo del 2026-11-28 (pruebas con usuarios de prueba): una cuenta bloqueada ya no puede cambiarse el nombre
-- ni mandar cosas al buzón de otras personas, y nadie puede llamarse como la app («Equipo Super Lista», «Moderador»…).
-- Se puede ejecutar varias veces en Supabase › SQL Editor. Solo cambia estas dos funciones; no borra nada.

create or replace function public.com_perfil(p_nombre text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
begin
  if u is null then raise exception 'Tienes que entrar en tu cuenta.' using errcode = 'P0001'; end if;
  if char_length(n) < 2 or char_length(n) > 30 then raise exception 'El nombre debe tener entre 2 y 30 letras.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfiles where id = u and bloqueado) then raise exception 'Tu cuenta está bloqueada por incumplir las normas.' using errcode = 'P0001'; end if;
  -- Nadie puede hacerse pasar por la app ni por quien la modera.
  if lower(n) ~ '(super ?lista|equipo|soporte|moderador|administrador|\madmin)' and not public.com_es_mod() then raise exception 'Ese nombre no se puede usar. Prueba con otro.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfiles where lower(nombre) = lower(n) and id <> u) then
    raise exception 'Ese nombre ya lo usa otra persona. Prueba con otro.' using errcode = 'P0001';
  end if;
  insert into public.perfiles (id, nombre) values (u, n) on conflict (id) do update set nombre = excluded.nombre;
  return public.com_yo();
end $$;

-- Si todavía no has ejecutado envios.sql, esta parte se puede saltar.
create or replace function public.env_enviar(p_nombre text, p_tipo text, p_datos jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); a uuid; n text;
begin
  if u is null then raise exception 'Entra en tu cuenta para enviar a una persona.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfiles where id = u and bloqueado) then raise exception 'Tu cuenta está bloqueada por incumplir las normas.' using errcode = 'P0001'; end if;
  select id, nombre into a, n from public.perfiles where lower(nombre) = lower(btrim(coalesce(p_nombre, '')));
  if a is null then raise exception 'No hay nadie con ese nombre en la app. Revisa cómo lo ha escrito.' using errcode = 'P0001'; end if;
  perform public.env_comprobar(p_tipo, p_datos);
  insert into public.envios (codigo, tipo, datos, de, para, caduca)
    values ('P' || public.env_letras(23), p_tipo, p_datos, u, a, now() + interval '30 days');
  return n;
end $$;
