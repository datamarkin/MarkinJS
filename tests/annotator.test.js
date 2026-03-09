import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMarkinJS, createTestSVG, cleanup } from './setup.js';

describe('SVGAnnotator', () => {
    let MarkinJS;
    let annotator;
    let svg;

    beforeEach(() => {
        MarkinJS = loadMarkinJS();
        svg = createTestSVG();
        annotator = MarkinJS.createAnnotator('test-svg');
    });

    afterEach(() => {
        if (annotator && annotator.destroy) {
            annotator.destroy();
        }
        cleanup();
    });

    describe('createAnnotation with bbox', () => {
        it('should create an annotation group with a bounding box', () => {
            annotator.createAnnotation({
                bbox: [10, 20, 110, 220]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            expect(group).toBeTruthy();

            const rect = group.querySelector('rect[data-role="bbox"]');
            expect(rect).toBeTruthy();
            expect(parseFloat(rect.getAttribute('x'))).toBe(10);
            expect(parseFloat(rect.getAttribute('y'))).toBe(20);
            expect(parseFloat(rect.getAttribute('width'))).toBe(100);
            expect(parseFloat(rect.getAttribute('height'))).toBe(200);
        });

        it('should create annotation with default dimensions when no bbox provided and requireBbox is true', () => {
            const annotator2 = MarkinJS.createAnnotator('test-svg', { requireBbox: true });
            annotator2.createAnnotation({});

            const group = svg.querySelector('g[data-annotation-group="true"]');
            expect(group).toBeTruthy();

            const rect = group.querySelector('rect[data-role="bbox"]');
            expect(rect).toBeTruthy();

            if (annotator2.destroy) annotator2.destroy();
        });

        it('should assign a UUID to the annotation group', () => {
            annotator.createAnnotation({
                bbox: [10, 20, 110, 220]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            const uuid = group.getAttribute('data-uuid');
            expect(uuid).toBeTruthy();
            expect(typeof uuid).toBe('string');
            expect(uuid.length).toBeGreaterThan(0);
        });

        it('should use a custom UUID when provided', () => {
            annotator.createAnnotation({
                uuid: 'custom-uuid-123',
                bbox: [10, 20, 110, 220]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            expect(group.getAttribute('data-uuid')).toBe('custom-uuid-123');
        });

        it('should set the class attribute on the annotation group', () => {
            annotator.createAnnotation({
                bbox: [10, 20, 110, 220],
                class: 'person'
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            expect(group.getAttribute('data-class')).toBe('person');
        });
    });

    describe('createAnnotation with keypoints', () => {
        it('should create keypoints as circles within the annotation group', () => {
            annotator.createAnnotation({
                keypoints: [
                    { name: 'nose', point: [50, 60] },
                    { name: 'left_eye', point: [40, 50] },
                    { name: 'right_eye', point: [60, 50] }
                ]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            expect(group).toBeTruthy();

            const circles = group.querySelectorAll('circle[data-role="keypoint"]');
            expect(circles.length).toBe(3);

            // Check first keypoint
            expect(parseFloat(circles[0].getAttribute('cx'))).toBe(50);
            expect(parseFloat(circles[0].getAttribute('cy'))).toBe(60);
            expect(circles[0].getAttribute('data-label')).toBe('nose');
        });

        it('should create both bbox and keypoints when both are provided', () => {
            annotator.createAnnotation({
                bbox: [10, 20, 110, 120],
                keypoints: [
                    { name: 'center', point: [60, 70] }
                ]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            const rect = group.querySelector('rect[data-role="bbox"]');
            const circle = group.querySelector('circle[data-role="keypoint"]');

            expect(rect).toBeTruthy();
            expect(circle).toBeTruthy();
        });
    });

    describe('createAnnotation input validation', () => {
        it('should return null for invalid bbox (not 4 numbers)', () => {
            const result = annotator.createAnnotation({
                bbox: [10, 20, 100]
            });
            expect(result).toBeNull();
        });

        it('should return null for bbox with non-number values', () => {
            const result = annotator.createAnnotation({
                bbox: [10, 20, 'abc', 200]
            });
            expect(result).toBeNull();
        });

        it('should return null for bbox with NaN values', () => {
            const result = annotator.createAnnotation({
                bbox: [10, 20, NaN, 200]
            });
            expect(result).toBeNull();
        });

        it('should return null for invalid keypoints (not an array)', () => {
            const result = annotator.createAnnotation({
                keypoints: 'invalid'
            });
            expect(result).toBeNull();
        });

        it('should return null for keypoints with invalid point format', () => {
            const result = annotator.createAnnotation({
                keypoints: [{ name: 'test', point: [10] }]
            });
            expect(result).toBeNull();
        });

        it('should return null for keypoints with non-number point values', () => {
            const result = annotator.createAnnotation({
                keypoints: [{ name: 'test', point: ['a', 'b'] }]
            });
            expect(result).toBeNull();
        });

        it('should return null for invalid segmentation (too few points)', () => {
            const result = annotator.createAnnotation({
                segmentation: [10, 20, 30, 40]
            });
            expect(result).toBeNull();
        });

        it('should return null for segmentation with odd number of values', () => {
            const result = annotator.createAnnotation({
                segmentation: [10, 20, 30, 40, 50, 60, 70]
            });
            expect(result).toBeNull();
        });
    });

    describe('exportAnnotation', () => {
        it('should export bbox annotation correctly', () => {
            annotator.createAnnotation({
                uuid: 'export-test-1',
                class: 'car',
                bbox: [10, 20, 110, 220]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            const exported = annotator.exportAnnotation(group);

            expect(exported).toBeTruthy();
            expect(exported.uuid).toBe('export-test-1');
            expect(exported.class).toBe('car');
            expect(exported.type).toBe('annotation');
            expect(exported.bbox).toBeDefined();
            expect(exported.bbox.x).toBe(10);
            expect(exported.bbox.y).toBe(20);
            expect(exported.bbox.width).toBe(100);
            expect(exported.bbox.height).toBe(200);
        });

        it('should export keypoints correctly', () => {
            annotator.createAnnotation({
                uuid: 'export-test-2',
                keypoints: [
                    { name: 'nose', point: [50, 60] },
                    { name: 'left_eye', point: [40, 50] }
                ]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            const exported = annotator.exportAnnotation(group);

            expect(exported.keypoints).toBeDefined();
            expect(exported.keypoints.length).toBe(2);
            expect(exported.keypoints[0].name).toBe('nose');
            expect(exported.keypoints[0].point).toEqual([50, 60]);
            expect(exported.keypoints[1].name).toBe('left_eye');
            expect(exported.keypoints[1].point).toEqual([40, 50]);
        });

        it('should export segmentation/polygon correctly', () => {
            annotator.createAnnotation({
                uuid: 'export-test-3',
                segmentation: [10, 20, 30, 40, 50, 60]
            });

            const group = svg.querySelector('g[data-annotation-group="true"]');
            const exported = annotator.exportAnnotation(group);

            expect(exported.segmentation).toEqual([10, 20, 30, 40, 50, 60]);
            expect(exported.polygon).toBeDefined();
            expect(exported.polygon.points).toEqual([
                { x: 10, y: 20 },
                { x: 30, y: 40 },
                { x: 50, y: 60 }
            ]);
        });

        it('should return null for invalid input', () => {
            const result = annotator.exportAnnotation(null);
            expect(result).toBeNull();
        });

        it('should return null for non-group elements', () => {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            const result = annotator.exportAnnotation(rect);
            expect(result).toBeNull();
        });
    });

    describe('exportAllAnnotations', () => {
        it('should export all annotations', () => {
            annotator.createAnnotation({
                uuid: 'ann-1',
                class: 'car',
                bbox: [10, 20, 110, 220]
            });
            annotator.createAnnotation({
                uuid: 'ann-2',
                class: 'person',
                bbox: [50, 60, 150, 260]
            });

            const exported = annotator.exportAllAnnotations();

            expect(exported).toBeTruthy();
            expect(exported.type).toBe('annotations');
            expect(exported.count).toBe(2);
            expect(exported.annotations).toBeDefined();
            expect(exported.annotations.length).toBe(2);
        });

        it('should return empty annotations array when no annotations exist', () => {
            const exported = annotator.exportAllAnnotations();

            expect(exported).toBeTruthy();
            expect(exported.type).toBe('annotations');
            expect(exported.count).toBe(0);
            expect(exported.annotations).toEqual([]);
        });

        it('should include version in the export', () => {
            const exported = annotator.exportAllAnnotations();
            expect(exported.version).toBeDefined();
        });

        it('should export annotations with mixed types', () => {
            annotator.createAnnotation({
                uuid: 'mixed-1',
                bbox: [10, 20, 100, 200],
                keypoints: [{ name: 'center', point: [55, 110] }]
            });
            annotator.createAnnotation({
                uuid: 'mixed-2',
                segmentation: [10, 20, 30, 40, 50, 60]
            });

            const exported = annotator.exportAllAnnotations();

            expect(exported.count).toBe(2);

            const ann1 = exported.annotations.find((a) => a.uuid === 'mixed-1');
            const ann2 = exported.annotations.find((a) => a.uuid === 'mixed-2');

            expect(ann1.bbox).toBeDefined();
            expect(ann1.keypoints).toBeDefined();
            expect(ann2.segmentation).toBeDefined();
            expect(ann2.polygon).toBeDefined();
        });
    });
});
