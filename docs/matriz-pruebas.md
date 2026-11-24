# Matriz de pruebas de aceptación

**Regla de evidencia:** una función presente en el código no equivale a una prueba aprobada. Registra fecha, dispositivo/navegador y captura, grabación o log por cada ejecución. No marques “Aprobado” sin evidencia.

| # | Requisito | Procedimiento | Resultado esperado | Resultado observado | Evidencia |
|---:|---|---|---|---|---|
| 1 | Portada Bootstrap responsiva, favicon, autor y créditos | Abrir portada en escritorio y móvil; verificar favicon y pie | Diseño adaptable, recursos cargados y crédito Axel Llanderal Arteaga visible | Pendiente de prueba documentada | Captura escritorio + móvil |
| 2 | `immersive-vr` en Meta Quest 3 desde Pages HTTPS | Abrir URL publicada en Quest Browser e iniciar VR desde la portada | Sesión inmersiva real; sin modo AR/MR/passthrough | Pendiente de prueba documentada | Video/captura del visor + URL |
| 3 | Seguimiento de ambas manos y pinza real | Mostrar cada mano por separado; apuntar, sujetar y soltar sin usar controles | Ambas manos se detectan; rayo y pinza manipulan piezas | Pendiente de prueba documentada | Video de cada mano |
| 4 | Cuatro mesas y cinco objetos en cada una | Contar objetos al comenzar y después del reinicio | Exactamente cuatro mesas y cinco objetos iniciales por mesa | Pendiente de prueba documentada | Captura panorámica |
| 5 | Veinte piezas, cinco de cada categoría | Revisar piezas y contadores iniciales | 20 piezas: 5 cubos, 5 esferas, 5 pirámides y 5 prismas hexagonales | Pendiente de prueba documentada | Captura del laboratorio/HUD |
| 6 | Reinicio con distribución válida y distinta | Reiniciar varias veces; comparar mesas y separaciones | Cambia la distribución, sin piezas duplicadas, solapadas o flotando | Pendiente de prueba documentada | Dos capturas antes/después |
| 7 | Cuatro recipientes abiertos con colisiones | Inspeccionar boca, base, paredes y etiquetas; introducir piezas | Sin tapa invisible; las paredes y el fondo contienen las figuras | Pendiente de prueba documentada | Capturas de los cuatro recipientes |
| 8 | Gravedad, rebote y reposo | Soltar/lanzar piezas al piso y a una mesa | Caen, rebotan según el material y terminan en reposo | Pendiente de prueba documentada | Video continuo |
| 9 | Contacto entre cuerpos y contenedores | Lanzar piezas contra otras piezas y paredes de recipientes | Colisionan sin atravesar recipientes ni superficies | Pendiente de prueba documentada | Video de colisiones |
| 10 | Agarre cinemático y liberación dinámica | Sujetar una pieza, moverla, rotarla y soltarla | Sigue la mano; al soltar recupera gravedad, colisiones y velocidad limitada | Pendiente de prueba documentada | Video continuo |
| 11 | Acierto estable, categoría correcta y conteo único | Depositar una pieza correcta; esperar; observar al menos varios segundos | Suma exactamente una vez al quedar estable dentro del recipiente correcto | Pendiente de prueba documentada | Video/HUD antes y después |
| 12 | Tres depósitos equivocados | Depositar tres piezas en recipientes incorrectos | Aviso por intento, aumenta error/intento, no aumenta acierto y permite recuperar | Pendiente de prueba documentada | Video/HUD de cada error |
| 13 | Recuperación tras caída al piso | Dejar caer una pieza fuera de las mesas y tomarla con el rayo | El marcador ayuda a localizarla y se puede volver a sujetar | Pendiente de prueba documentada | Video |
| 14 | Progreso global y por categoría de 0/5 a 20/20 | Completar los recipientes y observar el panel | Global 0/20→20/20 y cada categoría 0/5→5/5, sin duplicaciones | Pendiente de prueba documentada | Video/capturas de progreso |
| 15 | Intentos, precisión, errores y tiempos por recipiente | Hacer depósitos correctos/incorrectos y completar cada categoría | Precisión = aciertos ÷ intentos confirmados × 100; cada recipiente registra tiempo desde COMENZAR hasta 5/5 | Pendiente de prueba documentada | Captura del HUD final y cálculos |
| 16 | Cronómetro final | Completar 20/20 y esperar | El tiempo se detiene y queda visible en el resumen | Pendiente de prueba documentada | Video/captura final |
| 17 | Reinicio durante la partida y después de ganar | Reiniciar en ambos estados | Piezas y métricas vuelven a cero; se presenta una nueva distribución | Pendiente de prueba documentada | Video de ambos casos |
| 18 | Carga web sin errores críticos | Abrir escritorio con DevTools; revisar Console y Network | Módulos, CDN y rutas sin errores críticos ni 404/CORS | Pendiente de prueba documentada | Capturas Console/Network |
| 19 | URLs públicas | Abrir el repositorio y Pages en una ventana privada; probar subruta publicada | Repo y página accesibles públicamente por HTTPS | Pendiente de prueba documentada | URL del repositorio + URL de Pages |
| 20 | Evidencia y reflexión del alumno | Entregar video de partida, dos problemas corregidos y conclusiones | Video muestra interacción real; alumno documenta resultados y aprendizaje | Pendiente de entrega | URL del video + texto de conclusiones |

## Criterio para completar el registro

En “Resultado observado” escribe qué ocurrió, no solo “funciona”. En “Evidencia” pega una URL o nombre de archivo. Las pruebas 2, 3, 8–17 y cualquier afirmación de rendimiento deben ejecutarse en Meta Quest 3; la vista previa de escritorio no las sustituye. Registra fallos y repite la prueba después de corregirlos.
