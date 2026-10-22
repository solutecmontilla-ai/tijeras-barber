# Tijeras Barbershop

Sistema para barbería: cubículos, servicios con cronómetro oculto, historial de clientes y facturación con impresora fiscal **The Factory HKA**.

```
 Tablets (barberos) ─┐                         ┌─ Agente fiscal (PC de caja) ── COM ── Impresora HKA
 PC/tablet admin ────┼──HTTPS──► Servidor Coolify ◄─HTTPS (sondeo saliente)
                     │           (Next.js + SQLite en volumen /data)
```

- `app/` — aplicación web (Next.js). Se despliega en Coolify.
- `agente-fiscal/` — programa Node que corre en la PC donde está conectada la impresora. Toma los trabajos pendientes del servidor, los imprime y reporta el número fiscal. Solo hace conexiones salientes: no hay que abrir puertos en el router.

## Flujo

1. **Admin** crea cubículos (`1 = Jose`, `2 = Marcos`) y servicios con precio en **dólares** (IVA incluido), y fija la **tasa del día** (Bs por $) en la caja.
2. **Admin** autoriza cada tablet de la barbería (*Dispositivos*). Sin eso nadie puede entrar como barbero.
3. **Barbero** entra con su número de cubículo → ingresa la cédula del cliente.
   - Cliente nuevo: pide nombre y apellido.
   - Cliente recurrente: muestra fecha de la última visita y qué se le hizo.
4. Selecciona servicios → **Iniciar**. El cronómetro corre en el servidor; el barbero nunca ve la hora ni la duración.
5. **Finalizar** → pasa a la caja del admin.
6. **Admin** ve la duración, el historial del cliente, completa teléfono y fecha de nacimiento, ajusta el consumo, elige forma de pago y **Factura**. Se cobra en Bs (precio $ × tasa); la factura va a la cola fiscal y el agente la imprime.

## Seguridad

- Login de barbero solo desde tablets autorizadas (cookie de dispositivo de 1 año, revocable desde *Dispositivos*).
- Clave de admin con hash scrypt; bloqueo de 15 min tras 5 intentos fallidos por IP.
- Cookies `httpOnly` + `SameSite=Lax` firmadas con HMAC; verificación de `Origin` en todo POST (CSRF).
- Agente fiscal autenticado con token Bearer (regenerable).
- Cabeceras: `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS con HTTPS.
- La factura se rechaza si la tasa cambió mientras el admin la preparaba.

## Desarrollo local

> La ruta actual contiene `&` ("Amays & Geeks") y eso rompe los scripts de `npm run` en Windows. Use los comandos directos de abajo, o mueva el proyecto a una ruta sin `&` (idealmente fuera de OneDrive).

```bash
cd app
npm install --ignore-scripts
node node_modules/next/dist/bin/next dev      # http://localhost:3000
```

Clave inicial del admin: `admin` (o la variable `ADMIN_PASSWORD` en el primer arranque). Cámbiela en *Impresora y ajustes*.

Por defecto el modo fiscal es **simulador**: las facturas se marcan como impresas con número `SIM-…`, para probar todo sin impresora.

## Despliegue en Coolify

1. Subir el repo a Git y crear en Coolify un recurso **Dockerfile** con *Base Directory* `/app`.
2. Puerto expuesto: `3000`.
3. **Volumen persistente** montado en `/data` (ahí vive `barberia.db`). Sin volumen se pierden los datos en cada deploy.
4. Variables: `ADMIN_PASSWORD` (obligatoria para crear la base en producción; luego se cambia desde el panel) y `COOKIE_SECURE=true` cuando el dominio tenga HTTPS.
5. Asignar dominio con HTTPS.

### Cambiar o restablecer la clave del admin

- **Sabiendo la clave actual:** *Admin → Impresora y ajustes → Nueva clave de administrador → Guardar ajustes*.
- **Sin la clave actual:** en Coolify, *Terminal* del contenedor de la app, cambiar `MiClaveNueva123` y ejecutar:

  ```sh
  node -e "const{DatabaseSync}=require('node:sqlite');const c=require('node:crypto');const s=c.randomBytes(16).toString('hex');const r=new DatabaseSync('/data/barberia.db').prepare(\"UPDATE config SET valor=? WHERE clave='admin_password'\").run(s+':'+c.scryptSync(process.argv[1],s,32).toString('hex'));console.log(r.changes?'Clave cambiada':'No se encontro')" 'MiClaveNueva123'
  ```

  Solo toca la clave; no requiere reiniciar. Cambiar `ADMIN_PASSWORD` en Coolify **no** cambia la clave de una base ya creada (conviene actualizarla igual para que coincidan).

## Agente fiscal (PC de caja, Windows)

```bash
cd agente-fiscal
npm install --ignore-scripts      # usa los binarios precompilados de serialport
copy config.ejemplo.json config.json
node agente.js --puertos          # lista los COM disponibles
node agente.js --probar           # consulta estado y S1 a la impresora
node agente.js                    # modo servicio
```

En `config.json`: URL del servidor, token (Admin → *Impresora y ajustes* → Token del agente) y puerto COM. Luego cambiar el modo fiscal a **Agente fiscal** en el panel. Para que arranque con Windows se puede registrar como servicio con NSSM o pm2.

### Protocolo HKA implementado

Trama `STX + comando + ETX + LRC` (LRC = XOR de comando y ETX), respuesta ACK/NAK, 9600 8E1.

| Comando | Uso |
|---|---|
| `iR*V12345678` | Cédula/RIF del cliente |
| `iS*Nombre Apellido` | Razón social |
| `i00Telefono: …` | Línea adicional |
| `!PPPPPPPPPPCCCCCCCCDescripción` | Item (`' '` exento, `!` general, `"` reducida, `#` adicional). Precio base sin IVA |
| `3` | Subtotal |
| `1NN` | Pago total con medio `NN` (cierra la factura) |
| `S1` | Estado (de aquí se lee el número de la última factura) |
| `I0X` / `I0Z` | Reporte X / Z |

Pendiente de validar con el equipo real: ancho de campos (8+2 / 5+3 en protocolo clásico; los firmwares nuevos usan otro), posición del número de factura en `S1` (`s1NumeroFactura` en `config.json`) y códigos de medios de pago programados en la impresora.

Para no duplicar facturas fiscales, un trabajo que el agente ya tomó nunca se reenvía automáticamente; si falla, el admin lo reintenta a mano desde *Facturas* después de verificar que la impresora no lo emitió.
