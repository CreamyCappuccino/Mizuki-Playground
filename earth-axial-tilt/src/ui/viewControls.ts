import { t as tr, onLanguageChange } from './i18n';
import { parseVisualQuality, type VisualQuality } from '../scene/visualQuality';
interface ViewActions {
    quality: (quality: VisualQuality) => void;
    lights: (enabled: boolean) => void;
    refresh: () => void;
}
/** Presentation controls are deliberately separate from the physical simulation state. */
export function bindViewControls(actions: ViewActions): void {
    const get = <T extends HTMLElement>(id: string): T => {
        const element = document.getElementById(id);
        if (!element)
            throw new Error(`Missing view control: ${id}`);
        return element as T;
    };
    const canvas = get<HTMLCanvasElement>('earth-canvas');
    const quality = get<HTMLSelectElement>('visual-quality');
    const lights = get<HTMLInputElement>('night-lights');
    const focusButton = get<HTMLButtonElement>('focus-view');
    const root = document.documentElement;
    let focused = false, scrollX = 0, scrollY = 0;
    let frame = 0;
    try {
        quality.value = parseVisualQuality(localStorage.getItem('earth-lab:quality'));
    }
    catch {
        quality.value = 'high';
    }
    actions.quality(parseVisualQuality(quality.value));
    quality.addEventListener('change', () => {
        const value = parseVisualQuality(quality.value);
        quality.value = value;
        actions.quality(value);
        try {
            localStorage.setItem('earth-lab:quality', value);
        }
        catch { /* storage may be unavailable */ }
    });
    lights.addEventListener('change', () => actions.lights(lights.checked));
    const setFocus = (value: boolean) => {
        if (focused === value)
            return;
        cancelAnimationFrame(frame);
        if (value) {
            scrollX = window.scrollX;
            scrollY = window.scrollY;
        }
        focused = value;
        root.dataset.focusView = String(focused);
        focusButton.textContent = focused ? tr('Show controls') : tr('Focus view');
        focusButton.setAttribute('aria-pressed', String(focused));
        get('focus-view-note').hidden = !focused;
        focusButton.focus({ preventScroll: true });
        if (focused)
            window.scrollTo(0, 0);
        actions.refresh();
        frame = requestAnimationFrame(() => {
            actions.refresh();
            if (!focused)
                window.scrollTo(scrollX, scrollY);
        });
    };
    focusButton.addEventListener('click', () => setFocus(!focused));
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !focused || event.defaultPrevented || document.querySelector('dialog[open]'))
            return;
        event.preventDefault();
        setFocus(false);
    });
    const status = () => {
        const day = canvas.dataset.dayTexture, night = canvas.dataset.nightTexture;
        const note = get('visual-status');
        note.dataset.status = day === 'error' || night === 'error' ? 'error' : day === 'ready' && night === 'ready' ? 'ready' : 'loading';
        note.textContent = day === 'error' ? tr('Day map unavailable — plain globe fallback. Science controls still work.') : night === 'error' ? tr('Night map unavailable — lights omitted. Science controls still work.') : day === 'ready' && night === 'ready' ? tr('Local 4K maps ready · fixed decorative imagery, not live weather.') : tr('Loading local Earth maps…');
    };
    const header = document.querySelector<HTMLElement>('.topbar')!;
    const orbitToolbar = get<HTMLElement>('orbit-toolbar');
    const measureChrome = () => {
        const bottom = header.offsetTop + header.offsetHeight + 12;
        root.style.setProperty('--topbar-bottom', `${bottom}px`);
        root.style.setProperty('--orbit-bottom', `${bottom + orbitToolbar.offsetHeight + 12}px`);
    };
    const chromeObserver = new ResizeObserver(measureChrome);
    chromeObserver.observe(header); chromeObserver.observe(orbitToolbar);
    measureChrome();
    canvas.addEventListener('visualstatus', status);
    status();
    onLanguageChange(() => { focusButton.textContent = tr(focused ? 'Show controls' : 'Focus view'); status(); });
}
