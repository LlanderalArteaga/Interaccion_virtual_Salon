export const LAB_CONFIG = Object.freeze({
	grabDistanceMin: 0.45,
	grabDistanceMax: 3.2,
	pinchStartMeters: 0.023,
	pinchReleaseMeters: 0.042,
	maxRayDistance: 3.2,
	messageDurationMs: 2400
});

const CATEGORY_IDS = Object.freeze(['cube', 'sphere', 'pyramid', 'hex-prism']);

function createEmptyScore() {
	return {
		attempts: 0,
		errors: 0,
		binFinishMs: Object.fromEntries(CATEGORY_IDS.map(id => [id, null]))
	};
}

export function createLabState() {
	return {
		phase: 'ready',
		pieces: [],
		bins: [],
		tables: [],
		selectedPieceId: null,
		selectedBy: null,
		dragDistance: 0,
		score: createEmptyScore(),
		xr: { session: null, supported: false, supportChecked: false },
		hands: { left: false, right: false, count: 0 },
		timer: { elapsedMs: 0, running: false, lastTick: 0 },
		ui: { message: 'Entra a VR, muestra tus manos y clasifica las veinte figuras.', kind: 'info', revision: 0, errorTargetId: null, errorPieceId: null, errorUntil: 0 }
	};
}

export function resetScore(state) {
	state.score = createEmptyScore();
}

export function getCategoryProgress(state, categoryId) {
	return state.pieces.reduce((total, piece) => total + (piece.categoryId === categoryId && piece.classified ? 1 : 0), 0);
}

export function getAccuracy(state) {
	return state.score.attempts === 0 ? 0 : (getProgress(state) / state.score.attempts) * 100;
}

export function getProgress(state) {
	return state.pieces.reduce((total, piece) => total + (piece.classified ? 1 : 0), 0);
}

export function getElapsedMs(state, now = performance.now()) {
	if (!state.timer.running) return state.timer.elapsedMs;
	return state.timer.elapsedMs + Math.max(0, now - state.timer.lastTick);
}

export function formatTime(milliseconds) {
	const totalSeconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
	const seconds = (totalSeconds % 60).toString().padStart(2, '0');
	return `${minutes}:${seconds}`;
}

export function setMessage(state, message, kind = 'info', now = performance.now()) {
	state.ui.message = message;
	state.ui.kind = kind;
	state.ui.revision += 1;
	if (kind === 'error') {
		state.ui.errorUntil = now + LAB_CONFIG.messageDurationMs;
	} else {
		state.ui.errorUntil = 0;
	}
}

export function updateMessageExpiry(state, now = performance.now()) {
	if (state.ui.kind === 'error' && now >= state.ui.errorUntil) {
		state.ui.kind = state.phase === 'complete' ? 'success' : 'info';
		state.ui.message = state.phase === 'complete' ? 'Laboratorio completado. Reinicia para intentarlo de nuevo.' : 'Suelta la figura para que continúe bajo gravedad.';
		state.ui.revision += 1;
	}
}
