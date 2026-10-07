# 📱 PAP — Puerta a Puerta | Guía Completa

## Estructura del proyecto

```
pap/
├── index.html          ← App principal (SPA)
├── manifest.json       ← PWA manifest
├── sw.js               ← Service Worker (offline + cache)
├── css/
│   └── style.css       ← Estilos iOS dark theme
├── js/
│   ├── app.js          ← Controlador principal
│   ├── map.js          ← Mapa Leaflet
│   ├── geocoder.js     ← Geocodificación Nominatim
│   ├── router.js       ← Routing OSRM
│   ├── optimizer.js    ← TSP (Nearest Neighbor + 2-opt)
│   └── storage.js      ← localStorage persistence
└── icons/
    ├── icon-192.png    ← Ícono PWA
    └── icon-512.png    ← Ícono PWA
```

---

## 1. Ejecutar localmente

```bash
cd pap
npx -y http-server -p 8080 -c-1
```

Abrí `http://localhost:8080` en el navegador.

---

## 2. Subir a GitHub Pages (GRATIS)

### Paso 1: Crear repositorio en GitHub

1. Andá a [github.com/new](https://github.com/new)
2. Nombre: `pap`
3. Puede ser público o privado
4. Clic en **Create repository**

### Paso 2: Subir el código

```bash
cd pap
git init
git add .
git commit -m "PAP - Puerta a Puerta v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pap.git
git push -u origin main
```

### Paso 3: Activar GitHub Pages

1. Ir a **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Clic en **Save**

### Paso 4: Esperar ~2 minutos

Tu app estará disponible en:

```
https://TU_USUARIO.github.io/pap/
```

> [!IMPORTANT]
> No necesitás comprar dominio. El subdominio `.github.io` es gratuito y permanente.

---

## 3. Instalar como PWA en iPhone 16

1. Abrí **Safari** en tu iPhone
2. Navegá a `https://TU_USUARIO.github.io/pap/`
3. Tocá el botón **Compartir** (cuadrado con flecha ↑)
4. Seleccioná **"Agregar a pantalla de inicio"**
5. Confirmá el nombre "PAP"
6. Tocá **Agregar**

La app ahora:
- Tiene ícono en tu Home Screen
- Se abre a pantalla completa (sin barra de Safari)
- Funciona con gestos de iOS
- Se siente como una app nativa

---

## 4. Servicios externos utilizados

### OpenStreetMap (Mapa)
| | |
|---|---|
| **Uso** | Tiles del mapa (imágenes de calles) |
| **Costo** | **$0** — Gratuito y open source |
| **Límites** | Uso razonable (no hay límite numérico para uso personal) |
| **API Key** | No requiere |
| **Tarjeta** | No requiere |

### Leaflet (Librería de mapa)
| | |
|---|---|
| **Uso** | Renderizado interactivo del mapa |
| **Costo** | **$0** — Open source (BSD-2-Clause) |
| **Límites** | Sin límites (se ejecuta en el navegador) |

### Nominatim (Geocodificación)
| | |
|---|---|
| **Uso** | Dirección → Coordenadas / Coordenadas → Dirección |
| **Costo** | **$0** — Servicio gratuito de OpenStreetMap |
| **Límites** | 1 solicitud por segundo |
| **API Key** | No requiere |
| **Tarjeta** | No requiere |
| **Mitigación** | Debounce de 800ms + caché local |

### OSRM Demo Server (Routing)
| | |
|---|---|
| **Uso** | Rutas por calles + Matriz de distancias |
| **Costo** | **$0** — Servidor demo público |
| **Límites** | Sin límite formal (uso razonable) |
| **API Key** | No requiere |
| **Tarjeta** | No requiere |
| **Nota** | Es un servidor demo sin SLA, pero es estable y ampliamente utilizado |

### GitHub Pages (Hosting)
| | |
|---|---|
| **Uso** | Hosting de archivos estáticos |
| **Costo** | **$0** — Incluido con GitHub Free |
| **Límites** | 100 GB/mes ancho de banda, 1 GB repositorio |
| **Tarjeta** | No requiere |

### navigator.geolocation (GPS)
| | |
|---|---|
| **Uso** | Ubicación actual del iPhone |
| **Costo** | **$0** — API nativa del navegador |
| **Límites** | Sin límites |

### Google Maps (Solo apertura)
| | |
|---|---|
| **Uso** | Abrir navegación a una parada |
| **Costo** | **$0** — Solo abre la app/web como usuario |
| **API Key** | No se usa API de Google |
| **Tarjeta** | No requiere |

---

## 5. Confirmación de costos

> [!NOTE]
> ### 💰 Costo total: $0.00
>
> - No se usa ninguna API de pago
> - No se requiere tarjeta de crédito en ningún servicio
> - No existe facturación automática
> - No hay riesgo de cargos sorpresa
> - Todos los servicios son gratuitos para uso personal

---

## 6. Posibles riesgos (ninguno es de costo)

| Riesgo | Probabilidad | Impacto |
|--------|-------------|---------|
| OSRM demo server con downtime temporal | Baja | No podrás calcular rutas hasta que vuelva |
| Nominatim rate-limited si buscás muy rápido | Muy baja | La app ya implementa debounce + caché |
| Links cortos de Google Maps no procesables | Media | Mensaje claro pidiendo el link completo |
| Tiles OSM lentos en zonas rurales | Baja | Solo afecta la carga visual del mapa |

**Ninguno de estos riesgos genera costos.**

---

## 7. Funcionalidades implementadas

- ✅ Selector de ciudad (Gualeguaychú / Concepción del Uruguay)
- ✅ Mapa interactivo centrado en la ciudad
- ✅ 3 formas de agregar paradas (dirección, mapa, Google Maps link)
- ✅ Lista numerada de paradas
- ✅ Mover paradas arriba/abajo
- ✅ Eliminar paradas con confirmación
- ✅ Ver parada en el mapa
- ✅ Optimización de ruta (Nearest Neighbor + 2-opt)
- ✅ Ruta trazada sobre calles reales
- ✅ Distancia y tiempo total estimado
- ✅ Punto de partida con GPS
- ✅ Navegación con Google Maps por parada
- ✅ Guardado automático (localStorage)
- ✅ Nueva ruta con confirmación
- ✅ PWA con Service Worker
- ✅ Funciona offline (UI + datos guardados)
- ✅ Diseño oscuro iOS-nativo
- ✅ Optimizado para iPhone 16

---

## 8. Cómo usar la app

1. **Abrí la app** desde tu iPhone
2. **Seleccioná la ciudad** (Gualeguaychú o C. del Uruguay)
3. **Opcionalmente** tocá "Usar mi ubicación como partida"
4. Tocá **"＋ Agregar parada"**
5. Elegí una de las 3 opciones:
   - 📝 Escribir dirección
   - 📍 Seleccionar en el mapa
   - 🔗 Pegar link de Google Maps
6. Repetí para todas tus paradas
7. Tocá **"CALCULAR RUTA"**
8. La app optimiza el orden y muestra la ruta
9. Tocá una parada → **"🚗 Navegar"** → Google Maps se abre
10. Seguí con la siguiente parada
