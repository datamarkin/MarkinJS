import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let loaded = false;

export function loadMarkinJS() {
    if (!loaded) {
        let code = readFileSync(resolve(__dirname, '../markin.js'), 'utf-8');
        // Strip module export and const declaration for jsdom evaluation
        code = code.replace('const MarkinJS =', 'window.MarkinJS =');
        code = code.replace(/^export default MarkinJS;\s*$/m, '');
        const fn = new Function(code);
        fn();
        loaded = true;
    }
    return window.MarkinJS;
}

export function createTestSVG(id = 'test-svg') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', id);
    svg.setAttribute('viewBox', '0 0 800 600');

    // Mock SVG methods that jsdom doesn't support
    svg.createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 0, y: 0 })
    });
    svg.getScreenCTM = () => ({
        inverse: () => ({})
    });

    document.body.appendChild(svg);
    return svg;
}

export function createTestImage(id = 'test-image') {
    const img = document.createElement('img');
    img.setAttribute('id', id);
    img.setAttribute('src', 'test.jpg');
    Object.defineProperty(img, 'naturalWidth', { value: 800 });
    Object.defineProperty(img, 'naturalHeight', { value: 600 });
    Object.defineProperty(img, 'complete', { value: true });
    document.body.appendChild(img);
    return img;
}

export function cleanup() {
    document.body.innerHTML = '';
}
