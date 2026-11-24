import * as THREE from 'three';

const PARTICLE_COUNT = 72;
const EFFECT_DURATION_MS = 4200;
const CONFETTI_COLORS = ['#a9f0d1', '#74c8dc', '#e7a36d', '#c0a0f2', '#f0cf76', '#f4f1e9'];

export function createCelebration(scene) {
	const geometry = new THREE.BoxGeometry(0.035, 0.055, 0.008);
	const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
	const confetti = new THREE.InstancedMesh(geometry, material, PARTICLE_COUNT);
	confetti.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	confetti.frustumCulled = false;
	confetti.visible = false;
	scene.add(confetti);

	const dummy = new THREE.Object3D();
	// Frente a los recipientes y delante del HUD en el eje de profundidad.
	const center = new THREE.Vector3(0.25, 1.62, -0.16);
	const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
		velocity: new THREE.Vector3(),
		rotation: new THREE.Vector3(),
		spin: new THREE.Vector3(),
		phase: Math.random() * 0.18
	}));
	for (let index = 0; index < PARTICLE_COUNT; index += 1) {
		confetti.setColorAt(index, new THREE.Color(CONFETTI_COLORS[index % CONFETTI_COLORS.length]));
	}
	if (confetti.instanceColor) confetti.instanceColor.needsUpdate = true;

	let startedAt = null;
	let wasComplete = false;
	return {
		update(phase, now) {
			const isComplete = phase === 'complete';
			if (isComplete && !wasComplete) {
				startedAt = now;
				confetti.visible = true;
				for (const particle of particles) {
					particle.velocity.set((Math.random() - 0.5) * 1.8, 1.1 + Math.random() * 1.5, (Math.random() - 0.5) * 1.5);
					particle.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
					particle.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
				}
			}
			if (!isComplete && wasComplete) {
				startedAt = null;
				confetti.visible = false;
			}
			wasComplete = isComplete;
			if (!confetti.visible || startedAt === null) return;

			const elapsed = (now - startedAt) / 1000;
			if (elapsed * 1000 >= EFFECT_DURATION_MS) {
				confetti.visible = false;
				return;
			}
			for (let index = 0; index < PARTICLE_COUNT; index += 1) {
				const particle = particles[index];
				const time = Math.max(0, elapsed - particle.phase);
				dummy.position.set(
					center.x + particle.velocity.x * time,
					center.y + particle.velocity.y * time - 0.55 * time * time,
					center.z + particle.velocity.z * time
				);
				dummy.rotation.set(
					particle.rotation.x + particle.spin.x * time,
					particle.rotation.y + particle.spin.y * time,
					particle.rotation.z + particle.spin.z * time
				);
				const fade = Math.min(1, Math.max(0.12, (EFFECT_DURATION_MS / 1000 - elapsed) / 1.1));
				dummy.scale.setScalar(fade);
				dummy.updateMatrix();
				confetti.setMatrixAt(index, dummy.matrix);
			}
			confetti.instanceMatrix.needsUpdate = true;
		},
		dispose() {
			scene.remove(confetti);
			geometry.dispose();
			material.dispose();
		}
	};
}
