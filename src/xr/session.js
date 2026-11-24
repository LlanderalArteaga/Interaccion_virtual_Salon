import { VRButton } from 'three/addons/webxr/VRButton.js';

export function createSessionControls(renderer, state, elements, callbacks) {
	const sessionInit = {
		requiredFeatures: ['hand-tracking'],
		optionalFeatures: ['local-floor']
	};
	const button = VRButton.createButton(renderer, sessionInit);
	button.id = 'enter-vr-button';
	button.classList.add('btn', 'btn-light', 'btn-lg');
	translateButtonLabel(button);
	elements.entrySlot.replaceChildren(button);
	let requestFeedbackTimer = null;
	const onEntryRequest = () => {
		if (state.xr.session) return;
		window.clearTimeout(requestFeedbackTimer);
		elements.compatibilityStatus.textContent = 'Solicitando sesión VR. La actividad requiere seguimiento de manos.';
		requestFeedbackTimer = window.setTimeout(() => {
			if (renderer.xr.getSession()) return;
			elements.compatibilityStatus.textContent = 'No se pudo iniciar la sesión VR.';
			elements.browserMessage.textContent = 'Comprueba que el navegador permita immersive-vr y hand-tracking, y que el seguimiento de manos esté activado en el visor.';
			elements.browserMessage.classList.remove('d-none');
		}, 15000);
	};
	button.addEventListener('click', onEntryRequest);
	const originalPosition = button.style.position;
	button.style.position = 'static';
	button.style.display = 'inline-flex';
	button.style.width = 'auto';
	button.style.minWidth = '12rem';
	button.style.minHeight = '3.15rem';
	button.style.padding = '.85rem 1.35rem';
	button.style.borderRadius = '999px';
	button.style.fontWeight = '800';
	button.style.margin = '0';

	const onSessionStart = () => {
		window.clearTimeout(requestFeedbackTimer);
		state.xr.session = renderer.xr.getSession();
		callbacks.onStart?.(state.xr.session);
		elements.compatibilityStatus.textContent = 'Sesión VR activa. Muestra una o ambas manos para comenzar.';
	};
	const onSessionEnd = () => {
		window.clearTimeout(requestFeedbackTimer);
		callbacks.onEnd?.();
		state.xr.session = null;
		elements.compatibilityStatus.textContent = 'Sesión VR finalizada. Puedes volver a entrar para continuar o reiniciar el reto.';
	};
	renderer.xr.addEventListener('sessionstart', onSessionStart);
	renderer.xr.addEventListener('sessionend', onSessionEnd);

	const buttonObserver = new MutationObserver(() => {
		const sourceLabel = button.textContent.trim();
		if (/NOT SUPPORTED|NOT ALLOWED|UNAVAILABLE|ERROR/i.test(sourceLabel)) {
			elements.compatibilityStatus.textContent = 'Este navegador no puede iniciar VR inmersiva. Prueba con Meta Quest Browser mediante HTTPS.';
		}
		translateButtonLabel(button);
	});
	buttonObserver.observe(button, { childList: true, characterData: true, subtree: true });

	const supportPromise = checkImmersiveSupport(state, elements);
	return {
		button,
		supportPromise,
		dispose() {
			window.clearTimeout(requestFeedbackTimer);
			button.removeEventListener('click', onEntryRequest);
			buttonObserver.disconnect();
			renderer.xr.removeEventListener('sessionstart', onSessionStart);
			renderer.xr.removeEventListener('sessionend', onSessionEnd);
			elements.entrySlot.replaceChildren();
			button.style.position = originalPosition;
		}
	};
}

async function checkImmersiveSupport(state, elements) {
	if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') {
		state.xr.supportChecked = true;
		state.xr.supported = false;
		elements.compatibilityStatus.textContent = 'Este navegador no ofrece WebXR immersive-vr. La vista previa no es una sesión inmersiva.';
		elements.browserMessage.textContent = 'Abre esta página con Meta Quest Browser mediante HTTPS para usar VR inmersiva y seguimiento de manos.';
		elements.browserMessage.classList.remove('d-none');
		return false;
	}
	try {
		const supported = await navigator.xr.isSessionSupported('immersive-vr');
		state.xr.supportChecked = true;
		state.xr.supported = supported;
		if (supported) {
			elements.compatibilityStatus.textContent = 'Este navegador informa que admite VR inmersiva. La actividad requiere seguimiento de manos.';
			return true;
		}
		elements.compatibilityStatus.textContent = 'Este navegador informa que VR inmersiva no está disponible.';
		elements.browserMessage.textContent = 'Usa Meta Quest Browser en Meta Quest 3, permite VR inmersiva y activa el seguimiento de manos en la configuración del visor.';
		elements.browserMessage.classList.remove('d-none');
		return false;
	} catch (error) {
		state.xr.supportChecked = true;
		state.xr.supported = false;
		elements.compatibilityStatus.textContent = `No se pudo comprobar WebXR: ${error.message}`;
		elements.browserMessage.textContent = 'Comprueba los permisos y la conexión del navegador; después, vuelve a cargar la página.';
		elements.browserMessage.classList.remove('d-none');
		return false;
	}
}

function translateButtonLabel(button) {
	const label = button.textContent.trim();
	if (/^ENTER VR$/i.test(label)) button.textContent = 'ENTRAR EN VR';
	else if (/^EXIT VR$/i.test(label)) button.textContent = 'SALIR DE VR';
	else if (/^VR NOT SUPPORTED$/i.test(label)) button.textContent = 'VR NO DISPONIBLE';
	else if (/^VR NOT ALLOWED$/i.test(label)) button.textContent = 'VR NO PERMITIDO';
	else if (/^VR UNAVAILABLE$/i.test(label)) button.textContent = 'VR NO DISPONIBLE';
	button.setAttribute('aria-label', button.textContent.trim());
}
