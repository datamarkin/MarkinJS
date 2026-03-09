import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMarkinJS, createTestSVG, cleanup } from './setup.js';

describe('Utility Functions', () => {
    let MarkinJS;
    let annotator;

    beforeEach(() => {
        MarkinJS = loadMarkinJS();
        createTestSVG();
        annotator = MarkinJS.createAnnotator('test-svg');
    });

    afterEach(() => {
        if (annotator && annotator.destroy) {
            annotator.destroy();
        }
        cleanup();
    });

    describe('generateUUID', () => {
        it('should generate a string', () => {
            annotator.createAnnotation({ bbox: [10, 20, 100, 200] });
            const exported = annotator.exportAnnotation(
                annotator.getSVGElement().querySelector('g[data-annotation-group]')
            );
            expect(exported.uuid).toBeDefined();
            expect(typeof exported.uuid).toBe('string');
        });

        it('should generate unique UUIDs', () => {
            annotator.createAnnotation({ bbox: [10, 20, 100, 200] });
            annotator.createAnnotation({ bbox: [30, 40, 150, 250] });

            const groups = annotator.getSVGElement().querySelectorAll('g[data-annotation-group]');
            const uuid1 = groups[0].getAttribute('data-uuid');
            const uuid2 = groups[1].getAttribute('data-uuid');

            expect(uuid1).not.toBe(uuid2);
        });
    });

    describe('formatPoints', () => {
        it('should format segmentation into points attribute', () => {
            annotator.createAnnotation({
                segmentation: [10, 20, 30, 40, 50, 60]
            });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const polygon = group.querySelector('polygon');
            expect(polygon).toBeTruthy();
            expect(polygon.getAttribute('points')).toBe('10,20 30,40 50,60');
        });

        it('should format flat array of coordinates', () => {
            annotator.createAnnotation({
                segmentation: [100, 200, 300, 400, 500, 600]
            });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const polygon = group.querySelector('polygon');
            expect(polygon.getAttribute('points')).toBe('100,200 300,400 500,600');
        });
    });

    describe('pointsToArray', () => {
        it('should convert string points to array of objects on export', () => {
            annotator.createAnnotation({
                segmentation: [10, 20, 30, 40, 50, 60]
            });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const exported = annotator.exportAnnotation(group);

            expect(exported.polygon).toBeDefined();
            expect(exported.polygon.points).toEqual([
                { x: 10, y: 20 },
                { x: 30, y: 40 },
                { x: 50, y: 60 }
            ]);
        });

        it('should return flat segmentation array from export', () => {
            annotator.createAnnotation({
                segmentation: [10, 20, 30, 40, 50, 60]
            });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const exported = annotator.exportAnnotation(group);

            expect(exported.segmentation).toEqual([10, 20, 30, 40, 50, 60]);
        });
    });

    describe('getElementRole', () => {
        it('should return bbox role from data-role attribute', () => {
            annotator.createAnnotation({ bbox: [10, 20, 100, 200] });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const bbox = group.querySelector('rect');
            expect(bbox.getAttribute('data-role')).toBe('bbox');
        });

        it('should identify keypoint elements', () => {
            annotator.createAnnotation({
                keypoints: [{ name: 'nose', point: [50, 60] }]
            });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const keypoint = group.querySelector('circle');
            expect(keypoint.getAttribute('data-role')).toBe('keypoint');
        });

        it('should identify polygon elements', () => {
            annotator.createAnnotation({
                segmentation: [10, 20, 30, 40, 50, 60]
            });
            const group = annotator.getSVGElement().querySelector('g[data-annotation-group]');
            const polygon = group.querySelector('polygon');
            expect(polygon.getAttribute('data-role')).toBe('polygon');
        });
    });

    describe('input validation', () => {
        it('should reject invalid bbox (wrong length)', () => {
            const result = annotator.createAnnotation({ bbox: [10, 20] });
            expect(result).toBeNull();
        });

        it('should reject invalid bbox (non-numeric values)', () => {
            const result = annotator.createAnnotation({ bbox: [10, 'abc', 100, 200] });
            expect(result).toBeNull();
        });

        it('should reject invalid keypoints (missing point)', () => {
            const result = annotator.createAnnotation({
                keypoints: [{ name: 'test' }]
            });
            expect(result).toBeNull();
        });

        it('should reject invalid segmentation (too few points)', () => {
            const result = annotator.createAnnotation({
                segmentation: [10, 20]
            });
            expect(result).toBeNull();
        });

        it('should reject invalid segmentation (odd number of values)', () => {
            const result = annotator.createAnnotation({
                segmentation: [10, 20, 30, 40, 50]
            });
            expect(result).toBeNull();
        });
    });
});
