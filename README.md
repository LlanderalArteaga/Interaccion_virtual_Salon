# 3.2 Interacción virtual

Laboratorio universitario de realidad virtual para clasificar figuras geométricas mediante seguimiento de manos y simulación de cuerpos rígidos. La persona toma cada figura con un gesto de pinza, la mueve y la suelta en el recipiente de su categoría. La gravedad, las colisiones y la fricción determinan cómo cae y se acomoda.

**Autor:** Axel Llanderal Arteaga  
**Tipo de aplicación:** sitio web estático con una experiencia `immersive-vr`

**Proyecto de continuidad:** amplía la práctica 3.1 de interacción virtual.

## ¿Para qué sirve?

La práctica permite explorar conceptos de interacción espacial y física 3D en una actividad concreta. El alumno reconoce cuatro clases de cuerpos, los manipula con las manos y observa la diferencia entre soltar una figura dentro de su recipiente correcto, colocarla en uno equivocado o dejarla caer fuera.

El reto tiene **20 figuras**: cinco cubos, cinco esferas, cinco pirámides cuadradas y cinco prismas hexagonales. Se distribuyen en **cuatro mesas alineadas en una fila**, con cinco piezas cada una. Hay un recipiente abierto por categoría. El panel tridimensional muestra progreso, tiempo, intentos, errores, precisión y avance por categoría.

La ambientación representa un laboratorio universitario de prototipado. Sus paredes, piso, ventanales y luminarias se generan con geometría de Three.js. El escenario es opaco y virtual: no usa cámara, passthrough ni realidad aumentada o mixta.

## Cómo se usa

1. Abre la página en Meta Quest Browser y entra a VR. El navegador debe permitir `immersive-vr` y seguimiento de manos.
2. Muestra una o ambas manos. El panel del laboratorio indica si fueron detectadas.
3. Haz pinza sobre **COMENZAR** en el panel 3D. El cronómetro empieza en ese momento.
4. Apunta con el rayo de una mano, mantén la pinza para tomar una figura, llévala al recipiente de su categoría y suéltala.
5. Espera a que la pieza quede estable. Solo entonces se confirma un acierto o un depósito equivocado.
6. Usa **REINICIAR** para volver a repartir las piezas y limpiar los contadores. Si sales de VR durante una partida, el cronómetro se pausa; al entrar de nuevo, puedes reanudar.

La figura no se teletransporta al recipiente. Al soltarla vuelve a ser un cuerpo dinámico, continúa sometida a gravedad y puede rebotar o chocar con otras superficies. Las piezas correctamente clasificadas quedan bloqueadas y se cuentan una sola vez.

## Qué se necesita

### Para consultar la portada y la vista previa

- Una computadora con navegador moderno.
- Conexión a Internet para cargar las bibliotecas fijadas en CDN.
- Visual Studio Code y la extensión Live Server para servir los archivos localmente por HTTP.

No se necesita Node.js, npm, un proceso de compilación ni un servidor propio.

### Para la experiencia inmersiva

- Meta Quest 3 con Meta Quest Browser.
- Una URL servida por HTTPS, como la publicación de GitHub Pages.
- Seguimiento de manos activado en el visor y autorización para iniciar VR.

La vista previa de escritorio sirve para observar la escena y la física, pero **no simula el seguimiento real de manos**. El `localhost` de la computadora tampoco es el `localhost` del visor.

## Tecnologías y carga de dependencias

- HTML5 semántico y CSS3 para la portada.
- Bootstrap **5.3.9**, cargado desde jsDelivr, solo para la página web inicial.
- JavaScript moderno mediante módulos ES.
- Three.js **0.187.0** para la escena WebGL, modelos geométricos, panel 3D y renderizado WebXR.
- cannon-es **0.20.0** para gravedad, cuerpos rígidos y colisiones.
- WebXR Device API para sesiones `immersive-vr` y articulaciones de manos.

Las versiones de Three.js y cannon-es están fijadas en el **import map de `index.html`**, antes del módulo `src/main.js`. El import map le indica al navegador qué URL CDN corresponde a los nombres `three`, `three/addons/` y `cannon-es`. Los módulos propios se importan con rutas relativas. El núcleo y los complementos de Three.js usan el mismo proveedor CDN y la misma versión.

## Arquitectura

La aplicación conserva una fuente de verdad para el estado de la partida y para cada pieza. Cada pieza relaciona un ID único, categoría, malla, cuerpo físico, estado, mesa de origen y recipiente asignado. Los indicadores `classified` y `counted`, junto con una validación que sale si la pieza ya fue clasificada, evitan que contactos repetidos sumen más de un acierto.

| Archivo o carpeta | Responsabilidad |
|---|---|
| `index.html` | Portada, metadatos, favicon, Bootstrap, import map y avisos de carga/compatibilidad. |
| `assets/css/site.css` | Estilos responsivos y accesibles de la página inicial. |
| `assets/icons/favicon.svg` | Favicon local. |
| `assets/models/Salon.glb` | Modelo optimizado del salón, cargado con GLTFLoader; `Salon.skp` es el archivo fuente editable. |
| `src/main.js` | Crea y conecta los módulos, coordina el ciclo de render y maneja errores y limpieza. |
| `src/scene/labScene.js` | Carga el salón, calcula su escala en metros, crea límites físicos y construye mesas, figuras, recipientes e iluminación. |
| `src/physics/physicsWorld.js` | Configura cannon-es, gravedad, materiales, paso fijo y sincronización entre cuerpos y mallas. |
| `src/xr/session.js` | Comprueba la compatibilidad e inicia o termina la sesión `immersive-vr`. |
| `src/xr/handTracking.js` | Obtiene poses de las manos, dibuja su representación y detecta la pinza con histéresis. |
| `src/interaction/interactionController.js` | Raycasting, selección, agarre, movimiento, liberación, asentamiento y clasificación. |
| `src/state/labState.js` | Estado central de piezas, fase, tiempo, puntuación, mensajes y manos. |
| `src/ui/vrPanel.js`, `src/ui/canvasUi.js` | Panel y controles dentro de VR, dibujados como contenido 3D y texturas; no son ventanas HTML superpuestas. |
| `src/audio/feedback.js` | Tonos breves de acierto, error y finalización generados con Web Audio. |
| `src/effects/celebration.js` | Confeti tridimensional al completar el reto. |

La física y el renderizado se actualizan desde el ciclo de animación de Three.js. Las mallas visibles se sincronizan con sus cuerpos de cannon-es después del paso físico.

## Decisiones de física y reglas

- Se usa cannon-es con gravedad de **−9.82 m/s²**, paso físico de **1/60 s**, hasta cinco subpasos y un solver de 12 iteraciones.
- Las mesas, el piso, las paredes y los recipientes tienen colisionadores estáticos. Cada recipiente está construido con base y paredes separadas; su boca queda abierta.
- El escenario se exporta de SketchUp a GLB. La aplicación calcula su caja envolvente para centrar el salón a la altura del piso y dimensionar colisionadores estáticos de perímetro. Las mesas del reto, las figuras y los recipientes siguen siendo objetos independientes.
- Cubos y esferas usan colisionadores sencillos. Pirámides y prismas usan formas convexas aproximadas para mantener bajo el costo de cálculo.
- Al tomar una pieza, su cuerpo permanece dinámico y se guía con una velocidad limitada hacia la mano; no se teletransporta. Así la gravedad y las colisiones con mesas y recipientes siguen activas durante el agarre. Al soltarla conserva el movimiento calculado por la física, con límites de velocidad para reducir sacudidas y penetraciones.
- Un objeto se valida después de quedar suficientemente quieto. La categoría debe coincidir con el recipiente asignado y el objeto debe estar dentro de su zona útil. No se cuenta solo por tocar el recipiente.
- Una colocación correcta suma una unidad y bloquea la pieza. Un recipiente equivocado genera un aviso y suma un error una sola vez por intento; la figura puede recuperarse y probarse otra vez.
- Una pieza fuera de los recipientes no se pierde: el marcador de recuperación ayuda a localizarla y volver a tomarla.
- La precisión se calcula como `aciertos / intentos confirmados × 100`. El tiempo de cada categoría se mide desde **COMENZAR** hasta su quinto acierto. Al salir de VR, el cronómetro se pausa.

Estas decisiones priorizan una interacción estable en un visor autónomo. Los colisionadores de las formas complejas son aproximaciones; los lanzamientos muy rápidos y las pilas de piezas pueden comportarse distinto de un objeto físico real.

## Ejecutar localmente

1. Abre esta carpeta en Visual Studio Code.
2. Inicia `index.html` con Live Server.
3. Consulta la portada y la vista previa. Si hay un problema de carga, revisa **Console** y **Network** en las herramientas del navegador: los errores de CDN, import map, rutas y CORS suelen aparecer ahí.

Para usar VR, abre la URL HTTPS publicada directamente en Meta Quest Browser y comienza la sesión mediante el botón de la página. La sesión necesita la acción explícita del usuario y seguimiento de manos disponible.

## Publicar en GitHub Pages

1. Publica los archivos del proyecto en la rama `main` del repositorio.
2. En GitHub abre **Settings → Pages**.
3. En **Build and deployment**, elige **Deploy from a branch**, rama `main` y carpeta `/(root)`.
4. Abre la URL HTTPS que proporciona GitHub Pages. Los recursos locales usan rutas relativas para funcionar aunque el sitio esté bajo `/nombre-del-repositorio/`.
5. Si una página no carga, revisa que el import map esté en `index.html`, que las rutas conserven `./` y que los CDN estén accesibles.

Repositorio del proyecto: <https://github.com/LlanderalArteaga/Interaccion_virtual>

Página publicada: <https://llanderalarteaga.github.io/Interaccion_virtual/>

La portada comprueba en tiempo de ejecución si el navegador ofrece `immersive-vr` y muestra un mensaje cuando la capacidad no está disponible. Esa comprobación no garantiza por sí sola que el seguimiento de manos esté activo: debe estar habilitado en Quest.

## Ajustar el contenido

Las categorías están definidas en `CATEGORY_SPECS` dentro de `src/scene/labScene.js`. Allí se especifican ID, nombre, color, geometría visible, colisionador y dimensiones aproximadas. Cambiar o añadir categorías también requiere mantener los mismos IDs en la creación de recipientes, el estado y el panel (`src/state/labState.js`, `createBins` en `src/scene/labScene.js` y `src/ui/canvasUi.js`).

El número de piezas por categoría se define en el bucle de creación de piezas. Las cuatro mesas están en `STATIONS` y sus cinco posiciones iniciales en `OBJECT_SLOTS`. Las dimensiones de las cajas se configuran en `createBins`. Ajustar una forma o recipiente puede requerir cambiar sus tolerancias de detección en `src/interaction/interactionController.js`.

## Créditos y licencias

**Desarrollador y autor:** Axel Llanderal Arteaga.

La escena, las figuras, las mesas, los recipientes, el panel, el marcador de recuperación y el confeti se generan en el código del proyecto. Los sonidos se sintetizan localmente con Web Audio. No se utilizan modelos externos ni se recopilan datos personales.

- Three.js — licencia MIT: <https://github.com/mrdoob/three.js>
- cannon-es — licencia MIT: <https://github.com/pmndrs/cannon-es>
- Bootstrap — licencia MIT: <https://github.com/twbs/bootstrap>
- Ejemplo de referencia para interacción WebXR: <https://threejs.org/examples/?q=vr#webxr_vr_handinput_pointerdrag>
- Documentación de seguimiento de manos WebXR de Meta: <https://developers.meta.com/vr/documentation/web/webxr-hands/>
- Documentación de cannon-es: <https://pmndrs.github.io/cannon-es/>

## Alcance y limitaciones

La aplicación es estática: no necesita backend, base de datos ni guarda partidas. El movimiento, la gravedad, el agarre, el conteo, el reinicio y los mensajes se ejecutan en el navegador. La vista previa de escritorio no sustituye una sesión inmersiva ni permite afirmar que el seguimiento funciona en el visor. El rendimiento y los casos de colisión complejos dependen del navegador y del dispositivo donde se ejecute.
