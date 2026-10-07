# 🏗️ Arquitectura PAP — Puerta a Puerta

## Resumen de servicios y costos

| # | Componente | Servicio elegido | Costo | Límites |
|---|-----------|-----------------|-------|---------|
| 1 | **Hosting** | GitHub Pages | **$0** | 100 GB/mes ancho de banda, 1 GB repositorio |
| 2 | **Mapa** | Leaflet + OpenStreetMap tiles | **$0** | Sin límites prácticos para uso personal. Tiles servidos por OSM (uso razonable) |
| 3 | **Geocodificación** | Nominatim (OpenStreetMap) | **$0** | 1 solicitud/segundo, sin API key, sin tarjeta |
| 4 | **Routing** | OSRM público (`router.project-osrm.org`) | **$0** | Servidor demo, sin API key, sin tarjeta. Uso razonable (personal = OK) |
| 5 | **Optimización TSP** | Cliente (Nearest Neighbor + 2-opt) | **$0** | Se ejecuta localmente en el navegador |
| 6 | **Almacenamiento** | localStorage + IndexedDB | **$0** | ~5-10 MB en localStorage, ilimitado en IndexedDB |
| 7 | **Geolocalización** | `navigator.geolocation` (API del navegador) | **$0** | Nativo de iOS/Safari, GPS del iPhone |
| 8 | **Google Maps** | URL schemes (`comgooglemaps://` / `maps.google.com`) | **$0** | Solo abre la app/web, no usa API |

## Detalle técnico

### 1. Hosting — GitHub Pages
- Gratis para repositorios públicos o privados (con GitHub Free)
- Dominio: `tuusuario.github.io/pap`
- Sin servidor, sin base de datos, sin facturación
- **Riesgo de costo: CERO**

### 2. Mapa — Leaflet + OSM
- **Leaflet**: Librería JS open source, se carga desde CDN
- **Tiles**: OpenStreetMap tiles gratuitos (`tile.openstreetmap.org`)
- Política de uso: uso razonable, incluir atribución (ya incluida por defecto en Leaflet)
- **Riesgo de costo: CERO**

### 3. Geocodificación — Nominatim
- Servicio gratuito de OpenStreetMap
- Convertir dirección → coordenadas y coordenadas → dirección
- Límite: **1 solicitud por segundo** (implementamos debounce de 800ms)
- Sin API key, sin registro, sin tarjeta
- Implementaremos **caché local** para evitar consultas repetidas
- **Riesgo de costo: CERO**

### 4. Routing — OSRM Demo Server
- `router.project-osrm.org` es el servidor demo público de OSRM
- Soporta: ruta punto a punto, y **tabla de distancias** (clave para optimización)
- Sin API key, sin registro, sin tarjeta
- Uso personal = perfectamente aceptable
- **Riesgo de costo: CERO**

### 5. Optimización — TSP en cliente
- Usamos la **tabla de distancias de OSRM** (1 sola consulta para N paradas)
- Algoritmo: **Nearest Neighbor** para solución inicial + **2-opt** para mejorarla
- Todo se ejecuta en JavaScript en el dispositivo
- Para 20 paradas: 1 consulta OSRM + cálculo local instantáneo
- **Riesgo de costo: CERO**

### 6. Almacenamiento — localStorage
- Rutas, paradas, configuración → `localStorage`
- Guardado automático + recuperación al reabrir
- Sin servidor, sin base de datos
- **Riesgo de costo: CERO**

### 7. Geolocalización — API del navegador
- `navigator.geolocation.getCurrentPosition()`
- Usa el GPS del iPhone 16
- Sin servicio externo
- **Riesgo de costo: CERO**

### 8. Google Maps — Solo apertura
- Para navegar: `https://www.google.com/maps/dir/?api=1&destination=lat,lng`
- No usa Google Maps API, JavaScript API, ni Directions API
- Solo abre Google Maps como usuario normal
- **Riesgo de costo: CERO**

## Stack tecnológico

- **HTML + CSS + JavaScript vanilla** (sin framework, sin build step)
- **Leaflet** vía CDN para el mapa
- **Service Worker** para PWA y offline básico
- Sin dependencias npm, sin bundler, sin compilación

> [!IMPORTANT]
> **Costo total confirmado: $0.00**
> Todos los servicios son gratuitos, ninguno requiere tarjeta de crédito, y ninguno tiene facturación automática.

## Estructura del proyecto

```
pap/
├── index.html          # App principal (SPA)
├── css/
│   └── style.css       # Estilos iOS-like
├── js/
│   ├── app.js          # Lógica principal
│   ├── map.js          # Gestión del mapa Leaflet
│   ├── geocoder.js     # Geocodificación Nominatim
│   ├── router.js       # Routing OSRM
│   ├── optimizer.js    # TSP (Nearest Neighbor + 2-opt)
│   ├── storage.js      # localStorage
│   ├── stops.js        # Gestión de paradas
│   └── utils.js        # Utilidades
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker
└── icons/              # Iconos PWA
    ├── icon-192.png
    └── icon-512.png
```

## Posibles limitaciones (no riesgos de costo)

| Limitación | Impacto | Mitigación |
|-----------|---------|-----------|
| Nominatim: 1 req/s | Búsquedas ligeramente lentas | Debounce 800ms + caché |
| OSRM demo: sin SLA | Podría tener downtime ocasional | Es un demo server estable, usado ampliamente |
| Links cortos de Google Maps (`goo.gl`) | No se pueden resolver client-side (CORS) | Soportamos links largos con coordenadas; mensaje claro para links cortos |
| Mapa offline | Tiles no se cachean masivamente | Se cachean tiles visitados vía Service Worker |
