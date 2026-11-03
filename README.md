# BOCA 360° · App web instalable y sincronización automática

App **no oficial**, pensada para hinchas de Boca. Incluye inicio, agenda de partidos, resultados, posiciones, plantel con favoritos, noticias enlazadas, historia, actualización y modo instalable (PWA).

## Publicarla GRATIS con actualización automática (GitHub Pages)

1. Creá una cuenta en **https://github.com/** y descargá el ZIP de la app. Descomprimilo: la carpeta resultante tiene archivos `index.html`, `assets`, `data`, `scripts`, `.github` (esta última es una carpeta oculta: no la borres).
2. En GitHub creá un **repositorio público nuevo**, por ejemplo `boca360`. No hace falta elegir plantilla ni agregar README (este paquete ya lo tiene).
3. Subí **todo el contenido** de la carpeta descomprimida a la **raíz del repositorio**, incluida `.github/workflows/actualizar-y-publicar.yml`. Podés hacerlo con GitHub Desktop (más fácil para no omitir carpetas ocultas) o desde **Add file → Upload files**. Subí el contenido, no el ZIP cerrado.
4. Verificá que la rama principal se llame `main`. En el repositorio entrá a **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Andá a **Actions**, abrí el flujo **Boca 360 - Actualizar datos y publicar app** y, si hiciera falta, presioná **Run workflow**. La primera publicación puede tomar unos minutos.
6. En **Settings → Pages** vas a encontrar la URL final, normalmente `https://TUUSUARIO.github.io/boca360/`. Compartila o agregala a la pantalla de inicio.

> Para subirlo usando el iPhone, puede resultar más fácil hacerlo desde una computadora. Si la carpeta `.github` no se sube, la app queda estática y **no** se actualizará automáticamente.

## Instalar en iPhone

Abrí la URL publicada desde **Safari** → botón **Compartir** → **Agregar a pantalla de inicio** → **Agregar**. Desde ese momento se abre como una app. En Android, abrí Chrome y elegí **Instalar app** desde el menú.

## Cómo funciona la actualización

- GitHub Actions ejecuta `scripts/update_data.py` **cada hora aproximadamente** (`17 * * * *` UTC), más cuando subís cambios o lo ejecutás manualmente desde Actions.
- El script usa **feeds públicos no oficiales de ESPN** para partidos, posiciones y plantel, y **Google Noticias RSS** para enlaces a noticias. No necesita claves de API. La disponibilidad no está garantizada; estos feeds podrían cambiar, ser incompletos o dejar de funcionar.
- Si una fuente falla, **conserva la última versión que pudo obtener** (en el repositorio); la app muestra la fecha y estado de los datos. No se inventan tablas, resultados ni jugadores faltantes.
- La app consulta `data/boca.json` al abrirse y, mientras esté abierta con internet, aproximadamente cada **10 minutos**. La actualización en servidor depende de GitHub Actions; **no es un marcador en vivo segundo a segundo**.
- Las tareas de GitHub pueden demorarse, saltearse o desactivarse por inactividad. Entrá a **Actions** si notás datos viejos.
- La app también funciona sin conexión con los archivos cacheados del último acceso (PWA); en modo offline los datos pueden estar desactualizados.

## Cómo probarla localmente

- Podés abrir directamente `index.html`: muestra los datos iniciales o el último paquete sincronizado (los archivos JS permiten visualizar el contenido sin servidor).
- Para testear el sistema completo en una PC, desde esta carpeta ejecutá `python -m http.server 8000` y visitá `http://localhost:8000`.
- Para actualizar el contenido localmente con acceso a internet: `python scripts/update_data.py`.
- La sincronización usa solo la biblioteca estándar de Python (sin instalar paquetes).

## Advertencias y límites

- No es una app nativa de App Store; es una **PWA instalable**. Para publicarla en App Store necesitarías otro flujo, requisitos y una cuenta de desarrollador de Apple.
- No envía notificaciones push ni incluye transmisiones en vivo. **No** necesita iniciar sesión, ni pide datos personales. Los favoritos quedan en el almacenamiento local de tu navegador.
- No es una publicación oficial ni está patrocinada por Boca Juniors o ESPN. Logos/marcas de terceros pertenecen a sus titulares; revisá condiciones de uso de las fuentes si pensás distribuirla comercialmente.
- Los datos iniciales están identificados como referencia **02/11/2026**. Si todavía no la publicaste, la vista estática no puede actualizarse sola.

## Archivos importantes

- `index.html`: página principal.
- `assets/app.css`, `assets/app.js`: interfaz y funcionalidad.
- `assets/seed.js`: permite abrir la app sin servidor y con datos guardados.
- `data/boca.json`: datos que se actualizan.
- `sw.js`, `manifest.webmanifest`, iconos PNG: instalación y modo offline.
- `scripts/update_data.py`: sincronizador.
- `scripts/build_site.py`: construye lo que se publica.
- `.github/workflows/actualizar-y-publicar.yml`: automatización y despliegue.

## Diagnóstico

Si no aparecen datos nuevos: revisá Actions → última ejecución → paso "Consultar fuentes de Boca". Si dice HTTP 403/429 o similar, la fuente limitó o bloqueó la solicitud; la app seguirá mostrando la última información guardada. Si falla la publicación, confirmá `Settings → Pages → Source: GitHub Actions` y que el repositorio sea público.
