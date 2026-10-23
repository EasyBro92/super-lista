# Probar la comunidad sin Supabase

Un Supabase de mentira para probar `supabase/comunidad.sql` y `js/comunidad.js` en local, con un Postgres de verdad.

```sh
npm i pg playwright                         # una vez
# Postgres 16 escuchando en /tmp, puerto 5433, usuario postgres
createdb -h /tmp -p 5433 -U postgres t3 && psql -h /tmp -p 5433 -U postgres -d t3 -f stub.sql -f ../../supabase/comunidad.sql
node sql-test.mjs                           # 38 pruebas de permisos y límites
createdb -h /tmp -p 5433 -U postgres t2 && psql -h /tmp -p 5433 -U postgres -d t2 -f stub.sql -f ../../supabase/listas.sql -f ../../supabase/comunidad.sql
node server.mjs ../.. 8790 t2 &              # la app + el Supabase falso en http://localhost:8790
node e2e.mjs                                # dos personas usando la app a la vez; capturas en /tmp/capturas-comunidad
```

- `stub.sql`: lo mínimo de Supabase (roles, `auth.uid()`, tablas de Storage).
- `fake-sdk.js`: sustituye a `@supabase/supabase-js` en el navegador (la prueba lo inyecta) y habla con `server.mjs`.
