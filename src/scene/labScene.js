import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createTextPlane } from '../ui/canvasUi.js';
import {
	CANNON,
	createBoxBody,
	createPyramidShape,
	createPhysicsWorld,
	createRoundPrismShape,
	resetDynamicBody,
	stepPhysics,
	syncPhysicsMeshes
} from '../physics/physicsWorld.js';

export const TABLETOP_Y = 0.75;
const TABLE_SIZE = 0.68;
const OBJECT_MASS_KG = 0.18;
const CATEGORY_SPECS = Object.freeze([
	{ id: 'cube', name: 'CUBO', color: 0xe7a36d, geometry: () => new THREE.BoxGeometry(0.13, 0.13, 0.13), shape: () => new CANNON.Box(new CANNON.Vec3(0.065, 0.065, 0.065)), halfHeight: 0.065, radius: 0.092 },
	{ id: 'sphere', name: 'ESFERA', color: 0x74c8dc, geometry: () => new THREE.SphereGeometry(0.071, 16, 12), shape: () => new CANNON.Sphere(0.071), halfHeight: 0.071, radius: 0.071 },
	{ id: 'pyramid', name: 'PIRÁMIDE', color: 0xc0a0f2, geometry: () => new THREE.ConeGeometry(0.078, 0.15, 4), shape: () => createPyramidShape(0.078, 0.15), halfHeight: 0.075, radius: 0.078 },
	{ id: 'hex-prism', name: 'PRISMA HEXAGONAL', color: 0xf0cf76, geometry: () => new THREE.CylinderGeometry(0.073, 0.073, 0.15, 6), shape: () => createRoundPrismShape(0.073, 0.15, 6), halfHeight: 0.075, radius: 0.073 }
]);

const STATIONS = Object.freeze([
	// Cuatro mesas alineadas de izquierda a derecha, dentro del alcance frontal.
	{ id: 'row-1', x: -1.08, z: -0.62, rotation: 0 },
	{ id: 'row-2', x: -0.36, z: -0.62, rotation: 0 },
	{ id: 'row-3', x: 0.36, z: -0.62, rotation: 0 },
	{ id: 'row-4', x: 1.08, z: -0.62, rotation: 0 }
]);

const OBJECT_SLOTS = Object.freeze([
	{ x: -0.22, z: -0.11 }, { x: 0, z: -0.11 }, { x: 0.22, z: -0.11 },
	{ x: -0.11, z: 0.15 }, { x: 0.11, z: 0.15 }
]);

export function createLabScene(previewElement) {
	if (!previewElement) throw new Error('No se encontró el contenedor de la vista previa 3D.');
	const scene = new THREE.Scene();
	// Ambiente opaco creado en Three.js: no usa cámara ni passthrough.
	scene.background = new THREE.Color('#526b68');
	scene.fog = null;
	const camera = new THREE.PerspectiveCamera(54, 1, 0.05, 18);
	camera.position.set(0.1, 1.6, 2.4);
	camera.lookAt(0.05, 0.7, -0.9);

	const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.setSize(previewElement.clientWidth || 640, previewElement.clientHeight || 340, false);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.1;
	renderer.xr.enabled = true;
	renderer.xr.setReferenceSpaceType('local-floor');
	previewElement.appendChild(renderer.domElement);

	addLights(scene);
	const physicsWorld = createPhysicsWorld();
	const physicsMaterials = createPhysicsMaterials(physicsWorld);
	const room = createRoom(scene, physicsWorld, physicsMaterials.surface);
	const environmentReady = loadSalonEnvironment(scene, physicsWorld, physicsMaterials.surface, room);
	const stations = createStations(scene, physicsWorld, physicsMaterials.surface);
	const bins = createBins(scene, physicsWorld, physicsMaterials.surface);
	const pieces = createPieces(scene, physicsWorld, physicsMaterials.object);
	let previousLayoutSignature = '';
	const resetLayout = () => {
		let signature = '';
		let attempts = 0;
		do {
			resetPieceLayout(pieces, stations);
			signature = getLayoutSignature(pieces);
			attempts += 1;
		} while (signature === previousLayoutSignature && attempts < 4);
		if (signature === previousLayoutSignature) {
			const firstPiece = pieces[0];
			firstPiece.startPosition.x += 0.01;
			resetDynamicBody(firstPiece.body, firstPiece.startPosition, firstPiece.startQuaternion);
			signature = getLayoutSignature(pieces);
		}
		previousLayoutSignature = signature;
	};
	const resizeObserver = new ResizeObserver(() => {
		const width = Math.max(1, previewElement.clientWidth);
		const height = Math.max(1, previewElement.clientHeight);
		renderer.setSize(width, height, false);
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
	});
	resizeObserver.observe(previewElement);

	const app = {
		scene, camera, renderer, physicsWorld, stations, bins, pieces, environmentReady,
		getBoardPlacement() {
			return room.boardPlacement ?? null;
		},
		stepPhysics(deltaSeconds) {
			stepPhysics(physicsWorld, deltaSeconds);
			syncPhysicsMeshes(pieces);
			updateRecoveryMarkers(pieces);
		},
		resetLayout,
		disposeLayout() {
			resizeObserver.disconnect();
			room.disposed = true;
		}
	};
	resetLayout();
	return app;
}

function addLights(scene) {
	scene.add(new THREE.HemisphereLight(0xe5f6ef, 0x53635b, 2.15));
	const key = new THREE.DirectionalLight(0xffedcf, 2.25);
	key.position.set(-2.5, 4, 2.5);
	scene.add(key);
	const fill = new THREE.DirectionalLight(0x8cdbd2, 1.0);
	fill.position.set(2, 2.5, -2);
	scene.add(fill);
}

function createPhysicsMaterials(world) {
	const surface = new CANNON.Material('laboratory-surface');
	const object = new CANNON.Material('laboratory-object');
	world.defaultContactMaterial.friction = 0.58;
	world.defaultContactMaterial.restitution = 0.3;
	world.addContactMaterial(new CANNON.ContactMaterial(object, surface, { friction: 0.66, restitution: 0.28 }));
	world.addContactMaterial(new CANNON.ContactMaterial(object, object, { friction: 0.48, restitution: 0.36 }));
	return { surface, object };
}

function createRoom(scene, world, surfaceMaterial) {
	const visuals = new THREE.Group();
	visuals.name = 'procedural-room-fallback';
	scene.add(visuals);
	const bodies = [];
	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(5, 5),
		new THREE.MeshStandardMaterial({ color: '#405b58', roughness: 0.94 })
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.y = -0.01;
	visuals.add(floor);
	const floorBody = new CANNON.Body({ mass: 0, material: surfaceMaterial });
	floorBody.addShape(new CANNON.Plane());
	floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
	floorBody.position.y = -0.01;
	world.addBody(floorBody);
	bodies.push(floorBody);

	const grid = new THREE.GridHelper(5, 25, '#9ab9a8', '#627f76');
	grid.position.y = 0.003;
	grid.material.transparent = true;
	grid.material.opacity = 0.28;
	visuals.add(grid);
	const wallMaterial = new THREE.MeshStandardMaterial({ color: '#536d66', roughness: 0.9, side: THREE.DoubleSide });
	bodies.push(addRoomWall(visuals, world, wallMaterial, surfaceMaterial, { x: 0, y: 1.35, z: -2.5, width: 5, height: 2.7, horizontal: true }));
	bodies.push(addRoomWall(visuals, world, wallMaterial, surfaceMaterial, { x: 0, y: 1.35, z: 2.5, width: 5, height: 2.7, horizontal: true }));
	bodies.push(addRoomWall(visuals, world, wallMaterial, surfaceMaterial, { x: -2.5, y: 1.35, z: 0, width: 5, height: 2.7, horizontal: false }));
	bodies.push(addRoomWall(visuals, world, wallMaterial, surfaceMaterial, { x: 2.5, y: 1.35, z: 0, width: 5, height: 2.7, horizontal: false }));
	addMakerLabDecor(visuals);
	return { visuals, bodies, disposed: false };
}

// Ventanales estilizados y luminarias de color. Son decoración opaca, sin colisionadores:
// las paredes físicas existentes siguen definiendo exactamente los límites del laboratorio.
function addMakerLabDecor(parent) {
	const frame = new THREE.MeshStandardMaterial({ color: '#263f3e', roughness: 0.55, metalness: 0.18 });
	const glass = new THREE.MeshBasicMaterial({ color: '#a0d9cd' });
	const glassShade = new THREE.MeshBasicMaterial({ color: '#81bcb6' });
	const backWallZ = -2.435;
	for (const centerX of [-1.55, 0, 1.55]) {
		const windowGroup = new THREE.Group();
		windowGroup.position.set(centerX, 1.88, backWallZ);
		const outer = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.78, 0.055), frame);
		const pane = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.68, 0.018), glass);
		pane.position.z = 0.038;
		const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.68, 0.024), frame);
		mullion.position.z = 0.052;
		const sill = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.045, 0.09), frame);
		sill.position.set(0, -0.405, 0.02);
		windowGroup.add(outer, pane, mullion, sill);
		// Banda de color para dar profundidad visual sin usar imágenes externas.
		const accent = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.045, 0.022), glassShade);
		accent.position.set(0, -0.20, 0.052);
		windowGroup.add(accent);
		parent.add(windowGroup);
	}

	const ceiling = new THREE.Mesh(
		new THREE.PlaneGeometry(5, 5),
		new THREE.MeshStandardMaterial({ color: '#718780', roughness: 0.96, side: THREE.DoubleSide })
	);
	ceiling.rotation.x = Math.PI / 2;
	ceiling.position.y = 2.72;
	parent.add(ceiling);

	const lampMaterial = new THREE.MeshBasicMaterial({ color: '#ffe9b5' });
	for (const x of [-1.2, 0.35, 1.65]) {
		const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.025, 0.20), lampMaterial);
		lamp.position.set(x, 2.68, -0.75);
		parent.add(lamp);
	}
}

function addRoomWall(parent, world, material, surfaceMaterial, spec) {
	const wall = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), material);
	wall.position.set(spec.x, spec.y, spec.z);
	if (!spec.horizontal) wall.rotation.y = Math.PI / 2;
	parent.add(wall);
	const half = spec.horizontal
		? new CANNON.Vec3(spec.width / 2, spec.height / 2, 0.06)
		: new CANNON.Vec3(0.06, spec.height / 2, spec.width / 2);
	return createBoxBody(world, { position: spec, halfExtents: half, material: surfaceMaterial });
}

async function loadSalonEnvironment(scene, world, surfaceMaterial, room) {
	const modelUrl = new URL('../../assets/models/Salon.glb', import.meta.url);
	try {
		const gltf = await new GLTFLoader().loadAsync(modelUrl.href);
		if (room.disposed) return false;

		const model = gltf.scene;
		const ignoredNodes = [];
		model.traverse(object => {
			const name = object.name.toLowerCase();
			// Oculta el componente de escala de SketchUp; la altura real la define el visor.
			if (name.includes('thomthom') || name === 'active view') ignoredNodes.push(object);
		});
		for (const object of ignoredNodes) object.removeFromParent();
		// El GLB de SketchUp usa Z como eje vertical; se orienta a Y-up y al frente de la vista.
		model.rotation.set(-Math.PI / 2, Math.PI, 0);
		model.updateMatrixWorld(true);
		const bounds = new THREE.Box3().setFromObject(model);
		const size = bounds.getSize(new THREE.Vector3());
		if (!Number.isFinite(size.x) || size.x < 2 || size.y < 2 || size.z < 2) {
			throw new Error(`El salón tiene dimensiones inválidas (${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m).`);
		}

		const center = bounds.getCenter(new THREE.Vector3());
		const anchor = new THREE.Group();
		anchor.name = 'salon-virtual';
		anchor.position.set(-center.x, -bounds.min.y, -center.z);
		anchor.add(model);
		scene.add(anchor);
		anchor.updateMatrixWorld(true);
		const board = model.getObjectByName('pizarron_pizarron')
			?? model.getObjectByName('pizarron');
		if (board) {
			const boardBounds = new THREE.Box3().setFromObject(board);
			const boardSize = boardBounds.getSize(new THREE.Vector3());
			const boardCenter = boardBounds.getCenter(new THREE.Vector3());
			const normalAxis = boardSize.x <= boardSize.y && boardSize.x <= boardSize.z
				? 'x'
				: boardSize.y <= boardSize.z ? 'y' : 'z';
			const towardRoom = new THREE.Vector3().subVectors(new THREE.Vector3(), boardCenter);
			const normal = new THREE.Vector3();
			normal[normalAxis] = Math.sign(towardRoom[normalAxis]) || 1;
			const position = boardCenter.clone().addScaledVector(normal, 0.24);
			room.boardPlacement = { position, target: position.clone().add(normal) };
		}

		room.visuals.visible = false;
		for (const body of room.bodies) world.removeBody(body);
		room.bodies = createRoomColliders(world, surfaceMaterial, size.x, size.z, size.y);
		scene.background = new THREE.Color('#52615c');
		console.info(`Salón cargado: ${size.x.toFixed(2)} m × ${size.z.toFixed(2)} m × ${size.y.toFixed(2)} m.`);
		return true;
	} catch (error) {
		console.error('No se pudo cargar assets/models/Salon.glb; se mantiene el escenario provisional.', error);
		return false;
	}
}

function createRoomColliders(world, surfaceMaterial, width, depth, height) {
	const bodies = [];
	const floor = new CANNON.Body({ mass: 0, material: surfaceMaterial });
	floor.addShape(new CANNON.Plane());
	floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
	floor.position.y = 0;
	world.addBody(floor);
	bodies.push(floor);

	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const wallThickness = 0.16;
	const wallHeight = Math.max(height, 2.7);
	const wallY = wallHeight / 2;
	for (const z of [-halfDepth, halfDepth]) {
		bodies.push(createBoxBody(world, {
			position: { x: 0, y: wallY, z },
			halfExtents: new CANNON.Vec3(halfWidth, wallHeight / 2, wallThickness / 2),
			material: surfaceMaterial
		}));
	}
	for (const x of [-halfWidth, halfWidth]) {
		bodies.push(createBoxBody(world, {
			position: { x, y: wallY, z: 0 },
			halfExtents: new CANNON.Vec3(wallThickness / 2, wallHeight / 2, halfDepth),
			material: surfaceMaterial
		}));
	}
	return bodies;
}

function createStations(scene, world, surfaceMaterial) {
	const topMaterial = new THREE.MeshStandardMaterial({ color: '#293941', roughness: 0.68, metalness: 0.08 });
	const legMaterial = new THREE.MeshStandardMaterial({ color: '#26343a', roughness: 0.8 });
	return STATIONS.map((station, index) => {
		const group = new THREE.Group();
		group.position.set(station.x, 0, station.z);
		group.rotation.y = station.rotation;
		const top = new THREE.Mesh(new THREE.BoxGeometry(TABLE_SIZE, 0.07, TABLE_SIZE), topMaterial);
		top.position.y = TABLETOP_Y - 0.035;
		group.add(top);
		createBoxBody(world, {
			position: { x: station.x, y: TABLETOP_Y - 0.035, z: station.z },
			halfExtents: new CANNON.Vec3(TABLE_SIZE / 2, 0.035, TABLE_SIZE / 2), material: surfaceMaterial
		});
		for (const x of [-0.36, 0.36]) {
			for (const z of [-0.36, 0.36]) {
				const leg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.70, 0.065), legMaterial);
				leg.position.set(x, 0.35, z);
				group.add(leg);
				const worldPoint = rotateLocalPoint(station, x, z);
				createBoxBody(world, {
					position: { x: worldPoint.x, y: 0.35, z: worldPoint.z },
					halfExtents: new CANNON.Vec3(0.0325, 0.35, 0.0325), material: surfaceMaterial
				});
			}
		}
		const label = createTextPlane(`MESA ${index + 1}`, { worldWidth: 0.34, worldHeight: 0.06, fontSize: 34, background: 'rgba(12, 20, 26, 0.96)', color: '#e8efeb' });
		label.position.set(0, TABLETOP_Y + 0.12, -0.35);
		group.add(label);
		scene.add(group);
		return { ...station, id: `table-${index + 1}`, size: TABLE_SIZE, topY: TABLETOP_Y, group };
	});
}

function createBins(scene, world, surfaceMaterial) {
	const positions = [
		{ x: -0.90, z: 0.52 }, { x: -0.30, z: 0.52 },
		{ x: 0.30, z: 0.52 }, { x: 0.90, z: 0.52 }
	];
	return CATEGORY_SPECS.map((category, index) => {
		const position = positions[index];
		const group = new THREE.Group();
		group.position.set(position.x, 0, position.z);
		const standMaterial = new THREE.MeshStandardMaterial({ color: '#283940', roughness: 0.78 });
		const innerHalf = category.id === 'pyramid' ? 0.17 : 0.19;
		const wallHeight = category.id === 'pyramid' ? 0.36 : 0.38;
		const wallThickness = 0.025;
		const outerHalf = innerHalf + wallThickness;
		const standSize = outerHalf * 2 + 0.04;
		const stand = new THREE.Mesh(new THREE.BoxGeometry(standSize, 0.39, standSize), standMaterial);
		stand.position.y = 0.195;
		group.add(stand);
		createBoxBody(world, {
			position: { x: position.x, y: 0.195, z: position.z },
			halfExtents: new CANNON.Vec3(standSize / 2, 0.195, standSize / 2), material: surfaceMaterial
		});

		const baseY = 0.39;
		const baseThickness = 0.04;
		const bodyMaterial = new THREE.MeshStandardMaterial({ color: category.color, roughness: 0.42, metalness: 0.08, transparent: true, opacity: 0.78, side: THREE.DoubleSide });
		addBinPart(group, world, surfaceMaterial, bodyMaterial, position, 0, baseY + baseThickness / 2, 0, innerHalf * 2 + wallThickness * 2, baseThickness, innerHalf * 2 + wallThickness * 2);
		addBinPart(group, world, surfaceMaterial, bodyMaterial, position, -outerHalf, baseY + baseThickness + wallHeight / 2, 0, wallThickness, wallHeight, innerHalf * 2 + wallThickness * 2);
		addBinPart(group, world, surfaceMaterial, bodyMaterial, position, outerHalf, baseY + baseThickness + wallHeight / 2, 0, wallThickness, wallHeight, innerHalf * 2 + wallThickness * 2);
		addBinPart(group, world, surfaceMaterial, bodyMaterial, position, 0, baseY + baseThickness + wallHeight / 2, -outerHalf, innerHalf * 2, wallHeight, wallThickness);
		addBinPart(group, world, surfaceMaterial, bodyMaterial, position, 0, baseY + baseThickness + wallHeight / 2, outerHalf, innerHalf * 2, wallHeight, wallThickness);

		const label = createTextPlane(category.name, { worldWidth: category.id === 'hex-prism' ? 0.42 : 0.32, worldHeight: 0.065, fontSize: 29, background: 'rgba(12, 20, 26, 0.96)', color: '#f6f3e9' });
		label.position.set(0, baseY + baseThickness + wallHeight + 0.08, 0);
		group.add(label);
		scene.add(group);
		return { id: category.id, name: category.name, color: category.color, group, position: new THREE.Vector3(position.x, baseY, position.z), innerHalf, wallHeight, floorY: baseY + baseThickness };
	});
}

function addBinPart(group, world, surfaceMaterial, visualMaterial, binPosition, localX, y, localZ, width, height, depth) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), visualMaterial);
	mesh.position.set(localX, y, localZ);
	group.add(mesh);
	createBoxBody(world, {
		position: { x: binPosition.x + localX, y, z: binPosition.z + localZ },
		halfExtents: new CANNON.Vec3(width / 2, height / 2, depth / 2), material: surfaceMaterial
	});
}

function createPieces(scene, world, objectMaterial) {
	const pieces = [];
	const recoveryRingGeometry = new THREE.TorusGeometry(0.13, 0.009, 6, 24);
	const recoveryBeamGeometry = new THREE.CylinderGeometry(0.008, 0.008, 0.52, 6);
	const recoveryMaterial = new THREE.MeshBasicMaterial({ color: '#75f5d0', transparent: true, opacity: 0.86 });
	for (const category of CATEGORY_SPECS) {
		for (let index = 0; index < 5; index += 1) {
			const root = new THREE.Group();
			const material = new THREE.MeshStandardMaterial({ color: category.color, roughness: 0.36, metalness: 0.06, emissive: '#000000', emissiveIntensity: 0.35 });
			const mesh = new THREE.Mesh(category.geometry(), material);
			mesh.castShadow = false;
			mesh.receiveShadow = true;
			mesh.userData.pieceId = `${category.id}-${index + 1}`;
			root.add(mesh);
			scene.add(root);
			const recoveryMarker = new THREE.Group();
			const ring = new THREE.Mesh(recoveryRingGeometry, recoveryMaterial);
			ring.rotation.x = -Math.PI / 2;
			const beam = new THREE.Mesh(recoveryBeamGeometry, recoveryMaterial);
			beam.position.y = 0.27;
			recoveryMarker.add(ring, beam);
			recoveryMarker.visible = false;
			scene.add(recoveryMarker);
			const body = new CANNON.Body({
				mass: OBJECT_MASS_KG,
				material: objectMaterial,
				shape: category.shape(),
				linearDamping: 0.025,
				angularDamping: 0.12,
				allowSleep: true,
				sleepSpeedLimit: 0.12,
				sleepTimeLimit: 0.65
			});
			body.updateMassProperties();
			world.addBody(body);
			pieces.push({
				id: `${category.id}-${index + 1}`,
				name: category.name,
				categoryId: category.id,
				category,
				status: 'available',
				root,
				recoveryMarker,
				mesh,
				material,
				body,
				massKg: OBJECT_MASS_KG,
				halfHeight: category.halfHeight,
				boundingRadius: category.radius,
				homeTableId: null,
				assignedBinId: category.id,
				classified: false,
				counted: false,
				restingSince: null,
				wrongFeedbackShown: false,
				startPosition: new THREE.Vector3(),
				startQuaternion: new THREE.Quaternion()
			});
		}
	}
	return pieces;
}

function resetPieceLayout(pieces, stations) {
	const shuffledPieces = shuffle([...pieces]);
	let cursor = 0;
	for (const station of stations) {
		const slots = shuffle([...OBJECT_SLOTS]);
		const quarterTurns = Math.floor(Math.random() * 4);
		for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
			const piece = shuffledPieces[cursor++];
			const slot = rotateSlot(slots[slotIndex], quarterTurns);
			const localX = slot.x + (Math.random() - 0.5) * 0.018;
			const localZ = slot.z + (Math.random() - 0.5) * 0.018;
			const worldPoint = rotateLocalPoint(station, localX, localZ);
			const position = new THREE.Vector3(worldPoint.x, TABLETOP_Y + piece.halfHeight + 0.018, worldPoint.z);
			const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
			piece.homeTableId = station.id;
			piece.status = 'available';
			piece.classified = false;
			piece.counted = false;
			piece.restingSince = null;
			piece.wrongFeedbackShown = false;
			piece.recoveryMarker.visible = false;
			piece.material.emissive.set('#000000');
			piece.body.type = CANNON.Body.DYNAMIC;
			piece.body.mass = piece.massKg;
			piece.body.updateMassProperties();
			piece.startPosition.copy(position);
			piece.startQuaternion.copy(quaternion);
			resetDynamicBody(piece.body, position, quaternion);
		}
	}
}

function updateRecoveryMarkers(pieces) {
	for (const piece of pieces) {
		const { x, y, z } = piece.body.position;
		const shouldShow = !piece.classified && piece.status !== 'held' && y < 0.24;
		piece.recoveryMarker.visible = shouldShow;
		if (shouldShow) piece.recoveryMarker.position.set(x, 0.012, z);
	}
}

function rotateSlot(slot, quarterTurns) {
	if (quarterTurns === 1) return { x: -slot.z, z: slot.x };
	if (quarterTurns === 2) return { x: -slot.x, z: -slot.z };
	if (quarterTurns === 3) return { x: slot.z, z: -slot.x };
	return slot;
}

function rotateLocalPoint(station, x, z) {
	const cosine = Math.cos(station.rotation);
	const sine = Math.sin(station.rotation);
	return {
		x: station.x + x * cosine + z * sine,
		z: station.z - x * sine + z * cosine
	};
}

function shuffle(items) {
	for (let index = items.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[items[index], items[swapIndex]] = [items[swapIndex], items[index]];
	}
	return items;
}

function getLayoutSignature(pieces) {
	return pieces
		.slice()
		.sort((first, second) => first.id.localeCompare(second.id))
		.map(piece => `${piece.id}:${piece.homeTableId}:${piece.startPosition.x.toFixed(3)},${piece.startPosition.z.toFixed(3)},${piece.startQuaternion.y.toFixed(3)},${piece.startQuaternion.w.toFixed(3)}`)
		.join('|');
}
