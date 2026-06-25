# EconoMy 0.1

Prototipo funcional mobile-first.

## Mecánica actual

- Plantación de maíz.
- Depósito.
- Mercado.
- Arrastrar rutas:
  - Plantación → Depósito
  - Plantación → Mercado
  - Depósito → Mercado
- Camioncitos animados.
- Stock en edificios.
- Venta automática en mercado.
- Guardado local automático.
- Preparado como PWA básica.

## Cómo probar

Abrir `index.html` en el navegador.

## Cómo subir a GitHub Pages

1. Crear un repositorio.
2. Subir estos archivos.
3. Ir a Settings > Pages.
4. Elegir rama `main` y carpeta `/root`.
5. Guardar.

## Camino a Android / iOS

Este proyecto puede convertirse a app móvil con:

- PWA: instalable desde navegador.
- Capacitor: genera proyecto Android e iOS usando la misma base web.

Comandos futuros orientativos:

```bash
npm create vite@latest economy
npm install @capacitor/core @capacitor/cli
npx cap init EconoMy com.economy.game
npx cap add android
npx cap add ios
```

Para iOS hace falta una Mac con Xcode.
