# Field Shift — interfaz final (v1 + v2 integradas)

Esta carpeta es lo que sirve el servidor en `/`. Es la interfaz nueva ("Libreta de campo con satélite") con todo lo de la versión 1 conservado dentro (explorador de capas, terreno por cuadrícula, IA de cultivos, mejoras M1–M12).

## Reglas
- **Solo datos reales.** No hay modo demostración ni valores de ejemplo. Si un dato no existe se muestra «—» o un aviso, nunca un número inventado.
- **Inicio de sesión obligatorio.** Sin sesión solo se ve la ventana de entrada; cuentas, terrenos, alertas y recomendaciones los guarda y calcula el servidor (`/api/v1/cuenta/*`, `/terrenos`, `/alertas`, `/recomendaciones`).
- **Robot real.** Lo que el robot manda llega por hoja de Google, archivo CSV/Excel o envío en vivo (`/api/v1/robot/*`, contrato en `privado/contexto_space_apps_2026/contrato_datos_robot.md`). No hay emparejamiento simulado, ni batería, ni ruta, si el robot no los envía.

## Archivos
| Archivo | Para qué |
|---|---|
| `index.html`, `estilos.css` | Estructura y estilos |
| `app.js` | Estado, navegación, inicio de sesión forzado, sondeo del robot |
| `adaptador.js` | Todas las llamadas al servidor; nunca inventa datos |
| `cuenta.js`, `ubicacion.js` | Entrar/crear cuenta; elegir y guardar terreno (hectáreas las calcula el servidor) |
| `robot.js`, `emparejar.js` | Sección Robot: conectar hoja de Google, subir archivo, ver lecturas y ruta |
| `alertas.js`, `conceptos.js`, `mapa.js`, `pantallas.js`, `i18n.js`, `iconos.js` | Alertas, glosario, mapa, pantallas, textos ES/EN/PT, iconos |
| `v1/` | Interfaz anterior, archivada y accesible en `/v1/` |
| `capturas/` | Capturas de revisión |
