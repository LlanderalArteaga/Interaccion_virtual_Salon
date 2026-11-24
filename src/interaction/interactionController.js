import * as THREE from 'three';
import { CANNON } from '../physics/physicsWorld.js';
import { formatTime, getCategoryProgress, getElapsedMs, getProgress, LAB_CONFIG, resetScore, setMessage } from '../state/labState.js';

const THROW_SPEED_LIMIT = 4.2;
const REST_LINEAR_SPEED = 0.17;
const REST_ANGULAR_SPEED = 0.32;
const REST_CONFIRM_MS = 700;
const PYRAMID_REST_PROFILE = Object.freeze({ linearSpeed: 0.22, angularSpeed: 0.58, confirmMs: 520 });
const THROW_ANGULAR_SPEED_LIMIT = 7;

function limitBodyVector(vector, maximumLength) {
	const length = vector.length();
	if (length > maximumLength) {
		const scale = maximumLength / length;
		vector.set(vector.x * scale, vector.y * scale, vector.z * scale);
	}
}

export class InteractionController {
	constructor(state, panel, audio, physicsWorld, resetLayout) {
		this.state = state;
		this.panel = panel;
		this.audio = audio;
		this.physicsWorld = physicsWorld;
		this.resetLayout = resetLayout;
		this.raycaster = new THREE.Raycaster();
		this.raycaster.near = 0;
		this.raycaster.far = LAB_CONFIG.maxRayDistance;
		this.grabOffset = new THREE.Vector3();
		this.grabPoint = new THREE.Vector3();
		this.nextPosition = new THREE.Vector3();
		this.smoothedHeldPosition = new THREE.Vector3();
		this.frameVelocity = new THREE.Vector3();
		this.dragVelocity = new THREE.Vector3();
		this.dragAngularVelocity = new THREE.Vector3();
		this.grabRotationOffset = new THREE.Quaternion();
		this.nextQuaternion = new THREE.Quaternion();
		this.rotationTarget = new THREE.Quaternion();
		this.previousHeldQuaternion = new THREE.Quaternion();
		this.rotationDeltaQuaternion = new THREE.Quaternion();
		this.rotationAxis = new THREE.Vector3();
		this.lastDragTime = 0;
		this.hoveredPieceId = null;
	}

	update(handSnapshots, now) {
	let hoveredControl = null;
	let hoveredPiece = null;
	let actionHandled = false;

		for (const hand of handSnapshots) {
			if (!hand.tracked) continue;
			if (this.state.selectedBy === hand.side) {
				if (hand.rayValid && hand.pinching) this.#moveSelected(hand, now);
				if (hand.pinchEnded) this.#releaseSelected(now);
				continue;
			}
			if (!hand.rayValid) continue;
			this.raycaster.ray.copy(hand.ray);
			const controlHit = this.raycaster.intersectObjects(this.panel.controls, false)[0];
			if (controlHit) {
				const control = controlHit.object;
				hoveredControl ??= control.userData.controlId;
				if (hand.pinchStarted && !actionHandled) {
					control.userData.action?.();
					actionHandled = true;
				}
				continue;
			}
			if (this.state.phase !== 'active') continue;

			const pieceHit = this.#findPieceHit();
			if (!pieceHit) continue;
			hoveredPiece ??= pieceHit.piece.id;
			if (hand.pinchStarted && this.state.selectedPieceId === null && !pieceHit.piece.classified) {
				this.#beginGrab(pieceHit.piece, hand, pieceHit.hit, now);
			}
			if (this.state.selectedBy === hand.side && hand.pinching) this.#moveSelected(hand, now);
			if (this.state.selectedBy === hand.side && hand.pinchEnded) this.#releaseSelected(now);
		}
		this.#setHoverState(hoveredControl, hoveredPiece);
	}

	startSession(now) {
		this.state.phase = this.state.phase === 'complete' ? 'complete' : this.state.timer.elapsedMs > 0 ? 'paused' : 'ready';
		if (this.state.phase !== 'complete') {
			this.state.timer.running = false;
			this.state.timer.lastTick = now;
			setMessage(this.state, this.state.hands.count ? 'Haz pinza para tomar una figura; al soltarla, la gravedad y las colisiones actúan.' : 'Muestra tus manos para comenzar.', 'info', now);
		}
	}

	startChallenge(now = performance.now()) {
		if (!this.state.xr.session || this.state.phase === 'complete' || this.state.phase === 'active') return;
		this.state.phase = 'active';
		this.state.timer.lastTick = now;
		this.state.timer.running = true;
		setMessage(this.state, 'Partida iniciada. Clasifica las veinte figuras.', 'info', now);
	}

	endSession(now) {
		this.#pauseTimer(now);
		this.#releaseForTrackingLoss();
		if (this.state.phase !== 'complete') {
			this.state.phase = this.state.timer.elapsedMs > 0 ? 'paused' : 'ready';
			setMessage(this.state, 'Sesión pausada. Vuelve a entrar a VR para continuar.', 'info', now);
		}
		this.#setHoverState(null, null);
	}

	onTrackingLost(side) {
		if (this.state.selectedBy !== side) return;
		this.#releaseForTrackingLoss();
		setMessage(this.state, 'Se perdió el seguimiento. La figura se soltó y continúa bajo gravedad; puedes volver a tomarla.', 'error');
	}

	reset(now = performance.now()) {
		this.#releaseForTrackingLoss();
		this.resetLayout();
		this.state.phase = 'ready';
		this.state.timer.elapsedMs = 0;
		this.state.timer.running = false;
		this.state.timer.lastTick = now;
		resetScore(this.state);
		this.state.ui.errorTargetId = null;
		this.state.ui.errorPieceId = null;
		this.state.ui.errorUntil = 0;
		setMessage(this.state, this.state.xr.session ? 'Escenario reiniciado. Las veinte piezas se redistribuyeron.' : 'Escenario reiniciado. Entra a VR para comenzar.', 'info', now);
		this.#setHoverState(null, null);
	}

	advanceTimer(now) {
		if (!this.state.timer.running) return;
		const delta = Math.max(0, now - this.state.timer.lastTick);
		this.state.timer.elapsedMs += delta;
		this.state.timer.lastTick = now;
	}

	#findPieceHit() {
		let closest = null;
		for (const piece of this.state.pieces) {
			if (piece.classified) continue;
			let hit = this.raycaster.intersectObject(piece.mesh, false)[0];
			if (piece.recoveryMarker.visible) {
				piece.recoveryMarker.updateWorldMatrix(true, true);
				const markerHit = this.raycaster.intersectObjects(piece.recoveryMarker.children, false)[0];
				if (markerHit && (!hit || markerHit.distance < hit.distance)) {
					const projectedDistance = new THREE.Vector3(piece.body.position.x, piece.body.position.y, piece.body.position.z)
						.sub(this.raycaster.ray.origin).dot(this.raycaster.ray.direction);
					hit = { distance: THREE.MathUtils.clamp(projectedDistance, 0, this.raycaster.far), point: this.raycaster.ray.at(projectedDistance, new THREE.Vector3()) };
				}
			}
			if (hit && (!closest || hit.distance < closest.hit.distance)) closest = { piece, hit };
		}
		return closest;
	}

	#beginGrab(piece, hand, hit, now) {
		if (piece.classified || this.state.selectedPieceId !== null) return;
		this.state.selectedPieceId = piece.id;
		this.state.selectedBy = hand.side;
		piece.status = 'held';
		piece.restingSince = null;
		piece.wrongFeedbackShown = false;
		// El modo cinemático evita que el solver sacuda la pieza mientras sigue la mano.
		piece.body.velocity.set(0, 0, 0);
		piece.body.angularVelocity.set(0, 0, 0);
		piece.body.wakeUp();
		this.#setBodyType(piece.body, CANNON.Body.KINEMATIC, 0);
		hand.ray.at(THREE.MathUtils.clamp(hit.distance, LAB_CONFIG.grabDistanceMin, LAB_CONFIG.grabDistanceMax), this.grabPoint);
		this.state.dragDistance = this.grabPoint.distanceTo(hand.ray.origin);
		this.grabOffset.set(piece.body.position.x, piece.body.position.y, piece.body.position.z).sub(this.grabPoint);
		this.smoothedHeldPosition.set(piece.body.position.x, piece.body.position.y, piece.body.position.z);
		this.previousHeldQuaternion.set(piece.body.quaternion.x, piece.body.quaternion.y, piece.body.quaternion.z, piece.body.quaternion.w);
		this.dragAngularVelocity.set(0, 0, 0);
		if (hand.handOrientation) {
			this.grabRotationOffset.copy(hand.handOrientation).invert().multiply(this.previousHeldQuaternion);
		} else {
			this.grabRotationOffset.identity();
		}
		this.dragVelocity.set(0, 0, 0);
		this.lastDragTime = now;
		piece.material.emissive.set('#718d62');
		setMessage(this.state, `${piece.name} sujeta. Muévela y suéltala para probar la gravedad y el rebote.`, 'info', now);
	}

	#moveSelected(hand, now) {
		const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
		if (!piece || piece.status !== 'held') return;
		hand.ray.at(this.state.dragDistance, this.nextPosition).add(this.grabOffset);
		this.nextPosition.x = THREE.MathUtils.clamp(this.nextPosition.x, -2.05, 2.05);
		this.nextPosition.y = THREE.MathUtils.clamp(this.nextPosition.y, 0.12, 2.25);
		this.nextPosition.z = THREE.MathUtils.clamp(this.nextPosition.z, -2.05, 2.05);
		const deltaSeconds = (now - this.lastDragTime) / 1000;
		const safeDeltaSeconds = THREE.MathUtils.clamp(deltaSeconds, 1 / 120, 0.05);
		const positionSmoothing = 1 - Math.exp(-safeDeltaSeconds / 0.045);
		this.smoothedHeldPosition.lerp(this.nextPosition, positionSmoothing);
		this.nextPosition.copy(this.smoothedHeldPosition);
		this.#keepHeldPieceAboveTables(piece);
		this.#moveHeldRotation(piece, hand, deltaSeconds);
		// Conserva el movimiento para el lanzamiento y evita que la física integre dos veces el agarre.
		this.frameVelocity.set(
			this.nextPosition.x - piece.body.position.x,
			this.nextPosition.y - piece.body.position.y,
			this.nextPosition.z - piece.body.position.z
		).multiplyScalar(1 / safeDeltaSeconds).clampLength(0, THROW_SPEED_LIMIT);
		this.dragVelocity.copy(this.frameVelocity);
		piece.body.position.set(this.nextPosition.x, this.nextPosition.y, this.nextPosition.z);
		piece.body.velocity.set(0, 0, 0);
		piece.body.previousPosition.copy(piece.body.position);
		piece.body.interpolatedPosition.copy(piece.body.position);
		piece.body.aabbNeedsUpdate = true;
		this.lastDragTime = now;
	}

	#releaseSelected(now) {
		const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
		this.state.selectedPieceId = null;
		this.state.selectedBy = null;
		if (!piece || piece.classified) return;
		this.#setBodyType(piece.body, CANNON.Body.DYNAMIC, piece.massKg);
		piece.body.velocity.set(this.dragVelocity.x, this.dragVelocity.y, this.dragVelocity.z);
		piece.body.angularVelocity.set(this.dragAngularVelocity.x, this.dragAngularVelocity.y, this.dragAngularVelocity.z);
		limitBodyVector(piece.body.velocity, THROW_SPEED_LIMIT);
		limitBodyVector(piece.body.angularVelocity, THROW_ANGULAR_SPEED_LIMIT);
		piece.body.aabbNeedsUpdate = true;
		piece.body.wakeUp();
		piece.status = 'released';
		piece.restingSince = null;
		piece.material.emissive.set('#000000');
		setMessage(this.state, 'Figura liberada: rebota y se estabiliza por colisiones físicas.', 'info', now);
	}

	#releaseForTrackingLoss() {
		const piece = this.state.pieces.find(item => item.id === this.state.selectedPieceId);
		if (piece && !piece.classified) {
			this.#setBodyType(piece.body, CANNON.Body.DYNAMIC, piece.massKg);
			piece.body.velocity.set(this.dragVelocity.x, this.dragVelocity.y, this.dragVelocity.z);
			piece.body.angularVelocity.set(this.dragAngularVelocity.x, this.dragAngularVelocity.y, this.dragAngularVelocity.z);
			limitBodyVector(piece.body.velocity, THROW_SPEED_LIMIT);
			limitBodyVector(piece.body.angularVelocity, THROW_ANGULAR_SPEED_LIMIT);
			piece.body.aabbNeedsUpdate = true;
			piece.body.wakeUp();
			piece.status = 'released';
			piece.restingSince = null;
			piece.material.emissive.set('#000000');
		}
		this.state.selectedPieceId = null;
		this.state.selectedBy = null;
	}

	checkWrongBinSettling(now) {
		if (this.state.phase !== 'active') return;
		for (const piece of this.state.pieces) {
			if (piece.classified || piece.status === 'held' || piece.status === 'available') continue;
			const bin = this.#findContainingBin(piece);
			const pyramidProfile = piece.categoryId === 'pyramid' ? PYRAMID_REST_PROFILE : null;
			const linearLimit = pyramidProfile?.linearSpeed ?? REST_LINEAR_SPEED;
			const angularLimit = pyramidProfile?.angularSpeed ?? REST_ANGULAR_SPEED;
			const confirmMs = pyramidProfile?.confirmMs ?? REST_CONFIRM_MS;
			const isSettled = piece.body.velocity.length() <= linearLimit
				&& piece.body.angularVelocity.length() <= angularLimit;
			if (!isSettled) {
				piece.restingSince = null;
				if (piece.status !== 'error') piece.status = 'released';
				continue;
			}
			piece.restingSince ??= now;
			if (piece.status !== 'error') piece.status = 'stabilizing';
			if (now - piece.restingSince < confirmMs) continue;
			if (bin?.id === piece.assignedBinId) {
				this.#classifyPiece(piece, now);
				continue;
			}
			// El aviso de error se muestra una sola vez, pero la pieza se sigue
			// evaluando: puede terminar de asentarse dentro de su recipiente.
			if (piece.wrongFeedbackShown) {
				piece.status = bin ? 'error' : piece.body.position.y < 0.24 ? 'recoverable' : 'error';
				continue;
			}
			piece.status = bin ? 'error' : piece.body.position.y < 0.24 ? 'recoverable' : 'error';
			piece.wrongFeedbackShown = true;
			if (bin) {
				this.state.score.attempts += 1;
				this.state.score.errors += 1;
			}
			piece.material.emissive.set('#9b2929');
			this.audio.playError();
			const locationMessage = bin
				? `Esa figura no corresponde a ${bin.name}.`
				: 'La figura quedó fuera de su recipiente.';
			const targetBin = this.state.bins.find(item => item.id === piece.assignedBinId);
			setMessage(this.state, `${locationMessage} Tómala de nuevo y llévala al recipiente ${targetBin?.name ?? piece.name}.`, 'error', now);
		}
	}

	#findContainingBin(piece) {
		const { x, y, z } = piece.body.position;
		piece.body.updateAABB();
		const pieceBottom = piece.body.aabb.lowerBound.y;
		return this.state.bins.find(bin => {
			// El margen contempla el contacto lateral sin aceptar piezas fuera de la caja.
			const centerAllowance = bin.innerHalf + piece.boundingRadius * 0.65;
			const insideFootprint = Math.abs(x - bin.position.x) <= centerAllowance
				&& Math.abs(z - bin.position.z) <= centerAllowance;
			const aboveContainerFloor = pieceBottom >= bin.floorY - 0.025;
			const belowRim = pieceBottom < bin.floorY + bin.wallHeight - 0.015;
			const restingOnAcceptedPiece = this.state.pieces.some(support => {
				if (support.id === piece.id || !support.classified || support.assignedBinId !== bin.id) return false;
				support.body.updateAABB();
				const horizontalDistance = Math.hypot(x - support.body.position.x, z - support.body.position.z);
				const supportTop = support.body.aabb.upperBound.y;
				return horizontalDistance <= (piece.boundingRadius + support.boundingRadius) * 1.35
					&& Math.abs(pieceBottom - supportTop) <= 0.075;
			});
			// Acepta una pila anclada a una pieza ya depositada, aunque rebase la boca.
			const insideHeight = aboveContainerFloor && (belowRim || restingOnAcceptedPiece);
			return insideFootprint && insideHeight;
		});
	}

	#classifyPiece(piece, now) {
		if (piece.classified || piece.counted) return;
		piece.classified = true;
		piece.counted = true;
		piece.status = 'classified';
		piece.wrongFeedbackShown = false;
		piece.recoveryMarker.visible = false;
		piece.material.emissive.set('#277a4e');
		piece.body.velocity.set(0, 0, 0);
		piece.body.angularVelocity.set(0, 0, 0);
		this.#setBodyType(piece.body, CANNON.Body.STATIC, 0);
		this.state.score.attempts += 1;
		const progress = getProgress(this.state);
		if (progress === this.state.pieces.length) this.audio.playFinish();
		else this.audio.playSuccess();
		if (progress === this.state.pieces.length) this.advanceTimer(now);
		const elapsedMs = getElapsedMs(this.state, now);
		if (getCategoryProgress(this.state, piece.categoryId) === 5 && this.state.score.binFinishMs[piece.categoryId] === null) {
			this.state.score.binFinishMs[piece.categoryId] = elapsedMs;
		}
		if (progress === this.state.pieces.length) {
			this.state.timer.running = false;
			this.state.phase = 'complete';
			setMessage(this.state, `Laboratorio completado en ${formatTime(getElapsedMs(this.state, now))}. Clasificaste las veinte figuras.`, 'success', now);
			return;
		}
		setMessage(this.state, `${piece.name} en su recipiente correcto. Progreso: ${progress}/20.`, 'success', now);
	}

	#keepHeldPieceAboveTables(piece) {
		for (const table of this.state.tables) {
			const horizontalReach = table.size / 2 + piece.boundingRadius;
			const overlapsTop = Math.abs(this.nextPosition.x - table.x) <= horizontalReach
				&& Math.abs(this.nextPosition.z - table.z) <= horizontalReach;
			if (!overlapsTop) continue;
			const minimumCenterY = table.topY + piece.halfHeight + 0.006;
			if (this.nextPosition.y < minimumCenterY) this.nextPosition.y = minimumCenterY;
		}
	}

	#moveHeldRotation(piece, hand, deltaSeconds) {
		if (!hand.handOrientation) {
			piece.body.angularVelocity.set(0, 0, 0);
			this.dragAngularVelocity.set(0, 0, 0);
			return;
		}
		this.rotationTarget.copy(hand.handOrientation).multiply(this.grabRotationOffset).normalize();
		const rotationSmoothing = 1 - Math.exp(-Math.max(0, deltaSeconds) / 0.045);
		this.nextQuaternion.set(piece.body.quaternion.x, piece.body.quaternion.y, piece.body.quaternion.z, piece.body.quaternion.w)
			.slerp(this.rotationTarget, rotationSmoothing).normalize();
		if (deltaSeconds > 0 && deltaSeconds <= 0.1) {
			this.previousHeldQuaternion.set(piece.body.quaternion.x, piece.body.quaternion.y, piece.body.quaternion.z, piece.body.quaternion.w);
			this.rotationDeltaQuaternion.copy(this.previousHeldQuaternion).invert().multiply(this.nextQuaternion).normalize();
			if (this.rotationDeltaQuaternion.w < 0) {
				this.rotationDeltaQuaternion.set(
					-this.rotationDeltaQuaternion.x,
					-this.rotationDeltaQuaternion.y,
					-this.rotationDeltaQuaternion.z,
					-this.rotationDeltaQuaternion.w
				);
			}
			const halfAngle = Math.acos(THREE.MathUtils.clamp(this.rotationDeltaQuaternion.w, -1, 1));
			const sinHalfAngle = Math.sin(halfAngle);
			if (sinHalfAngle > 0.0001) {
				this.rotationAxis.set(
					this.rotationDeltaQuaternion.x / sinHalfAngle,
					this.rotationDeltaQuaternion.y / sinHalfAngle,
					this.rotationDeltaQuaternion.z / sinHalfAngle
				).multiplyScalar((halfAngle * 2) / deltaSeconds);
				this.dragAngularVelocity.copy(this.rotationAxis).clampLength(0, THROW_ANGULAR_SPEED_LIMIT);
			} else {
				this.dragAngularVelocity.set(0, 0, 0);
			}
		} else {
			this.dragAngularVelocity.set(0, 0, 0);
		}
		piece.body.angularVelocity.set(0, 0, 0);
		piece.body.quaternion.set(this.nextQuaternion.x, this.nextQuaternion.y, this.nextQuaternion.z, this.nextQuaternion.w);
		piece.body.previousQuaternion.copy(piece.body.quaternion);
		piece.body.interpolatedQuaternion.copy(piece.body.quaternion);
		piece.body.aabbNeedsUpdate = true;
	}

	#setBodyType(body, type, mass) {
		body.type = type;
		body.mass = mass;
		body.updateMassProperties();
		body.aabbNeedsUpdate = true;
		this.physicsWorld.broadphase.dirty = true;
	}

	#pauseTimer(now) {
		this.advanceTimer(now);
		this.state.timer.running = false;
	}

	#setHoverState(controlId, pieceId) {
		this.panel.setHovered(controlId);
		if (this.hoveredPieceId && this.hoveredPieceId !== this.state.selectedPieceId) {
			const previous = this.state.pieces.find(item => item.id === this.hoveredPieceId);
			if (previous && !previous.classified && !previous.wrongFeedbackShown) previous.material.emissive.set('#000000');
		}
		if (pieceId && pieceId !== this.state.selectedPieceId) {
			const current = this.state.pieces.find(item => item.id === pieceId);
			if (current && !current.classified && !current.wrongFeedbackShown) current.material.emissive.set('#384b42');
		}
		this.hoveredPieceId = pieceId;
	}
}
