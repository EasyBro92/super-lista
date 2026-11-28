-- Super Lista · actualización del 2026-11-28. Pégalo entero en Supabase › SQL Editor y pulsa «Run».
-- 1) Cuentas de IA: marca «IA» y sus estrellas fuera de la media.
-- 2) Arreglo: una cuenta bloqueada ya no puede cambiarse el nombre ni mandar al buzón; nadie puede llamarse como la app.
-- 3) Tres cuentas de IA con 8 recetas y unos consejos para que la Comunidad no esté vacía.
-- Se puede ejecutar varias veces sin problema.

alter table public.perfiles add column if not exists ia boolean not null default false;

create or replace function public.com_ia(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select ia from public.perfiles where id = u), false);
$$;

create or replace function public.com_receta_json(r public.recetas_com) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'datos', r.datos, 'foto', r.foto, 'creado', r.creado, 'oculto', r.oculto,
    'autor', coalesce(p.nombre, 'Alguien'), 'autor_ia', coalesce(p.ia, false), 'mia', coalesce(r.autor = auth.uid(), false),
    'media', (select round(avg(estrellas)::numeric, 1) from public.valoraciones where receta = 'c:' || r.id::text and not public.com_ia(autor)),
    'votos', (select count(*) from public.valoraciones where receta = 'c:' || r.id::text and not public.com_ia(autor)),
    'comentarios', (select count(*) from public.comentarios where hilo = 'c:' || r.id::text and not oculto))
  from (select 1) x left join public.perfiles p on p.id = r.autor;
$$;

create or replace function public.com_recetas(p_orden text default 'nuevas', p_desde int default 0, p_buscar text default '') returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.com_receta_json(r) order by x.k), '[]'::jsonb)
  from (
    select r.id, row_number() over (order by case when p_orden = 'mejores' then v.m end desc nulls last,
                                             case when p_orden = 'mejores' then v.c else 0 end desc, r.creado desc) as k
    from public.recetas_com r
    left join lateral (select avg(estrellas) as m, count(*) as c from public.valoraciones where receta = 'c:' || r.id::text and not public.com_ia(autor)) v on true
    where (not r.oculto or r.autor = auth.uid() or public.com_es_mod())
      and (coalesce(p_buscar, '') = '' or r.datos->>'n' ilike '%' || replace(replace(p_buscar, '%', ''), '_', '') || '%'
           or (r.datos->'i')::text ilike '%' || replace(replace(p_buscar, '%', ''), '_', '') || '%')
    order by k offset greatest(p_desde, 0) limit 30
  ) x join public.recetas_com r on r.id = x.id;
$$;

create or replace function public.com_notas(p_recetas text[]) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(k, jsonb_build_object(
      'm', (select round(avg(estrellas)::numeric, 1) from public.valoraciones where receta = k and not public.com_ia(autor)),
      'v', (select count(*) from public.valoraciones where receta = k and not public.com_ia(autor)),
      'mia', (select estrellas from public.valoraciones where receta = k and autor = auth.uid()),
      'c', (select count(*) from public.comentarios where hilo = k and not oculto))), '{}'::jsonb)
  from unnest(p_recetas[1:200]) k;
$$;

create or replace function public.com_comentario_json(c public.comentarios) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'hilo', c.hilo, 'texto', c.texto, 'foto', c.foto, 'creado', c.creado, 'oculto', c.oculto,
    'autor', coalesce((select nombre from public.perfiles where id = c.autor), 'Alguien'), 'autor_ia', public.com_ia(c.autor), 'mio', coalesce(c.autor = auth.uid(), false));
$$;

create or replace function public.com_perfil(p_nombre text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); n text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
begin
  if u is null then raise exception 'Tienes que entrar en tu cuenta.' using errcode = 'P0001'; end if;
  if char_length(n) < 2 or char_length(n) > 30 then raise exception 'El nombre debe tener entre 2 y 30 letras.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfiles where id = u and bloqueado) then raise exception 'Tu cuenta está bloqueada por incumplir las normas.' using errcode = 'P0001'; end if;
  -- Nadie puede hacerse pasar por la app ni por quien la modera.
  if lower(n) ~ '(super ?lista|equipo|soporte|moderador|administrador|\madmin|\mia\M|inteligencia artificial)' and not public.com_es_mod() then raise exception 'Ese nombre no se puede usar. Prueba con otro.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.perfiles where lower(nombre) = lower(n) and id <> u) then
    raise exception 'Ese nombre ya lo usa otra persona. Prueba con otro.' using errcode = 'P0001';
  end if;
  insert into public.perfiles (id, nombre) values (u, n) on conflict (id) do update set nombre = excluded.nombre;
  return public.com_yo();
end $$;

revoke all on function public.com_ia(uuid) from public, anon, authenticated;

-- (Si aún no ejecutaste envios.sql, quita este bloque.)
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

-- Cuentas de IA para que la Comunidad no esté vacía (2026-11-28).
-- Llevan la marca «🤖 IA» en el icono, el nombre, cada receta y cada comentario. No votan, y si votaran sus estrellas no contarían.
-- No pueden entrar en la app (no tienen contraseña). Para quitarlo todo: mira el final del archivo.
-- Se puede ejecutar varias veces: no repite nada.

insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values ('00000000-0000-0000-0000-000000000000', 'a1a00000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lola.ia@superlista.invalid', now(), now()) on conflict (id) do nothing;
insert into public.perfiles (id, nombre, ia) values ('a1a00000-0000-4000-8000-000000000001', 'Lola · IA', true) on conflict (id) do update set ia = true;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values ('00000000-0000-0000-0000-000000000000', 'a1a00000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'marcos.ia@superlista.invalid', now(), now()) on conflict (id) do nothing;
insert into public.perfiles (id, nombre, ia) values ('a1a00000-0000-4000-8000-000000000002', 'Marcos · IA', true) on conflict (id) do update set ia = true;
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at) values ('00000000-0000-0000-0000-000000000000', 'a1a00000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'abril.ia@superlista.invalid', now(), now()) on conflict (id) do nothing;
insert into public.perfiles (id, nombre, ia) values ('a1a00000-0000-4000-8000-000000000003', 'Abril · IA', true) on conflict (id) do update set ia = true;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000001', 'a1a00000-0000-4000-8000-000000000001', '{"n": "Albóndigas en salsa de almendras", "e": "🧆", "t": 50, "r": 4, "d": "Media", "tags": ["Española", "Carne"], "m": {"Comida": []}, "i": [["Carne picada mixta", "500 g"], ["Huevo", "1"], ["Pan rallado", "3 cucharadas"], ["Ajo", "2 dientes"], ["Almendras tostadas", "50 g"], ["Cebolla", "1"], ["Vino blanco", "100 ml"], ["Caldo de pollo", "300 ml"]], "p": ["Mezcla la carne con el huevo, el pan rallado, un ajo picado y sal.", "Forma bolas del tamaño de una nuez y dóralas en una cazuela con aceite. Resérvalas.", "En el mismo aceite pocha la cebolla con el otro ajo.", "Tritura las almendras con un poco de caldo y añádelas con el vino.", "Vuelve a echar las albóndigas, cubre con el caldo y cuece 20 minutos a fuego suave."]}'::jsonb, 'app:albondigas-en-salsa.jpg', now() - interval '136 hours', now() - interval '136 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000002', 'a1a00000-0000-4000-8000-000000000001', '{"n": "Crema de calabaza y zanahoria con jengibre", "e": "🎃", "t": 35, "r": 4, "d": "Fácil", "tags": ["Verduras", "Vegana"], "m": {"Cena": []}, "i": [["Calabaza", "800 g"], ["Zanahorias", "2"], ["Puerro", "1"], ["Jengibre fresco", "1 trocito"], ["Caldo de verduras", "700 ml"], ["Aceite de oliva", "2 cucharadas"]], "p": ["Pocha el puerro en el aceite 5 minutos.", "Añade la calabaza y las zanahorias en trozos y el jengibre pelado.", "Cubre con el caldo y cuece 20 minutos.", "Tritura hasta que quede fina y ajusta de sal."]}'::jsonb, 'app:crema-de-calabaza.jpg', now() - interval '119 hours', now() - interval '119 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000003', 'a1a00000-0000-4000-8000-000000000002', '{"n": "Garbanzos con espinacas en 15 minutos (de bote)", "e": "🥬", "t": 15, "r": 2, "d": "Fácil", "tags": ["Legumbres", "Rápidas"], "m": {"Comida": []}, "i": [["Garbanzos cocidos", "1 bote"], ["Espinacas frescas", "200 g"], ["Ajo", "2 dientes"], ["Pan", "1 rebanada"], ["Comino", "1 pizca"], ["Pimentón", "1 cucharadita"], ["Vinagre", "1 cucharada"]], "p": ["Fríe el pan y los ajos en aceite y tritúralos con el comino, el pimentón y el vinagre.", "Saltea las espinacas hasta que bajen.", "Añade los garbanzos escurridos y el majado con un poco de agua.", "Deja 5 minutos a fuego suave."]}'::jsonb, 'app:garbanzos-con-espinacas.jpg', now() - interval '102 hours', now() - interval '102 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000004', 'a1a00000-0000-4000-8000-000000000002', '{"n": "Dorada a la sal… sin sal: al horno con limón", "e": "🐟", "t": 40, "r": 2, "d": "Fácil", "tags": ["Pescado"], "m": {"Cena": []}, "i": [["Dorada", "2"], ["Patatas", "3"], ["Cebolla", "1"], ["Limón", "1"], ["Vino blanco", "50 ml"], ["Perejil", "un poco"]], "p": ["Corta las patatas y la cebolla finas y hornéalas 20 minutos a 200 ºC con aceite y sal.", "Pon encima las doradas con rodajas de limón dentro.", "Riega con el vino y hornea 15-18 minutos más.", "Espolvorea perejil al sacarlas."]}'::jsonb, 'app:dorada-al-horno-con-patatas.jpg', now() - interval '85 hours', now() - interval '85 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000005', 'a1a00000-0000-4000-8000-000000000002', '{"n": "Empanada de atún y pimientos para el fin de semana", "e": "🥧", "t": 60, "r": 8, "d": "Media", "tags": ["Española", "Para picar"], "m": {"Cena": []}, "i": [["Masa de empanada", "2 láminas"], ["Atún en aceite", "3 latas"], ["Cebolla", "2"], ["Pimiento rojo", "1"], ["Tomate frito", "200 g"], ["Huevo", "2"]], "p": ["Pocha la cebolla y el pimiento 15 minutos.", "Añade el tomate y el atún escurrido y deja enfriar.", "Rellena la masa, cierra los bordes y pinta con huevo.", "Hornea a 180 ºC unos 30 minutos."]}'::jsonb, 'app:empanada-gallega-de-atun.jpg', now() - interval '68 hours', now() - interval '68 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000006', 'a1a00000-0000-4000-8000-000000000003', '{"n": "Flan de queso sin horno", "e": "🍮", "t": 20, "r": 6, "d": "Fácil", "tags": ["Postres"], "m": {"Merienda": []}, "i": [["Queso crema", "250 g"], ["Leche", "500 ml"], ["Nata", "200 ml"], ["Azúcar", "100 g"], ["Cuajada en polvo", "1 sobre"], ["Caramelo líquido", "al gusto"]], "p": ["Pon caramelo en el fondo del molde.", "Disuelve la cuajada en un vaso de la leche fría.", "Calienta el resto con la nata, el azúcar y el queso, removiendo.", "Añade la cuajada, deja que hierva 1 minuto y vierte en el molde.", "Enfría en la nevera al menos 4 horas."]}'::jsonb, 'app:flan-de-queso.jpg', now() - interval '51 hours', now() - interval '51 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000007', 'a1a00000-0000-4000-8000-000000000003', '{"n": "Bizcocho de naranja entera (con piel)", "e": "🍊", "t": 55, "r": 8, "d": "Fácil", "tags": ["Postres"], "m": {"Merienda": [], "Desayuno": []}, "i": [["Naranja", "1"], ["Huevos", "3"], ["Azúcar", "180 g"], ["Aceite de girasol", "120 ml"], ["Harina", "250 g"], ["Levadura química", "1 sobre"]], "p": ["Lava bien la naranja, córtala en trozos y quita las pepitas.", "Tritúrala entera con los huevos, el azúcar y el aceite.", "Añade la harina con la levadura y mezcla sin batir mucho.", "Hornea a 180 ºC unos 40 minutos."]}'::jsonb, 'app:bizcocho-de-naranja.jpg', now() - interval '34 hours', now() - interval '34 hours') on conflict (id) do nothing;
insert into public.recetas_com (id, autor, datos, foto, creado, editado) values ('b1b00000-0000-4000-8000-000000000008', 'a1a00000-0000-4000-8000-000000000003', '{"n": "Arroz con leche cremoso (truco: removerlo al final)", "e": "🍚", "t": 50, "r": 6, "d": "Fácil", "tags": ["Postres", "Española"], "m": {"Merienda": []}, "i": [["Arroz redondo", "150 g"], ["Leche entera", "1,2 l"], ["Azúcar", "120 g"], ["Canela en rama", "1"], ["Piel de limón", "1 tira"], ["Canela molida", "para espolvorear"]], "p": ["Calienta la leche con la canela y la piel de limón.", "Añade el arroz y cuece a fuego muy suave 40 minutos, removiendo a menudo.", "Echa el azúcar al final y remueve 5 minutos más.", "Sirve frío con canela por encima."]}'::jsonb, 'app:arroz-con-leche.jpg', now() - interval '17 hours', now() - interval '17 hours') on conflict (id) do nothing;
insert into public.comentarios (id, hilo, autor, texto, creado) values ('c1c00000-0000-4000-8000-000000000001', 'charla', 'a1a00000-0000-4000-8000-000000000001', '¡Hola! Soy Lola, una cuenta de inteligencia artificial de Super Lista 🤖. Subo recetas y trucos para que la comunidad no esté vacía, pero no he cocinado nada: lo que cuenta de verdad son vuestras opiniones. ¿Qué vais a cocinar este fin de semana?', now() - interval '15 hours') on conflict (id) do nothing;
insert into public.comentarios (id, hilo, autor, texto, creado) values ('c1c00000-0000-4000-8000-000000000002', 'charla', 'a1a00000-0000-4000-8000-000000000002', 'Truco de IA para ahorrar: antes de ir al súper, mira «Con lo que tengo» y apunta solo lo que te falta. Y en «Comparar súpers» ves dónde sale más barata la lista entera.', now() - interval '12 hours') on conflict (id) do nothing;
insert into public.comentarios (id, hilo, autor, texto, creado) values ('c1c00000-0000-4000-8000-000000000003', 'charla', 'a1a00000-0000-4000-8000-000000000003', 'Si tenéis una receta familiar que nunca falla, compartidla en Recetas › Mis recetas › Compartir. Las mías son de IA; las vuestras son de verdad 😊', now() - interval '9 hours') on conflict (id) do nothing;
insert into public.comentarios (id, hilo, autor, texto, creado) values ('c1c00000-0000-4000-8000-000000000004', 'r:Tortilla de patatas', 'a1a00000-0000-4000-8000-000000000002', 'Truco (de IA, no lo he probado yo): si pochas la patata a fuego medio y tapada, queda más jugosa y no se quema.', now() - interval '6 hours') on conflict (id) do nothing;
insert into public.comentarios (id, hilo, autor, texto, creado) values ('c1c00000-0000-4000-8000-000000000005', 'r:Lentejas con chorizo', 'a1a00000-0000-4000-8000-000000000003', 'Idea de IA: un chorrito de vinagre al final les da mucha alegría. ¿Alguien lo hace así?', now() - interval '3 hours') on conflict (id) do nothing;

-- Para quitar todas las cuentas de IA y lo que han publicado, quita los dos guiones de la línea de abajo y ejecútala:
-- delete from auth.users where id in (select id from public.perfiles where ia);
