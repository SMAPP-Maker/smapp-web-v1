# SMAPP Web v1

Primera versión web de SMAPP, manteniendo Google Sheets como base de datos y Apps Script como API.

## Arquitectura

GitHub Pages → Apps Script Web App → Google Sheet `Inventarios AppSheet v1`

El flujo de carga de stock de Contífico se mantiene como está hoy:

Contífico XLSX → `Contifico_Entrantes` → Apps Script → `Contifico_Raw` / `StockContable` → `Conciliacion`

La web reemplaza inicialmente a AppSheet para:

- crear inventarios;
- seleccionar local;
- registrar responsable;
- contar productos;
- admitir cantidades decimales y cero;
- evitar duplicados;
- finalizar inventario;
- ver conciliación.

## Locales configurados

- CFUIO — Casa de las Flores
- PBUIO — Piano Bar
- LMMEC — Love Me Manta
- LMUIO — Love Me Quito
- LFUIO — La Fabrica
- SMUIO — Shot me

## Paso 1 — Agregar la API al Apps Script v1

1. Abre `Inventarios AppSheet v1`.
2. Extensiones → Apps Script.
3. Conserva el código existente del importador de Contífico.
4. Crea un archivo nuevo llamado `WebApi.gs`.
5. Copia dentro el contenido de `apps-script/Code.gs`.
6. Verifica que el Spreadsheet ID sea el de v1.
7. Guarda.

> Si tu proyecto ya tiene una función `doGet` o `doPost`, hay que integrarlas en lugar de duplicarlas.

## Paso 2 — Desplegar Apps Script como Web App

1. Apps Script → Deploy → New deployment.
2. Tipo: Web app.
3. Execute as: Me.
4. Who has access: Anyone (para esta demo).
5. Deploy.
6. Autoriza los permisos.
7. Copia la URL que termina en `/exec`.

## Paso 3 — Conectar la web

Abre `app.js` y reemplaza:

```js
const WEB_APP_URL = 'PEGAR_AQUI_URL_DE_APPS_SCRIPT';
```

por la URL `/exec` del despliegue.

## Paso 4 — Crear repositorio en GitHub

1. GitHub → New repository.
2. Nombre sugerido: `smapp-web-v1`.
3. Public o Private según prefieras.
4. Create repository.
5. Sube `index.html`, `styles.css`, `app.js` y `README.md`.

No necesitas subir la carpeta `apps-script` si no quieres exponer el backend en un repositorio público.

## Paso 5 — Activar GitHub Pages

1. Repository → Settings → Pages.
2. Source: Deploy from a branch.
3. Branch: `main`.
4. Folder: `/ (root)`.
5. Save.
6. Espera aproximadamente 1 minuto.

GitHub mostrará la URL pública de SMAPP Web.

## Seguridad

Esta v1 está pensada como demo/prototipo. Si el Apps Script se despliega como `Anyone`, cualquier persona que conozca el endpoint podría intentar enviar solicitudes. Antes de operar con clientes reales se debe agregar autenticación y aislamiento por empresa/usuario.

Una siguiente versión recomendable es:

- frontend en GitHub/Vercel;
- autenticación;
- API protegida;
- base PostgreSQL/Supabase;
- multiempresa;
- roles y auditoría.

## Regla de conciliación

- Físico = contable → Cuadrado
- Físico < contable → Faltante
- Físico > contable → Sobrante
- Existe en contabilidad sin registro físico → No contado
- Existe físico sin registro contable → No existe en Contífico
- Cantidad física 0 sí cuenta como producto contado
- No encontrar una fila contable no equivale a stock contable 0
