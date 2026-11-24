import * as THREE from 'three';
import { createHudTexture, createTextPlane, drawHud } from './canvasUi.js';

export function createVrPanel(scene, actions) {
	const group = new THREE.Group();
	const { canvas, texture } = createHudTexture();
	drawHud(canvas, actions.getState());
	const panel = new THREE.Mesh(
		new THREE.PlaneGeometry(0.82, 1.12),
		new THREE.MeshBasicMaterial({ map: texture, transparent: false, side: THREE.DoubleSide, depthWrite: true })
	);
	group.add(panel);
	// Fijo al mundo: el panel no sigue la cabeza ni gira con la vista.
	group.position.set(-1.3, 1.95, 1.5);
	group.lookAt(0, 0, 0);

	const controls = [
		createControl('reset', 'REINICIAR', -0.25, 0x2f5961, actions.reset),
		createControl('begin', getBeginLabel(actions.getState()), 0, 0x376f58, actions.begin),
		createControl('exit', 'SALIR DE VR', 0.25, 0x73484a, actions.exit)
	];
	for (const control of controls) group.add(control.group);
	scene.add(group);

	let lastRevision = -1;
	let lastTimeSecond = -1;
	let lastProgressSignature = '';
	let hoveredControlId = null;
	let lastBeginLabel = getBeginLabel(actions.getState());
	return {
		group,
		controls: controls.map(control => control.hitMesh),
		update(state, now) {
			const beginLabel = getBeginLabel(state);
			if (beginLabel !== lastBeginLabel) {
				const beginControl = controls.find(control => control.id === 'begin');
				updateTextPlane(beginControl.label, beginLabel);
				lastBeginLabel = beginLabel;
			}
			const timeSecond = Math.floor(now / 1000);
			const progressSignature = state.pieces.map(piece => piece.classified ? '1' : '0').join('');
			if (lastRevision !== state.ui.revision || lastTimeSecond !== timeSecond || lastProgressSignature !== progressSignature) {
				drawHud(canvas, state, now);
				texture.needsUpdate = true;
				lastRevision = state.ui.revision;
				lastTimeSecond = timeSecond;
				lastProgressSignature = progressSignature;
			}
		},
		setHovered(controlId) {
			if (hoveredControlId === controlId) return;
			hoveredControlId = controlId;
			for (const control of controls) {
				const active = control.id === controlId;
				control.hitMesh.material.color.set(active ? '#d3fff0' : control.baseColor);
				control.hitMesh.scale.setScalar(active ? 1.07 : 1);
			}
		},
		dispose() {
			scene.remove(group);
			texture.dispose();
			panel.geometry.dispose();
			panel.material.dispose();
			for (const control of controls) {
				control.hitMesh.geometry.dispose();
				control.hitMesh.material.dispose();
				control.label.geometry.dispose();
				control.label.material.map?.dispose();
				control.label.material.dispose();
			}
		}
	};
}

function createControl(id, label, x, color, action) {
	const group = new THREE.Group();
	group.position.set(x, -0.37, 0.018);
	const buttonWidth = 0.22;
	const hitMesh = new THREE.Mesh(
		new THREE.BoxGeometry(buttonWidth, 0.09, 0.035),
		new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.08 })
	);
	hitMesh.userData.controlId = id;
	hitMesh.userData.action = action;
	group.add(hitMesh);
	const labelPlane = createTextPlane(label, { worldWidth: buttonWidth - 0.012, worldHeight: 0.065, width: 512, height: 128, fontSize: 34, background: 'rgba(0,0,0,0)', color: '#f6fbf8' });
	labelPlane.position.z = 0.022;
	group.add(labelPlane);
	return { id, group, hitMesh, label: labelPlane, baseColor: `#${color.toString(16).padStart(6, '0')}`, action };
}

function getBeginLabel(state) {
	if (state.phase === 'active') return 'EN CURSO';
	if (state.phase === 'paused') return 'REANUDAR';
	if (state.phase === 'complete') return 'FINALIZADO';
	return 'COMENZAR';
}

function updateTextPlane(mesh, text) {
	const canvas = mesh.userData.canvas;
	const context = canvas.getContext('2d');
	context.clearRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = 'rgba(0, 0, 0, 0)';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.fillStyle = '#f6fbf8';
	context.font = '700 34px system-ui, sans-serif';
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 28);
	mesh.userData.texture.needsUpdate = true;
}
