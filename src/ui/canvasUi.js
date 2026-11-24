import * as THREE from 'three';
import { formatTime, getAccuracy, getElapsedMs, getProgress } from '../state/labState.js';

export function createTextPlane(text, options = {}) {
	const width = options.width ?? 512;
	const height = options.height ?? 128;
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext('2d');
	context.clearRect(0, 0, width, height);
	context.fillStyle = options.background ?? 'rgba(10, 18, 26, 0.94)';
	context.fillRect(0, 0, width, height);
	context.fillStyle = options.color ?? '#f2f1eb';
	context.font = `700 ${options.fontSize ?? 42}px system-ui, sans-serif`;
	context.textAlign = 'center';
	context.textBaseline = 'middle';
	context.fillText(text, width / 2, height / 2, width - 28);

	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(options.worldWidth ?? 0.22, options.worldHeight ?? 0.055), material);
	mesh.userData.canvas = canvas;
	mesh.userData.texture = texture;
	return mesh;
}

export function createHudTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 1024;
	canvas.height = 1400;
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return { canvas, texture };
}

export function drawHud(canvas, state, now = performance.now()) {
	const context = canvas.getContext('2d');
	const width = canvas.width;
	const height = canvas.height;
	const gradient = context.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, '#14242d');
	gradient.addColorStop(1, '#0c151d');
	context.clearRect(0, 0, width, height);
	context.fillStyle = gradient;
	context.fillRect(0, 0, width, height);
	context.strokeStyle = 'rgba(190, 224, 215, .25)';
	context.lineWidth = 4;
	context.strokeRect(14, 14, width - 28, height - 28);

	context.textAlign = 'left';
	context.fillStyle = '#a9f0d1';
	context.font = '700 34px system-ui, sans-serif';
	context.fillText('3.2 INTERACCIÓN VIRTUAL', 54, 82);
	context.fillStyle = '#f2f1eb';
	context.font = '700 58px system-ui, sans-serif';
	context.fillText(`${getProgress(state)} / 20`, 54, 190);
	context.fillStyle = '#aab9bc';
	context.font = '500 28px system-ui, sans-serif';
	context.fillText('FIGURAS CLASIFICADAS', 54, 236);
	context.textAlign = 'right';
	context.fillStyle = '#f2f1eb';
	context.font = '700 46px ui-monospace, monospace';
	context.fillText(formatTime(getElapsedMs(state, now)), width - 54, 190);
	context.fillStyle = '#aab9bc';
	context.font = '500 26px system-ui, sans-serif';
	context.fillText('TIEMPO', width - 54, 236);

	context.textAlign = 'left';
	context.fillStyle = '#d9e4df';
	context.font = '600 28px system-ui, sans-serif';
	context.fillText('Apunta a una figura con el rayo.', 54, 345);
	context.fillText('Haz pinza para tomarla y lanzarla.', 54, 390);
	context.fillText('Clasifícala en el recipiente de su forma.', 54, 435);

	if (state.phase === 'complete') {
		// El aviso queda en la zona central del HUD, separado de los botones inferiores.
		context.fillStyle = 'rgba(169, 240, 209, 0.96)';
		context.fillRect(42, 300, width - 84, 158);
		context.strokeStyle = '#f2f1eb';
		context.lineWidth = 4;
		context.strokeRect(42, 300, width - 84, 158);
		context.textAlign = 'center';
		context.fillStyle = '#102027';
		context.font = '800 48px system-ui, sans-serif';
		context.fillText('¡GANASTE!', width / 2, 350);
		context.font = '700 28px system-ui, sans-serif';
		context.fillText('CLASIFICASTE LAS 20 FIGURAS', width / 2, 389);
		context.font = '700 40px ui-monospace, monospace';
		context.fillText(`TU TIEMPO  ${formatTime(getElapsedMs(state, now))}`, width / 2, 438);
	}

	if (state.phase === 'ready' || state.phase === 'paused') {
		context.fillStyle = '#17272f';
		context.fillRect(42, 300, width - 84, 135);
		context.strokeStyle = '#74c8dc';
		context.lineWidth = 4;
		context.strokeRect(42, 300, width - 84, 135);
		context.textAlign = 'center';
		context.fillStyle = '#f2f1eb';
		context.font = '700 34px system-ui, sans-serif';
		context.fillText(state.phase === 'ready' ? 'HAZ PINZA EN COMENZAR' : 'HAZ PINZA EN REANUDAR', width / 2, 355);
		context.font = '600 25px system-ui, sans-serif';
		context.fillText('El cronometro iniciara o continuara entonces.', width / 2, 410);
	}

	const phaseLabel = state.phase === 'complete' ? 'COMPLETADO' : state.phase === 'active' ? 'EN CURSO' : state.phase === 'paused' ? 'PAUSADO' : 'PENDIENTE';
	context.fillStyle = state.phase === 'complete' ? '#a9f0d1' : '#dce6e3';
	context.font = '700 25px system-ui, sans-serif';
	context.fillText(`ESTADO: ${phaseLabel} · 4 MESAS · 4 RECIPIENTES`, 54, 480);

	const leftTracked = state.hands.left;
	const rightTracked = state.hands.right;
	context.fillStyle = leftTracked ? '#a9f0d1' : '#f0c875';
	context.font = '700 24px system-ui, sans-serif';
	context.fillText(`MANO IZQUIERDA  ${leftTracked ? 'DETECTADA' : 'NO DETECTADA'}`, 54, 535);
	context.fillStyle = rightTracked ? '#a9f0d1' : '#f0c875';
	context.fillText(`MANO DERECHA  ${rightTracked ? 'DETECTADA' : 'NO DETECTADA'}`, 54, 580);

	context.textAlign = 'left';
	context.fillStyle = '#a9f0d1';
	context.font = '700 27px system-ui, sans-serif';
	context.fillText('PROGRESO POR FIGURA', 54, 660);
	const categories = [
		{ id: 'cube', label: 'CUBOS', color: '#e7a36d' },
		{ id: 'sphere', label: 'ESFERAS', color: '#74c8dc' },
		{ id: 'pyramid', label: 'PIRÁMIDES', color: '#c0a0f2' },
		{ id: 'hex-prism', label: 'PRISMAS HEXAGONALES', color: '#f0cf76' }
	];
	for (const [index, category] of categories.entries()) {
		const count = state.pieces.reduce((total, piece) => total + (piece.categoryId === category.id && piece.classified ? 1 : 0), 0);
		const y = 720 + index * 58;
		context.fillStyle = category.color;
		context.beginPath();
		context.arc(68, y - 8, 11, 0, Math.PI * 2);
		context.fill();
		context.fillStyle = '#d9e4df';
		context.font = '600 25px system-ui, sans-serif';
		context.fillText(`${category.label}  ${count}/5  ·  FALTAN ${5 - count}`, 98, y);
	}

	for (const [index, category] of categories.entries()) {
		const finishMs = state.score.binFinishMs[category.id];
		const y = 746 + index * 58;
		context.fillStyle = finishMs === null ? '#9aadb1' : '#a9f0d1';
		context.font = '600 18px system-ui, sans-serif';
		context.fillText(finishMs === null ? 'TIEMPO DEL RECIPIENTE: PENDIENTE' : `RECIPIENTE COMPLETO: ${formatTime(finishMs)}`, 98, y);
	}

	context.fillStyle = '#d9e4df';
	context.font = '700 24px system-ui, sans-serif';
	context.fillText(`INTENTOS CONFIRMADOS: ${state.score.attempts}`, 54, 965);
	context.fillText(`ERRORES: ${state.score.errors}     PRECISION: ${getAccuracy(state).toFixed(1)}%`, 54, 1005);

	if (state.phase !== 'complete') {
		const messageColor = state.ui.kind === 'error' ? '#ff8d88' : state.ui.kind === 'success' ? '#a9f0d1' : '#dce6e3';
		context.fillStyle = messageColor;
		context.font = '700 27px system-ui, sans-serif';
		wrapText(context, state.ui.message, 54, 1050, width - 108, 32, 2);
	}

	return true;
}

function wrapText(context, text, x, y, maxWidth, lineHeight, maxLines) {
	const words = String(text).split(/\s+/);
	let line = '';
	let lineCount = 0;
	for (const word of words) {
		const next = line ? `${line} ${word}` : word;
		if (context.measureText(next).width > maxWidth && line) {
			context.fillText(line, x, y + lineCount * lineHeight);
			line = word;
			lineCount += 1;
			if (lineCount >= maxLines) return;
		} else {
			line = next;
		}
	}
	if (line && lineCount < maxLines) context.fillText(line, x, y + lineCount * lineHeight);
}
