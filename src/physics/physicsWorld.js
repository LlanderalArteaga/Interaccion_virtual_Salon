import * as CANNON from 'cannon-es';

export const PHYSICS_STEP_SECONDS = 1 / 60;
export const MAX_PHYSICS_SUBSTEPS = 5;

export function createPhysicsWorld() {
	const world = new CANNON.World({
		gravity: new CANNON.Vec3(0, -9.82, 0),
		allowSleep: true
	});
	world.broadphase = new CANNON.SAPBroadphase(world);
	world.solver.iterations = 12;
	world.solver.tolerance = 0.001;
	world.defaultContactMaterial.friction = 0.62;
	world.defaultContactMaterial.restitution = 0.32;
	world.defaultContactMaterial.contactEquationStiffness = 1e7;
	world.defaultContactMaterial.contactEquationRelaxation = 4;
	return world;
}

export function createBoxBody(world, { position, halfExtents, mass = 0, material, type }) {
	const body = new CANNON.Body({ mass, material, type });
	body.addShape(new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)));
	body.position.set(position.x, position.y, position.z);
	body.updateMassProperties();
	world.addBody(body);
	return body;
}

export function createRoundPrismShape(radius, height, sides) {
	const vertices = [];
	for (const y of [-height / 2, height / 2]) {
		for (let index = 0; index < sides; index += 1) {
			const angle = (index / sides) * Math.PI * 2;
			vertices.push(new CANNON.Vec3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
		}
	}

	const bottom = Array.from({ length: sides }, (_, index) => index);
	const top = Array.from({ length: sides }, (_, index) => sides + sides - 1 - index);
	const faces = [bottom, top];
	for (let index = 0; index < sides; index += 1) {
		const next = (index + 1) % sides;
		faces.push([index, sides + index, sides + next, next]);
	}
	return new CANNON.ConvexPolyhedron({ vertices, faces });
}

export function createPyramidShape(radius, height) {
	const halfHeight = height / 2;
	const vertices = [
		new CANNON.Vec3(radius, -halfHeight, 0),
		new CANNON.Vec3(0, -halfHeight, radius),
		new CANNON.Vec3(-radius, -halfHeight, 0),
		new CANNON.Vec3(0, -halfHeight, -radius),
		new CANNON.Vec3(0, halfHeight, 0)
	];
	const faces = [[0, 1, 2, 3]];
	for (let index = 0; index < 4; index += 1) {
		const next = (index + 1) % 4;
		faces.push([index, 4, next]);
	}
	return new CANNON.ConvexPolyhedron({ vertices, faces });
}

export function stepPhysics(world, deltaSeconds) {
	const safeDelta = Math.max(0, Math.min(deltaSeconds, 0.08));
	if (safeDelta > 0) {
		world.broadphase.dirty = true;
		world.step(PHYSICS_STEP_SECONDS, safeDelta, MAX_PHYSICS_SUBSTEPS);
	}
}

export function syncPhysicsMeshes(pieces) {
	for (const piece of pieces) {
		const { body, root } = piece;
		root.position.set(body.position.x, body.position.y, body.position.z);
		root.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
	}
}

export function resetDynamicBody(body, position, quaternion) {
	body.position.set(position.x, position.y, position.z);
	body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
	body.velocity.set(0, 0, 0);
	body.angularVelocity.set(0, 0, 0);
	body.force.set(0, 0, 0);
	body.torque.set(0, 0, 0);
	body.previousPosition.copy(body.position);
	body.interpolatedPosition.copy(body.position);
	body.previousQuaternion.copy(body.quaternion);
	body.interpolatedQuaternion.copy(body.quaternion);
	body.aabbNeedsUpdate = true;
	body.wakeUp();
}

export { CANNON };
