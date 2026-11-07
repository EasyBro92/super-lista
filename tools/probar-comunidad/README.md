# Probar la comunidad sin Supabase

Un Supabase de mentira para probar `supabase/comunidad.sql` y `js/comunidad.js` en local, con un Postgres de verdad.

```sh
npm i pg playwright                         # una vez
# Postgres 16 escuchando en /tmp, puerto 5433, usuario postgres
createdb -h /tmp -p 5433 -U postgres t3 && psql -h /tmp -p 5433 -U postgres -d t3 -f stub.sql -f ../../supabase/comunidad.sql
node sql-test.mjs                           # 42 pruebas de permisos y límites
createdb -h /tmp -p 5433 -U postgres t4 && psql -h /tmp -p 5433 -U postgres -d t4 -f stub.sql -f ../../supabase/listas.sql
node listas-test.mjs                        # 8 pruebas de las listas compartidas (tamaño y listas nuevas por hora)
createdb -h /tmp -p 5433 -U postgres t2 && psql -h /tmp -p 5433 -U postgres -d t2 -f stub.sql -f ../../supabase/listas.sql -f ../../supabase/comunidad.sql
node server.mjs ../.. 8790 t2 &              # la app + el Supabase falso en http://localhost:8790
node e2e.mjs                                # dos personas usando la app a la vez; capturas en /tmp/capturas-comunidad
createdb -h /tmp -p 5433 -U postgres t5 && psql -h /tmp -p 5433 -U postgres -d t5 -f stub.sql -f ../../supabase/listas.sql -f ../../supabase/comunidad.sql -f ../../supabase/envios.sql
node envios-test.mjs                        # 21 pruebas de los envíos (códigos, buzón, permisos y límites)
node server.mjs ../.. 8790 t5 &              # (en vez del de t2)
node e2e-envios.mjs                         # pasar datos con código y enlace, una lista, y a una persona; capturas en /tmp/capturas-envios
```

- `stub.sql`: lo mínimo de Supabase (roles, `auth.uid()`, tablas de Storage).
- `fake-sdk.js`: sustituye a `@supabase/supabase-js` en el navegador (la prueba lo inyecta) y habla con `server.mjs`.
