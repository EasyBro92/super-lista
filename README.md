# Super Lista

Lista de la compra para el móvil con productos, fotos y precios de los supermercados españoles.

- Escribe o dicta frases como «apunta 2 kilos de naranjas, leche y oreos», «quita el atún» o «ya tengo la leche».
- Cada producto se busca en el catálogo del supermercado elegido y aparece con su foto y, si se conoce, su precio.
- Varias listas, productos frecuentes, modo tienda (letra grande y pantalla siempre encendida) e historial de compras.
- Escáner de código de barras para apuntar un producto con la cámara.
- Funciona sin conexión y se puede instalar en la pantalla de inicio («Añadir a pantalla de inicio»).

## De dónde salen los productos

Cada noche el workflow `Actualizar catálogos` descarga:

| Supermercado | Fuente | Precios |
| --- | --- | --- |
| Mercadona | Tienda online de Mercadona | Sí |
| Carrefour, Lidl, Dia, Alcampo, Eroski, Aldi, Consum, El Corte Inglés | Open Food Facts (base de datos abierta) | No |

Los catálogos se guardan en `data/stores/` y la web se publica en GitHub Pages con el workflow `Publicar web`.

## Probar en local

```sh
node scripts/build-catalog.mjs mercadona   # descarga un catálogo
python3 -m http.server 8000                # abre http://localhost:8000
```
