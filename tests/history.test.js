import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadMarkinJS, createTestSVG, cleanup } from './setup.js';

describe('HistoryManager', () => {
    let MarkinJS;
    let annotator;

    beforeEach(() => {
        MarkinJS = loadMarkinJS();
        createTestSVG();
        annotator = MarkinJS.createAnnotator('test-svg', {
            historyEnabled: true,
            historyMaxStates: 5
        });
    });

    afterEach(() => {
        if (annotator && annotator.destroy) {
            annotator.destroy();
        }
        cleanup();
    });

    describe('saveState', () => {
        it('should save the initial state on creation', () => {
            expect(annotator.history.hasUndo()).toBe(false); // Only 1 state, can't undo
            expect(annotator.history.hasRedo()).toBe(false);
        });

        it('should allow undo after saving a new state', () => {
            annotator.saveState('action1');
            expect(annotator.history.hasUndo()).toBe(true);
        });
    });

    describe('undo/redo', () => {
        it('should undo to previous state', () => {
            annotator.createAnnotation({ bbox: [10, 20, 100, 200] });
            annotator.saveState('create-bbox');

            expect(annotator.history.hasUndo()).toBe(true);

            const result = annotator.undo();
            expect(result).toBe(true);
        });

        it('should redo after undo', () => {
            annotator.createAnnotation({ bbox: [10, 20, 100, 200] });
            annotator.saveState('create-bbox');

            annotator.undo();
            expect(annotator.history.hasRedo()).toBe(true);

            const result = annotator.redo();
            expect(result).toBe(true);
        });

        it('should not undo when there is only the initial state', () => {
            const result = annotator.undo();
            expect(result).toBe(false);
        });

        it('should not redo when there are no redo states', () => {
            const result = annotator.redo();
            expect(result).toBe(false);
        });

        it('should clear redo stack when a new action is performed after undo', () => {
            annotator.createAnnotation({ bbox: [10, 20, 100, 200] });
            annotator.saveState('action1');

            annotator.undo();
            expect(annotator.history.hasRedo()).toBe(true);

            annotator.saveState('action2');
            expect(annotator.history.hasRedo()).toBe(false);
        });
    });

    describe('hasUndo/hasRedo', () => {
        it('hasUndo should return false with only initial state', () => {
            expect(annotator.history.hasUndo()).toBe(false);
        });

        it('hasUndo should return true after saving additional state', () => {
            annotator.saveState('test');
            expect(annotator.history.hasUndo()).toBe(true);
        });

        it('hasRedo should return false initially', () => {
            expect(annotator.history.hasRedo()).toBe(false);
        });

        it('hasRedo should return true after undo', () => {
            annotator.saveState('test');
            annotator.undo();
            expect(annotator.history.hasRedo()).toBe(true);
        });
    });

    describe('clearHistory', () => {
        it('should clear all undo/redo states and save a fresh initial state', () => {
            annotator.saveState('action1');
            annotator.saveState('action2');
            annotator.saveState('action3');

            expect(annotator.history.hasUndo()).toBe(true);

            annotator.clearHistory();

            expect(annotator.history.hasUndo()).toBe(false);
            expect(annotator.history.hasRedo()).toBe(false);
        });
    });

    describe('max states limit', () => {
        it('should respect the maximum states limit', () => {
            for (let i = 0; i < 10; i++) {
                annotator.saveState(`action-${i}`);
            }
            expect(annotator.history.undoStack.length).toBeLessThanOrEqual(5);
        });

        it('should still allow undo after hitting max states', () => {
            for (let i = 0; i < 10; i++) {
                annotator.saveState(`action-${i}`);
            }
            expect(annotator.history.hasUndo()).toBe(true);
            const result = annotator.undo();
            expect(result).toBe(true);
        });
    });
});
