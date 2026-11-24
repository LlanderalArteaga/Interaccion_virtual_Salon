# Modelos 3D del escenario

Coloca aquí:

- `Salon.skp`: archivo editable original para revisar medidas y organización del modelo.
- `Salon.glb`: exportación binaria glTF que cargará Three.js en la aplicación web.

En SketchUp, exporta con **Archivo → Exportar → Modelo 3D → GLTF Binary File (*.glb)**. Mantén las unidades y el origen del dibujo; evita exportar la cámara del modelo como si fuera el punto de vista de WebXR.

Para reemplazar únicamente el escenario del laboratorio, conserva en el modelo el salón (piso, paredes, puertas, ventanas y techo) y separa u oculta mobiliario que no deba duplicarse. Las cuatro mesas de la práctica, las figuras y los recipientes seguirán siendo objetos propios de la aplicación y conservarán sus colisionadores.
