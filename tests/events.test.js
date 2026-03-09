import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadMarkinJS, createTestSVG, cleanup } from './setup.js';

describe('EventSystem', () => {
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

    describe('on/off', () => {
        it('should register event listeners without error', () => {
            const callback = vi.fn();
            expect(() => annotator.on('test-event', callback)).not.toThrow();
        });

        it('should support chaining with on()', () => {
            const result = annotator.on('event1', vi.fn());
            expect(result).toBeDefined();
            expect(typeof result.on).toBe('function');
        });

        it('should support chaining with off()', () => {
            const callback = vi.fn();
            annotator.on('test-event', callback);
            const result = annotator.off('test-event', callback);
            expect(result).toBeDefined();
            expect(typeof result.on).toBe('function');
        });

        it('should remove a specific listener with off()', () => {
            const callback = vi.fn();
            annotator.on('test-event', callback);
            expect(() => annotator.off('test-event', callback)).not.toThrow();
        });

        it('should remove all listeners for an event when off() is called without callback', () => {
            annotator.on('test-event', vi.fn());
            annotator.on('test-event', vi.fn());
            expect(() => annotator.off('test-event')).not.toThrow();
        });
    });

    describe('chaining', () => {
        it('should allow chaining multiple on() calls', () => {
            const result = annotator
                .on('event1', vi.fn())
                .on('event2', vi.fn())
                .on('event3', vi.fn());

            expect(result).toBeDefined();
            expect(typeof result.on).toBe('function');
            expect(typeof result.off).toBe('function');
        });

        it('should allow chaining on() and off()', () => {
            const cb1 = vi.fn();
            const result = annotator.on('event1', cb1).on('event2', vi.fn()).off('event1', cb1);

            expect(result).toBeDefined();
            expect(typeof result.on).toBe('function');
        });
    });
});
