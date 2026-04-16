// MarkinJS - SVG Annotation Library
// Main namespace and module pattern
const MarkinJS = (function() {
    // Constants
    const VERSION = "0.1.0";
    const DEFAULT_ZOOM = 1.0;
    const DEFAULT_STROKE_WIDTH = 2;
    const DEFAULT_HANDLE_RADIUS = 4;
    const DEFAULT_CIRCLE_RADIUS = 5;

    // Safe SVG attributes whitelist (blocks event handlers)
    const SAFE_ATTRIBUTES = new Set([
        'id', 'class', 'fill', 'stroke', 'stroke-width', 'stroke-opacity',
        'fill-opacity', 'r', 'cx', 'cy', 'x', 'y', 'width', 'height',
        'points', 'x1', 'y1', 'x2', 'y2', 'vector-effect', 'data-role',
        'data-uuid', 'data-label', 'data-class', 'data-bound-to',
        'data-contain', 'data-base-stroke-width', 'data-base-radius'
    ]);

    // Utility functions
    const utils = {
        generateUUID() {
            return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            );
        },
        
        clientToSVGPoint(svg, clientX, clientY) {
            const pt = svg.createSVGPoint();
            pt.x = clientX;
            pt.y = clientY;
            const ctm = svg.getScreenCTM();
            if (!ctm) {
                throw new Error('Unable to transform coordinates: getScreenCTM() returned null');
            }
            return pt.matrixTransform(ctm.inverse());
        },

        safeDivide(numerator, denominator, defaultValue = 0) {
            return denominator === 0 ? defaultValue : numerator / denominator;
        },
        
        clientToSVGDelta(svg, clientDeltaX, clientDeltaY) {
            const p1 = utils.clientToSVGPoint(svg, 0, 0);
            const p2 = utils.clientToSVGPoint(svg, 1, 1);
            const scaleX = p2.x - p1.x;
            const scaleY = p2.y - p1.y;
            
            return {
                x: clientDeltaX * scaleX,
                y: clientDeltaY * scaleY
            };
        },
        
        formatPoints(points) {
            // Handle different input formats for points
            if (!points) return '';
            
            if (Array.isArray(points)) {
                if (points.length === 0) return '';
                
                if (typeof points[0] === 'object') {
                    // Array of {x, y} objects
                    return points.map(p => `${p.x},${p.y}`).join(' ');
                } else {
                    // Flat array [x1, y1, x2, y2, ...]
                    const pairs = [];
                    for (let i = 0; i < points.length; i += 2) {
                        if (i + 1 < points.length) {
                            pairs.push(`${points[i]},${points[i + 1]}`);
                        }
                    }
                    return pairs.join(' ');
                }
            } else {
                // Already a string
                return points;
            }
        },
        
        pointsToArray(points) {
            if (!points) return [];
            
            if (Array.isArray(points)) {
                if (typeof points[0] === 'object') {
                    // Already array of {x, y} objects
                    return points;
                } else {
                    // Flat array [x1, y1, x2, y2, ...]
                    const result = [];
                    for (let i = 0; i < points.length; i += 2) {
                        if (i + 1 < points.length) {
                            result.push({
                                x: points[i],
                                y: points[i + 1]
                            });
                        }
                    }
                    return result;
                }
            } else {
                // String format - convert to array of objects
                return points.trim().split(' ').map(pair => {
                    const [x, y] = pair.split(',').map(Number);
                    return { x, y };
                });
            }
        },
        
        // Calculate bounding box of a polygon's points
        polygonBounds(points) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
            }
            return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        },

        // Translate an SVG element by a delta, handling rect/circle/polygon types
        translateElement(element, dx, dy) {
            const tag = element.tagName.toLowerCase();
            if (tag === 'rect') {
                element.setAttribute('x', parseFloat(element.getAttribute('x')) + dx);
                element.setAttribute('y', parseFloat(element.getAttribute('y')) + dy);
            } else if (tag === 'circle') {
                element.setAttribute('cx', parseFloat(element.getAttribute('cx')) + dx);
                element.setAttribute('cy', parseFloat(element.getAttribute('cy')) + dy);
            } else if (tag === 'polygon') {
                const points = utils.pointsToArray(element.getAttribute('points'));
                const moved = points.map(p => ({ x: p.x + dx, y: p.y + dy }));
                element.setAttribute('points', utils.formatPoints(moved));
            }
        },

        // Rescale an element's stroke width (and radius, for circles) to match a zoom level.
        // Reads the pre-zoom base from data-base-stroke-width / data-base-radius.
        applyZoomToElement(element, zoom) {
            const baseStrokeWidth = parseFloat(
                element.getAttribute('data-base-stroke-width') || 2
            );
            element.setAttribute('stroke-width', baseStrokeWidth / zoom);

            if (element.tagName.toLowerCase() === 'circle') {
                const storedBaseRadius = element.getAttribute('data-base-radius');
                const baseRadius = storedBaseRadius
                    ? parseFloat(storedBaseRadius)
                    : parseFloat(element.getAttribute('r')) * zoom;
                if (!storedBaseRadius) {
                    element.setAttribute('data-base-radius', baseRadius);
                }
                element.setAttribute('r', baseRadius / zoom);
            }
        },

        // Get the role of an element (bbox, polygon, keypoint, etc.)
        getElementRole(element) {
            if (!element) return null;
            
            // First check for explicit data-role attribute
            const role = element.getAttribute('data-role');
            if (role) return role;
            
            // Otherwise, use the tag name as a fallback
            const tagName = element.tagName.toLowerCase();
            
            // Special handling for groups
            if (tagName === 'g') {
                return 'group';
            }
            
            return tagName;
        }
    };

    // Element factory - creates SVG elements
    class ElementFactory {
        constructor(svg, zoom = 1) {
            this.svg = svg;
            this.zoom = zoom;
        }

        setZoom(zoom) {
            this.zoom = zoom;
        }

        isSafeAttribute(attrName) {
            // Exact match or prefix match for data-* attributes
            if (SAFE_ATTRIBUTES.has(attrName)) return true;
            if (attrName.startsWith('data-')) return true;
            return false;
        }

        // Create an SVG element with safe attributes applied.
        // Optionally scales stroke width by current zoom, storing the base in data-base-stroke-width.
        _create(tag, attrs = {}, { scaleStroke = false } = {}) {
            const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
            if (scaleStroke) {
                const baseStrokeWidth = attrs.strokeWidth || DEFAULT_STROKE_WIDTH;
                el.setAttribute('data-base-stroke-width', baseStrokeWidth);
                el.setAttribute('stroke-width', baseStrokeWidth / this.zoom);
            }
            this._applyAttrs(el, attrs, { skipStroke: scaleStroke });
            return el;
        }

        _applyAttrs(el, attrs, { skipStroke = false } = {}) {
            for (const [key, value] of Object.entries(attrs)) {
                if (skipStroke && key === 'strokeWidth') continue;
                const attrName = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                // Block event handlers and validate attribute name
                if (/^on/.test(attrName) || !this.isSafeAttribute(attrName)) continue;
                el.setAttribute(attrName, String(value));
            }
        }

        createRect(x, y, width, height, attrs = {}) {
            const rect = this._create('rect', attrs, { scaleStroke: true });
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            return rect;
        }

        createCircle(cx, cy, r, attrs = {}) {
            const circle = this._create('circle', attrs, { scaleStroke: true });
            circle.setAttribute('cx', cx);
            circle.setAttribute('cy', cy);
            const baseRadius = r || DEFAULT_CIRCLE_RADIUS;
            circle.setAttribute('data-base-radius', baseRadius);
            circle.setAttribute('r', baseRadius / this.zoom);
            return circle;
        }

        createPolygon(points, attrs = {}) {
            const polygon = this._create('polygon', attrs, { scaleStroke: true });
            polygon.setAttribute('points', utils.formatPoints(points));
            return polygon;
        }

        createGroup(attrs = {}) {
            return this._create('g', attrs);
        }

        createLine(x1, y1, x2, y2, attrs = {}) {
            const line = this._create('line', attrs, { scaleStroke: true });
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            return line;
        }
    }

    // Event System - manages custom events
    class EventSystem {
        constructor() {
            this.listeners = {};
        }
        
        on(eventName, callback) {
            if (!this.listeners[eventName]) {
                this.listeners[eventName] = [];
            }
            this.listeners[eventName].push(callback);
            return this; // For chaining
        }
        
        off(eventName, callback) {
            if (this.listeners[eventName]) {
                if (callback) {
                    this.listeners[eventName] = this.listeners[eventName]
                        .filter(listener => listener !== callback);
                } else {
                    // Remove all listeners for this event
                    delete this.listeners[eventName];
                }
            }
            return this; // For chaining
        }
        
        emit(eventName, data) {
            if (this.listeners[eventName]) {
                this.listeners[eventName].forEach(callback => callback(data));
            }
            return this; // For chaining
        }
    }

    // Selection Manager - handles element selection
    class SelectionManager {
        constructor(annotator) {
            this.annotator = annotator;
            this.selectedElement = null;
            this.selectableTypes = ['rect', 'circle', 'polygon', 'g'];
        }
        
        isSelectable(element) {
            if (!element) return false;
            
            // Ignore handler elements
            if (element.hasAttribute('data-handle-type')) return false;
            if (element.getAttribute('data-role') === 'cross-indicator') return false;
            if (element.getAttribute('data-role') === 'mask-candidate') return false;
            
            const tagName = element.tagName.toLowerCase();
            return this.selectableTypes.includes(tagName);
        }
        
        findSelectableElement(element) {
            // Check if element itself is selectable
            if (this.isSelectable(element)) {
                return element;
            }
            
            // Check parent elements up to the SVG
            let parent = element?.parentElement;
            while (parent && parent !== this.annotator.svg) {
                if (this.isSelectable(parent)) {
                    return parent;
                }
                parent = parent.parentElement;
            }
            
            return null;
        }
        
        select(element) {
            if (!element) return false;
            
            // Clear previous selection
            if (this.selectedElement && this.selectedElement !== element) {
                this.deselect();
            }
            
            // Set new selection
            this.selectedElement = element;
            
            // Apply highlighting
            this.highlightElement(element);
            
            // Make sure we clear any old handles before showing new ones
            this.annotator.handleManager.clearHandles();
            
            // Emit selection event
            this.annotator.events.emit('select', {
                element: element,
                type: element.tagName.toLowerCase(),
                data: this.annotator.getElementData(element)
            });
            
            return true;
        }
        
        deselect() {
            if (!this.selectedElement) return false;
            
            const previousElement = this.selectedElement;
            
            // Remove highlighting
            this.removeHighlight(previousElement);
            
            // Clear handles
            this.annotator.handleManager.clearHandles();
            
            // Clear selection
            this.selectedElement = null;
            
            // Emit deselection event
            this.annotator.events.emit('deselect', {
                element: previousElement,
                type: previousElement.tagName.toLowerCase()
            });
            
            return true;
        }
        
        getSelected() {
            return this.selectedElement;
        }
        
        highlightElement(element) {
            if (!element) return;
            
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'circle') {
                // Check if the element is already highlighted
                if (element.hasAttribute('data-selected')) {
                    // Already highlighted, don't change it again
                    return;
                }
                
                // Get the base radius (zoom-independent value)
                const baseRadius = element.hasAttribute('data-base-radius') ? 
                    parseFloat(element.getAttribute('data-base-radius')) : 
                    parseFloat(element.getAttribute('r')) * this.annotator.zoom;
                
                // Store base radius if not already stored
                if (!element.hasAttribute('data-base-radius')) {
                    element.setAttribute('data-base-radius', baseRadius);
                }
                
                // Store original properties using zoom-independent values
                element._originalProps = {
                    baseRadius: baseRadius,
                    fillOpacity: element.getAttribute('fill-opacity') || '0.5'
                };
                
                // Apply highlighting with proper zoom scaling
                const highlightRadius = (baseRadius * 3) / this.annotator.zoom;
                element.setAttribute('r', highlightRadius);
                element.setAttribute('fill-opacity', '0.05');
                element.setAttribute('data-selected', 'true');
                
                // Add cross indicator
                this.annotator.handleManager.addCrossIndicator(element);
            } else if (tagName === 'g') {
                // For groups, don't apply stroke-dasharray to the group itself
                element.setAttribute('data-selected', 'true');
                
                // Find the first child element that is a valid selectable element
                // (typically the bbox rect) and highlight that instead
                const children = element.children;
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    if (child.tagName.toLowerCase() === 'rect' && 
                        child.getAttribute('data-role') === 'bbox') {
                        child.setAttribute('stroke-dasharray', '5,5');
                        child.setAttribute('data-selected', 'true');
                        break;
                    }
                }
            } else {
                // Standard highlighting for other elements
                element.setAttribute('stroke-dasharray', '5,5');
                element.setAttribute('data-selected', 'true');
            }
        }
        
        removeHighlight(element) {
            if (!element) return;
            
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'circle') {
                // Only restore if we have original properties stored
                if (element._originalProps) {
                    // Restore original properties with proper zoom scaling
                    const normalRadius = element._originalProps.baseRadius / this.annotator.zoom;
                    element.setAttribute('r', normalRadius);
                    element.setAttribute('fill-opacity', element._originalProps.fillOpacity);
                    delete element._originalProps;
                }
                element.removeAttribute('data-selected');
            } else if (tagName === 'g') {
                // For groups, remove the data-selected attribute
                element.removeAttribute('data-selected');
                element.removeAttribute('data-has-selected-child');
                
                // Find and unhighlight children
                const children = element.children;
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    if (child.hasAttribute('data-selected')) {
                        child.removeAttribute('data-selected');
                        child.setAttribute('stroke-dasharray', '');
                    }
                }
            } else {
                // Standard unhighlighting for other elements
                element.setAttribute('stroke-dasharray', '');
                element.removeAttribute('data-selected');
            }
        }
    }

    // Main SVG Annotator Class
    class SVGAnnotator {
        constructor(svgId, options = {}) {
            // Get SVG element
            this.svg = document.getElementById(svgId);
            if (!this.svg) {
                throw new Error(`SVG element with id '${svgId}' not found`);
            }
            
            // Default options
            this.options = {
                zoom: 1.0,
                historyEnabled: true,
                historyMaxStates: 50,
                keyboardControls: true,  // Enable keyboard controls by default
                requireBbox: false,
                requireSelectionToDrag: true, // Require elements to be selected before they can be dragged
                bboxContainPolygon: true,
                bboxContainKeypoints: true,
                autoResizeBbox: true,
                bindElements: true,
                // Default deletion rules
                deletionRules: {
                    "bbox": ["keypoint", "polygon", "group"],
                    "keypoint": [],
                    "polygon": ["bbox"]
                },
                ...options
            };
            
            // State variables
            this.enabled = true;
            this.zoom = this.options.zoom;
            this.dragInfo = null;
            this.uuidRegistry = {}; // Initialize the UUID registry object
            this.containmentCache = null; // Cache for containment elements
            
            // Initialize component systems
            this.events = new EventSystem();
            this.elementFactory = new ElementFactory(this.svg, this.zoom);
            this.selection = new SelectionManager(this);
            this.handleManager = new HandleManager(this);
            
            // Initialize history manager if enabled
            if (this.options.historyEnabled) {
                this.history = new HistoryManager(this, this.options.historyMaxStates);
                // Save initial state
                this.history.saveState('initial');
            }
            
            // Bind event handlers
            this.boundHandleMouseMove = this.handleMouseMove.bind(this);
            this.boundHandleClick = this.handleClick.bind(this);
            this.boundHandleMouseDown = this.handleSvgMouseDown.bind(this);
            this.boundHandleGlobalMouseMove = this.handleGlobalMouseMove.bind(this);
            this.boundHandleGlobalMouseUp = this.handleGlobalMouseUp.bind(this);
            this.boundHandleKeyDown = this.handleKeyDown.bind(this);
            
            // Initialize events
            this.initEvents();

        }

        // Single logging hook. Routes to console by default; can be silenced
        // via options.silent or redirected via options.logger(level, message).
        _log(level, message) {
            if (this.options.silent) return;
            if (typeof this.options.logger === 'function') {
                this.options.logger(level, message);
                return;
            }
            (console[level] || console.error)(message);
        }

        // Initialize events
        initEvents() {
            // Add mousemove event to detect selectable elements
            this.svg.addEventListener('mousemove', this.boundHandleMouseMove);
            // Delegated mousedown for starting drags on any annotation element
            this.svg.addEventListener('mousedown', this.boundHandleMouseDown);
            // Add click event to select elements
            this.svg.addEventListener('click', this.boundHandleClick);

            // Global mouse events for dragging
            document.addEventListener('mousemove', this.boundHandleGlobalMouseMove);
            document.addEventListener('mouseup', this.boundHandleGlobalMouseUp);

            // Add keyboard event listener if keyboard controls are enabled
            if (this.options.keyboardControls) {
                document.addEventListener('keydown', this.boundHandleKeyDown);
            }
        }
        
        // Handle mouse move for hover effects
        handleMouseMove(event) {
            // Skip if we're dragging
            if (this.dragInfo) return;
            
            // Get the element under the cursor
            const x = event.clientX;
            const y = event.clientY;
            const element = document.elementFromPoint(x, y);
            
            // Check if the element or its parent is selectable
            const targetElement = this.selection.findSelectableElement(element);
            
            if (targetElement) {
                // Change cursor to pointer for selectable elements
                this.svg.style.cursor = 'pointer';
                
                // If element is already selected, show move cursor
                if (targetElement === this.selection.getSelected()) {
                    this.svg.style.cursor = 'move';
                }
                
                // Emit hoverelement event
                this.events.emit('hoverelement', {
                    element: targetElement,
                    type: targetElement.tagName.toLowerCase(),
                    position: utils.clientToSVGPoint(this.svg, event.clientX, event.clientY)
                });
            } else {
                // Reset cursor
                this.svg.style.cursor = 'default';
                
                // Emit hovercanvas event when not over an element
                this.events.emit('hovercanvas', {
                    position: utils.clientToSVGPoint(this.svg, event.clientX, event.clientY)
                });
            }
        }
        
        // Handle click for selection
        handleClick(event) {
            // Skip if we're in the middle of a drag
            if (this.dragInfo) return;
            
            // Get the element under the cursor
            const x = event.clientX;
            const y = event.clientY;
            const element = document.elementFromPoint(x, y);
            
            if (!element) return;
            
            // Skip elements that are handles or indicators
            if (element.hasAttribute('data-handle-type') || 
                element.getAttribute('data-role') === 'cross-indicator') {
                return;
            }
            
            // Find selectable element
            const targetElement = this.selection.findSelectableElement(element);
            
            if (targetElement) {
                // Select the element and show handles
                this.selection.select(targetElement);
                this.handleManager.showHandlesForElement(targetElement);
            } else {
                // Deselect if clicking empty space
                if (this.selection.getSelected()) {
                    this.selection.deselect();
                    
                    // Emit canvas click event
                    this.events.emit('canvasclick', {
                        position: utils.clientToSVGPoint(this.svg, event.clientX, event.clientY)
                    });
                }
            }
        }
        
        // Delegated mousedown handler on the SVG root. Replaces per-element drag
        // handlers — finds the selectable ancestor of the event target and starts
        // a drag on it, subject to requireSelectionToDrag gating.
        handleSvgMouseDown(e) {
            // Skip if the event originated on a handle or indicator
            if (e.target.hasAttribute('data-handle-type')) return;
            if (e.target.getAttribute('data-role') === 'cross-indicator') return;

            const element = this.selection.findSelectableElement(e.target);
            if (!element) return;

            // If requireSelectionToDrag is enabled, only drag selected elements.
            // The subsequent click will select the element for a later drag.
            if (this.options.requireSelectionToDrag && element !== this.selection.getSelected()) {
                return;
            }

            const svgPoint = utils.clientToSVGPoint(this.svg, e.clientX, e.clientY);

            this.dragInfo = {
                handle: null,
                handleType: 'direct-move',
                index: -1,
                targetElement: element,
                startClientX: e.clientX,
                startClientY: e.clientY,
                lastClientX: e.clientX,
                lastClientY: e.clientY,
                startSVGX: svgPoint.x,
                startSVGY: svgPoint.y,
                originalData: this.getElementData(element)
            };

            this.events.emit('dragstart', {
                element: element,
                type: element.tagName.toLowerCase(),
                handleType: 'direct-move',
                position: svgPoint
            });
        }
        
        // Handle global mouse move for dragging
        handleGlobalMouseMove(event) {
            if (!this.dragInfo) return;
            
            event.preventDefault();
            
            // Get current SVG point
            const currentPoint = utils.clientToSVGPoint(this.svg, event.clientX, event.clientY);
            
            // Calculate delta in client coordinates
            const clientDeltaX = event.clientX - this.dragInfo.lastClientX;
            const clientDeltaY = event.clientY - this.dragInfo.lastClientY;
            
            // Update last client position
            this.dragInfo.lastClientX = event.clientX;
            this.dragInfo.lastClientY = event.clientY;
            
            const { handleType, targetElement } = this.dragInfo;
            const tagName = targetElement.tagName.toLowerCase();
            
            // Handle different element types and handle types
            if (tagName === 'rect') {
                if (handleType.startsWith('corner-')) {
                    this.handleRectResize(clientDeltaX, clientDeltaY);
                } else if (handleType === 'move' || handleType === 'direct-move') {
                    this.handleRectMove(clientDeltaX, clientDeltaY);
                }
            } else if (tagName === 'polygon') {
                if (handleType === 'vertex') {
                    this.handlePolygonVertexDrag(currentPoint);
                } else if (handleType === 'move' || handleType === 'direct-move') {
                    this.handlePolygonMove(clientDeltaX, clientDeltaY);
                }
            } else if (tagName === 'circle') {
                if (handleType === 'move' || handleType === 'direct-move') {
                    this.handleCircleMove(clientDeltaX, clientDeltaY);
                }
            }
            
            // Emit drag event
            this.events.emit('drag', {
                    element: targetElement,
                type: tagName,
                    handleType: handleType,
                position: currentPoint,
                delta: utils.clientToSVGDelta(this.svg, clientDeltaX, clientDeltaY)
            });
        }
        
        // Handle global mouse up for ending drag
        handleGlobalMouseUp(event) {
            if (!this.dragInfo) return;
            
            // Get final position
            const finalPoint = utils.clientToSVGPoint(this.svg, event.clientX, event.clientY);
            
            // Get the target element before clearing dragInfo
            const targetElement = this.dragInfo.targetElement;
            const handleType = this.dragInfo.handleType;
            
            // Emit dragend event
            this.events.emit('dragend', {
                element: targetElement,
                type: targetElement.tagName.toLowerCase(),
                handleType: handleType,
                startPosition: {
                    x: this.dragInfo.startSVGX,
                    y: this.dragInfo.startSVGY
                },
                endPosition: finalPoint,
                data: this.getElementData(targetElement)
            });
            
            // Emit elementmoved event after mouse drag
            if (targetElement) {
                const deltaX = finalPoint.x - this.dragInfo.startSVGX;
                const deltaY = finalPoint.y - this.dragInfo.startSVGY;
                
                // Only emit if there was actual movement
                if (deltaX !== 0 || deltaY !== 0) {
                    this.events.emit('elementmoved', {
                        element: targetElement,
                        type: targetElement.tagName.toLowerCase(),
                        deltaX: deltaX,
                        deltaY: deltaY
                    });
                    
                    // Also emit annotationmodified event for any changes
                    this.events.emit('annotationmodified', {
                        element: targetElement,
                        type: targetElement.tagName.toLowerCase(),
                        modification: 'position',
                        data: this.getElementData(targetElement)
                    });
                    
                    // Emit a single event for modification completion
                    let modificationType = 'position';
                    if (handleType.startsWith('corner-')) {
                        modificationType = 'resize';
                    } else if (handleType === 'vertex') {
                        modificationType = 'vertex';
                    }
                    
                    this.events.emit('annotationmodificationcomplete', {
                        element: targetElement,
                        type: targetElement.tagName.toLowerCase(),
                        modificationType: modificationType,
                        handleType: handleType,
                        data: this.getElementData(targetElement)
                    });
                    
                    // Save state after successful movement for undo/redo
                    this.saveState(`move_${targetElement.tagName.toLowerCase()}`);
                }
            }
            
            // Keep the element selected
            if (targetElement) {
                // If this was a vertex drag or direct move, keep the same element selected
                // and make sure handles are still visible
                this.selection.select(targetElement);
                this.handleManager.showHandlesForElement(targetElement);
            }

            // Clear drag info
            this.dragInfo = null;
        }
        
        // Handle keyboard events
        handleKeyDown(event) {
            if (!this.enabled) return;
            
            // Handle undo/redo if history is enabled (should work regardless of selection)
            if (event.key === 'z' && (event.ctrlKey || event.metaKey)) {
                if (event.shiftKey) {
                    // Ctrl+Shift+Z or Cmd+Shift+Z = Redo
                    this.redo();
                } else {
                    // Ctrl+Z or Cmd+Z = Undo
                    this.undo();
                }
                // Prevent default browser behavior
                event.preventDefault();
                return;
            }
            
            // Skip if annotator is disabled or no element is selected
            if (!this.enabled || !this.selection.selectedElement) return;
            
            // Get the selected element
            const selectedElement = this.selection.getSelected();
            if (!selectedElement) return;
            
            // Handle Delete key
            if (event.key === "Delete" || event.key === "Backspace") {
                this.deleteSelectedElement();
                return;
            }
            
            // Handle arrow keys for movement
            if (event.key.startsWith('Arrow')) {
                // Determine movement distance based on modifier keys
                let distance = 1; // Default: 1px
                
                if (event.shiftKey) {
                    distance = 10; // Shift: 10px
                } else if (event.ctrlKey || event.metaKey) {
                    distance = 0.2; // Ctrl/Cmd: 0.2px
                }
                
                // Calculate movement delta
                let deltaX = 0;
                let deltaY = 0;
                
                switch (event.key) {
                    case 'ArrowLeft':
                        deltaX = -distance;
                        break;
                    case 'ArrowRight':
                        deltaX = distance;
                        break;
                    case 'ArrowUp':
                        deltaY = -distance;
                        break;
                    case 'ArrowDown':
                        deltaY = distance;
                        break;
                }
                
                // Don't scroll the page when using arrow keys
                event.preventDefault();
                
                // Apply movement
                this.moveElementByDelta(selectedElement, deltaX, deltaY);
                
                // Emit annotationmodificationcomplete event for keyboard movement
                this.events.emit('annotationmodificationcomplete', {
                    element: selectedElement,
                    type: selectedElement.tagName.toLowerCase(),
                    modificationType: 'position',
                    handleType: 'keyboard',
                    data: this.getElementData(selectedElement)
                });
                
                // Save state after keyboard movement for undo/redo
                this.saveState(`keyboard_move_${selectedElement.tagName.toLowerCase()}`);
            }
        }
        
        // Move an element by a delta amount
        moveElementByDelta(element, deltaX, deltaY) {
            if (!element) return;
            
            const tagName = element.tagName.toLowerCase();
            
            // Apply movement based on element type
            if (tagName === 'rect') {
                const x = parseFloat(element.getAttribute('x'));
                const y = parseFloat(element.getAttribute('y'));
                
                element.setAttribute('x', x + deltaX);
                element.setAttribute('y', y + deltaY);
                
                // Update handle positions if this is the selected element
                if (element === this.selection.getSelected()) {
                    this.handleManager.updateRectHandlePositions(element);
                }
                
                // Update bound elements
                this.updateBoundElements(element, { x: deltaX, y: deltaY });
                
            } else if (tagName === 'polygon') {
                const pointsString = element.getAttribute('points');
                if (!pointsString) return;
                
                const points = utils.pointsToArray(pointsString);
                const updatedPoints = points.map(point => ({
                    x: point.x + deltaX,
                    y: point.y + deltaY
                }));
                
                element.setAttribute('points', utils.formatPoints(updatedPoints));
                
                // Update handle positions if this is the selected element
                if (element === this.selection.getSelected()) {
                    this.handleManager.updatePolygonHandlePositions(element, updatedPoints);
                }
                
                // Apply containment after updating position
                this.enforceContainment(element);
                
            } else if (tagName === 'circle') {
                const cx = parseFloat(element.getAttribute('cx'));
                const cy = parseFloat(element.getAttribute('cy'));

                element.setAttribute('cx', cx + deltaX);
                element.setAttribute('cy', cy + deltaY);

                // Update handle position if this is the selected element
                if (element === this.selection.getSelected()) {
                    this.handleManager.updateCircleHandlePosition(element);
                }

                // Update cross indicator if the circle is selected
                if (element.hasAttribute('data-selected')) {
                    this.handleManager.updateCrossIndicator(element);
                }

                // Apply containment after updating position
                this.enforceContainment(element);
                
            } else if (tagName === 'g') {
                // For groups, we need to move all child elements
                Array.from(element.children).forEach(child => {
                    // Skip utility elements like handles
                    if (child.hasAttribute('data-handle-type') || 
                        child.getAttribute('data-role') === 'cross-indicator') {
                        return;
                    }
                    
                    // Recursively move each child
                    this.moveElementByDelta(child, deltaX, deltaY);
                });
            }
            
            // Emit movement event
            this.events.emit('elementmoved', {
                element: element,
                type: element.tagName.toLowerCase(),
                deltaX: deltaX,
                deltaY: deltaY
            });
        }
        
        // Delete the currently selected element
        deleteSelectedElement() {
            const selectedElement = this.selection.getSelected();
            if (!selectedElement) return;
            
            // Get the element's role and determine what needs to be deleted
            this.deleteElement(selectedElement);
            
            // Clear selection
            this.selection.deselect();
            
            // Clear handles
            this.handleManager.clearHandles();
        }
        
        // Handle binding relationships when deleting an element
        _handleBindingOnDelete(element, group) {
            if (!this.options.bindElements) return;

            const elementId = element.getAttribute('id');
            const elementRole = utils.getElementRole(element);
            let deletionMode = 'unbind';
            let rulesToApply = [];

            // Determine deletion mode from group's rules
            if (group) {
                try {
                    const rules = JSON.parse(group.getAttribute('data-deletion-rules') || '{}');
                    if (rules[elementRole] && Array.isArray(rules[elementRole]) && rules[elementRole].length > 0) {
                        deletionMode = 'delete';
                        rulesToApply = rules[elementRole];
                    }
                } catch (e) {
                    this._log('error', `Error parsing deletion rules: ${e.message}`);
                }
            }

            // Forward: handle elements bound TO this element
            if (elementId) {
                const boundElements = this.svg.querySelectorAll(`[data-bound-to="${CSS.escape(elementId)}"]`);
                if (deletionMode === 'delete') {
                    boundElements.forEach(bound => {
                        if (bound.parentNode) {
                            bound.parentNode.removeChild(bound);
                            const boundUuid = bound.getAttribute('data-uuid');
                            if (boundUuid && this.uuidRegistry[boundUuid]) {
                                delete this.uuidRegistry[boundUuid];
                            }
                        }
                    });
                } else {
                    boundElements.forEach(bound => bound.removeAttribute('data-bound-to'));
                }
            }

            // Reverse: handle elements THIS element is bound TO
            if (element.hasAttribute('data-bound-to') && rulesToApply.length > 0) {
                const boundToId = element.getAttribute('data-bound-to');
                const boundToElement = this.svg.querySelector(`#${CSS.escape(boundToId)}`);
                if (boundToElement) {
                    const boundToRole = utils.getElementRole(boundToElement);
                    if (rulesToApply.includes(boundToRole) && boundToElement.parentNode) {
                        boundToElement.parentNode.removeChild(boundToElement);
                        const boundToUuid = boundToElement.getAttribute('data-uuid');
                        if (boundToUuid && this.uuidRegistry[boundToUuid]) {
                            delete this.uuidRegistry[boundToUuid];
                        }
                    }
                }
            }
        }

        // Delete an element and any related elements based on rules
        deleteElement(element) {
            if (!element) return;
            
            // Get element info before removal for the event
            const elementInfo = {
                type: element.tagName.toLowerCase(),
                role: utils.getElementRole(element),
                uuid: element.getAttribute('data-uuid') || null,
                groupId: null
            };
            
            // If element is in a group, store the group id
            const group = element.closest('g[data-annotation-group="true"]');
            if (group) {
                elementInfo.groupId = group.getAttribute('data-group-id') || group.getAttribute('data-uuid');
            }
            
            // Emit beforedelete event
            this.events.emit('beforedelete', elementInfo);
            
            // If element is the selected element, deselect it first
            if (this.selection.getSelected() === element) {
                this.selection.deselect();
            }
            
            // If element is a group, use the specialized group removal
            if (element.tagName.toLowerCase() === 'g') {
                this.deleteGroup(element);
                return;
            }
            
            // Handle binding relationships before removing the element
            this._handleBindingOnDelete(element, group);

            // Remove element from its parent
            if (element.parentNode) {
                element.parentNode.removeChild(element);

                // If parent is a group, check if it's now empty and should be removed
                if (group) {
                    this.cleanupGroupIfNeeded(group);
                }
            }
            
            // Emit delete event
            this.events.emit('delete', elementInfo);
            
            // Emit annotationmodified event for deletion
            this.events.emit('annotationmodified', {
                type: elementInfo.type,
                modification: 'delete',
                data: elementInfo
            });
            
            // Emit annotationmodificationcomplete event for deletion
            this.events.emit('annotationmodificationcomplete', {
                type: elementInfo.type,
                modificationType: 'delete',
                data: elementInfo
            });
            
            // Remove from UUID registry if it exists
            const uuid = element.getAttribute('data-uuid');
            if (uuid && this.uuidRegistry && this.uuidRegistry[uuid]) {
                delete this.uuidRegistry[uuid];
            }
            
            // Invalidate containment cache — deleted element may have had data-contain
            this.containmentCache = null;

            // Save state after deletion
            this.saveState('delete_element');
        }
        
        // Check if a group is empty or only contains utility elements, and delete if needed
        cleanupGroupIfNeeded(group) {
            if (!group) return;
            
            // If there are no children, delete the group
            if (group.children.length === 0) {
                this.deleteGroup(group);
                return;
            }
            
            // Check if the group only has utility elements (handles, indicators)
            let hasContentElements = false;
            
            // Check each child element
            for (let i = 0; i < group.children.length; i++) {
                const child = group.children[i];
                
                // Skip utility elements like handles and indicators
                if (child.hasAttribute('data-handle-type')) continue;
                if (child.getAttribute('data-role') === 'cross-indicator') continue;
                if (child.getAttribute('data-role') === 'handle') continue;
                
                // Found a content element
                hasContentElements = true;
                break;
            }
            
            // If no content elements found, delete the group
            if (!hasContentElements) {
                this.deleteGroup(group);
            }
        }
        
        // Delete an entire annotation group
        deleteGroup(group) {
            if (!group) return;
            
            const groupId = group.getAttribute('data-uuid');
            
            // Emit event before group deletion
            this.events.emit('beforedeletegroup', {
                group: group,
                groupId: groupId
            });
            
            // Find all elements within the group that have elements bound to them
            Array.from(group.querySelectorAll('[id]')).forEach(element => {
                const elementId = element.getAttribute('id');
                if (elementId) {
                    // Find elements that are bound to this element
                    const boundElements = this.svg.querySelectorAll(`[data-bound-to="${CSS.escape(elementId)}"]`);
                    
                    // Either delete bound elements or unbind them
                    boundElements.forEach(boundElement => {
                        // If the bound element is in the same group, it will be deleted with the group
                        // If it's outside the group, remove the binding
                        if (boundElement.closest('g[data-annotation-group="true"]') !== group) {
                            boundElement.removeAttribute('data-bound-to');
                        }
                    });
                }
            });
            
            // Remove the group from the DOM
            if (group.parentNode) {
                group.parentNode.removeChild(group);
            }
            
            // Remove from UUID registry
            if (groupId && this.uuidRegistry && this.uuidRegistry[groupId]) {
                delete this.uuidRegistry[groupId];
            }
            
            // Invalidate containment cache — deleted group may have contained data-contain elements
            this.containmentCache = null;

            // Emit event after group deletion
            this.events.emit('deletegroup', {
                groupId: groupId
            });
        }
        
        // Get element data based on type
        getElementData(element) {
            if (!element) return null;
            
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'polygon') {
                const pointsString = element.getAttribute('points');
                if (!pointsString) return { type: 'polygon', points: [] };
                
                return {
                    type: 'polygon',
                    points: utils.pointsToArray(pointsString),
                    id: element.getAttribute('id') || '',
                    role: element.getAttribute('data-role') || 'polygon'
                };
            } else if (tagName === 'rect') {
                return {
                    type: 'rect',
                    x: parseFloat(element.getAttribute('x')),
                    y: parseFloat(element.getAttribute('y')),
                    width: parseFloat(element.getAttribute('width')),
                    height: parseFloat(element.getAttribute('height')),
                    id: element.getAttribute('id') || '',
                    role: element.getAttribute('data-role') || 'rect'
                };
            } else if (tagName === 'circle') {
                return {
                    type: 'circle',
                    cx: parseFloat(element.getAttribute('cx')),
                    cy: parseFloat(element.getAttribute('cy')),
                    r: parseFloat(element.getAttribute('r')),
                    id: element.getAttribute('id') || '',
                    label: element.getAttribute('data-label') || '',
                    role: element.getAttribute('data-role') || 'circle'
                };
            } else if (tagName === 'g') {
                // Get information about the group
                return {
                    type: 'group',
                    uuid: element.getAttribute('data-uuid') || '',
                    class: element.getAttribute('data-class') || '',
                    childCount: element.children.length
                };
            }
            
            return null;
        }
        
        // Build the bbox child for an annotation, appending to group. Returns bbox or null.
        _buildBbox(settings, group) {
            if (!settings.requireBbox && !settings.bbox) return null;

            let bx, by, bw, bh;
            if (settings.bbox) {
                const [xmin, ymin, xmax, ymax] = settings.bbox;
                bx = xmin; by = ymin; bw = xmax - xmin; bh = ymax - ymin;
            } else {
                bx = settings.x; by = settings.y; bw = settings.width; bh = settings.height;
            }

            const bbox = this.elementFactory.createRect(bx, by, bw, bh, {
                fill: settings.fill,
                stroke: settings.stroke,
                fillOpacity: 0.3,
                strokeOpacity: 0.8,
                class: 'BboxElement',
                vectorEffect: "non-scaling-stroke",
                'data-role': 'bbox',
                'id': `bbox-${settings.uuid}`
            });

            this.uuidRegistry[`bbox-${settings.uuid}`] = { type: 'rect', element: bbox };

            if (settings.bindElements && settings.containRules && settings.containRules.length > 0) {
                bbox.setAttribute('data-contain', settings.containRules.join(','));
            } else if (settings.bindElements && settings.bboxContainPolygon && settings.bboxContainKeypoints) {
                bbox.setAttribute('data-contain', 'polygon,keypoint');
            }

            group.appendChild(bbox);
            return bbox;
        }

        // Build the polygon child for an annotation, appending to group if segmentation is provided.
        _buildPolygon(settings, group, bbox) {
            if (!settings.segmentation || settings.segmentation.length < 6) return null;

            const polygon = this.createPolygonFromSegmentation(settings.segmentation, {
                fill: settings.fill,
                stroke: settings.stroke,
                fillOpacity: 0.3,
                strokeOpacity: 0.8,
                vectorEffect: "non-scaling-stroke",
                class: 'PolygonElement',
                'data-role': 'polygon',
                'id': `polygon-${settings.uuid}`
            });

            this.uuidRegistry[`polygon-${settings.uuid}`] = { type: 'polygon', element: polygon };

            if (bbox && settings.bindElements) {
                polygon.setAttribute('data-bound-to', bbox.getAttribute('id'));
            } else if (!settings.bindElements) {
                polygon.setAttribute('data-ignore-containment', 'true');
            }

            group.appendChild(polygon);
            return polygon;
        }

        // Draw static lines between keypoint pairs for visual display. Display-only:
        // not tracked after creation, not updated when keypoints move, not exported.
        _buildSkeleton(settings, group) {
            if (!settings.skeleton || settings.skeleton.length === 0) return;
            if (!settings.keypoints || settings.keypoints.length === 0) return;

            const kps = settings.keypoints;
            const nameToIndex = {};
            kps.forEach((kp, i) => { if (kp && kp.name) nameToIndex[kp.name] = i; });
            const resolve = ref => (typeof ref === 'number') ? ref : nameToIndex[ref];

            const style = settings.skeletonStyle || {};
            const attrs = {
                stroke: style.stroke || settings.stroke || '#0000FF',
                strokeWidth: style.strokeWidth != null ? style.strokeWidth : 2,
                strokeOpacity: style.strokeOpacity != null ? style.strokeOpacity : 0.8,
                vectorEffect: 'non-scaling-stroke',
                'data-role': 'skeleton-edge',
                'data-ignore-containment': 'true'
            };
            if (style.strokeDasharray) attrs.strokeDasharray = style.strokeDasharray;

            settings.skeleton.forEach(edge => {
                const a = kps[resolve(edge[0])];
                const b = kps[resolve(edge[1])];
                if (!a || !a.point || !b || !b.point) return;
                const line = this.elementFactory.createLine(a.point[0], a.point[1], b.point[0], b.point[1], attrs);
                group.appendChild(line);
            });
        }

        // Build keypoint children for an annotation, appending to group.
        _buildKeypoints(settings, group, bbox) {
            if (!settings.keypoints || settings.keypoints.length === 0) return;

            settings.keypoints.forEach((keypoint, index) => {
                if (!keypoint.point || keypoint.point.length !== 2) return;

                const [x, y] = keypoint.point;
                const name = keypoint.name || `keypoint-${index}`;

                const circle = this.elementFactory.createCircle(x, y, 5, {
                    fill: '#FFFFFF',
                    stroke: settings.stroke,
                    fillOpacity: 0.7,
                    strokeOpacity: 0.8,
                    vectorEffect: "non-scaling-stroke",
                    class: 'KeypointElement',
                    'data-role': 'keypoint',
                    'data-label': name,
                    'id': `keypoint-${name}-${settings.uuid}`
                });

                this.uuidRegistry[`keypoint-${name}-${settings.uuid}`] = { type: 'circle', element: circle };

                if (bbox && settings.bindElements) {
                    circle.setAttribute('data-bound-to', bbox.getAttribute('id'));
                } else if (!settings.bindElements) {
                    circle.setAttribute('data-ignore-containment', 'true');
                }

                group.appendChild(circle);
            });
        }

        // Validate createAnnotation options. Returns an error message string
        // on failure, or null if valid.
        _validateAnnotation(options) {
            const isNum = v => typeof v === 'number' && !isNaN(v);

            if (options.bbox) {
                if (!Array.isArray(options.bbox) || options.bbox.length !== 4) {
                    return 'Invalid bbox: must be an array of 4 numbers [x1, y1, x2, y2]';
                }
                if (!options.bbox.every(isNum)) {
                    return 'Invalid bbox: all values must be valid numbers';
                }
            }
            if (options.keypoints) {
                if (!Array.isArray(options.keypoints)) {
                    return 'Invalid keypoints: must be an array';
                }
                for (const kp of options.keypoints) {
                    if (!kp.point || !Array.isArray(kp.point) || kp.point.length !== 2) {
                        return 'Invalid keypoint: each keypoint must have a point array of [x, y]';
                    }
                    if (!kp.point.every(isNum)) {
                        return 'Invalid keypoint: point values must be valid numbers';
                    }
                }
            }
            if (options.segmentation) {
                if (!Array.isArray(options.segmentation)) {
                    return 'Invalid segmentation: must be a flat array of numbers';
                }
                if (options.segmentation.length < 6 || options.segmentation.length % 2 !== 0) {
                    return 'Invalid segmentation: must have at least 6 values (3 points) and an even number of values';
                }
                if (!options.segmentation.every(isNum)) {
                    return 'Invalid segmentation: all values must be valid numbers';
                }
            }
            if (options.skeleton !== undefined && options.skeleton !== null) {
                if (!Array.isArray(options.skeleton)) {
                    return 'Invalid skeleton: must be an array of [from, to] pairs';
                }
                if (options.skeleton.length > 0) {
                    const kps = Array.isArray(options.keypoints) ? options.keypoints : [];
                    const names = new Set(kps.map(kp => kp && kp.name).filter(Boolean));
                    for (const edge of options.skeleton) {
                        if (!Array.isArray(edge) || edge.length !== 2) {
                            return 'Invalid skeleton: each entry must be a 2-tuple [from, to]';
                        }
                        for (const ref of edge) {
                            if (typeof ref === 'number') {
                                if (!Number.isInteger(ref) || ref < 0 || ref >= kps.length) {
                                    return `Invalid skeleton: index ${ref} out of range for ${kps.length} keypoints`;
                                }
                            } else if (typeof ref === 'string') {
                                if (!names.has(ref)) {
                                    return `Invalid skeleton: unknown keypoint name "${ref}"`;
                                }
                            } else {
                                return 'Invalid skeleton: references must be integer index or keypoint name';
                            }
                        }
                    }
                }
            }
            if (options.skeletonStyle !== undefined && options.skeletonStyle !== null) {
                if (typeof options.skeletonStyle !== 'object' || Array.isArray(options.skeletonStyle)) {
                    return 'Invalid skeletonStyle: must be an object';
                }
                const allowed = new Set(['stroke', 'strokeWidth', 'strokeOpacity', 'strokeDasharray']);
                for (const key of Object.keys(options.skeletonStyle)) {
                    if (!allowed.has(key)) {
                        return `Invalid skeletonStyle: unknown field "${key}"`;
                    }
                }
            }
            return null;
        }

        /**
         * Create a new annotation group containing an optional bbox, polygon, and keypoints.
         * @param {object} [options] - Annotation fields.
         * @param {string} [options.uuid] - Stable identifier. Auto-generated if omitted.
         * @param {string} [options.class] - Semantic class/label for the annotation.
         * @param {number[]} [options.bbox] - [xmin, ymin, xmax, ymax]. If omitted, uses x/y/width/height.
         * @param {number} [options.x=100]
         * @param {number} [options.y=100]
         * @param {number} [options.width=200]
         * @param {number} [options.height=150]
         * @param {number[]} [options.segmentation] - Flat [x1,y1,x2,y2,...] polygon points (≥6, even length).
         * @param {Array<{point:number[], name?:string}>} [options.keypoints]
         * @param {string} [options.fill]
         * @param {string} [options.stroke]
         * @param {string} [options.id] - Optional DOM id for the group.
         * @param {boolean} [options.requireBbox]
         * @param {boolean} [options.bindElements]
         * @param {string[]} [options.containRules] - e.g. ['polygon','keypoint'].
         * @param {object} [options.deletionRules]
         * @returns {SVGGElement|null} The created <g> element, or null on invalid input (unless strict).
         */
        createAnnotation(options = {}) {
            const validationError = this._validateAnnotation(options);
            if (validationError) {
                if (this.options.strict) throw new TypeError(validationError);
                this._log('error', validationError);
                return null;
            }

            // Default options
            const defaults = {
                uuid: utils.generateUUID(),
                class: '',
                x: 100,
                y: 100,
                width: 200,
                height: 150,
                fill: 'rgba(0, 0, 255, 0.2)',
                stroke: '#0000FF',
                requireBbox: this.options.requireBbox,
                bboxContainPolygon: this.options.bboxContainPolygon,
                bboxContainKeypoints: this.options.bboxContainKeypoints,
                bindElements: this.options.bindElements,
                containRules: [], // Option for containment rules
                deletionRules: this.options.deletionRules // Default to global deletion rules
            };

            // Merge defaults with provided options
            const settings = {...defaults, ...options};

            // Resolve skeleton defaults. Per-annotation `skeleton` takes precedence;
            // `undefined` falls back to annotator-level default; `[]` means "explicitly none".
            if (options.skeleton === undefined) {
                settings.skeleton = this.options.keypointSkeleton || null;
            }
            if (options.skeletonStyle === undefined) {
                settings.skeletonStyle = this.options.keypointSkeletonStyle || null;
            }
            
            // Create annotation group
            const group = this.elementFactory.createGroup({
                'data-annotation-group': 'true',
                'data-uuid': settings.uuid,
                'data-class': settings.class
            });
            
            // Add ID to group if provided
            if (settings.id) {
                group.setAttribute('id', settings.id);
            }
            
            // Add to UUID registry
            this.uuidRegistry[settings.uuid] = { type: 'group', element: group };
            
            // Save deletion rules with the annotation if provided
            if (settings.deletionRules) {
                group.setAttribute('data-deletion-rules', JSON.stringify(settings.deletionRules));
            }
            
            // Build child elements
            const bbox = this._buildBbox(settings, group);
            this._buildPolygon(settings, group, bbox);
            this._buildSkeleton(settings, group);
            this._buildKeypoints(settings, group, bbox);

            // Select the newly created annotation (select the group)
            this.selection.select(group);
            this.handleManager.showHandlesForElement(group);
            
            // Add the group to the SVG DOM if it's not already there
            if (!group.parentNode) {
                this.svg.appendChild(group);
            }
            
            // Emit event
            this.events.emit('annotationcreated', {
                group: group,
                uuid: settings.uuid,
                class: settings.class
            });
            
            // Invalidate containment cache — new annotation may have data-contain
            this.containmentCache = null;

            // Save state after creating annotation
            this.saveState('create_annotation');

            return group;
        }
        
        // Helper to create polygon from segmentation array
        createPolygonFromSegmentation(segmentation, attrs = {}) {
            const points = [];
            
            // Convert flat array [x1, y1, x2, y2, ...] to array of points
            for (let i = 0; i < segmentation.length; i += 2) {
                if (i + 1 < segmentation.length) {
                    points.push({
                        x: segmentation[i],
                        y: segmentation[i + 1]
                    });
                }
            }
            
            return this.elementFactory.createPolygon(points, attrs);
        }
        
        // Enable the annotator
        enable() {
            if (this.enabled) return;
            this.enabled = true;
            this.initEvents();
            this.events.emit('enabled', { message: 'Annotator enabled' });
        }
        
        // Disable the annotator
        disable() {
            if (!this.enabled) return;
            
            // Clear selection
            this.selection.deselect();
            
            // Remove event listeners
            this.svg.removeEventListener('mousemove', this.boundHandleMouseMove);
            this.svg.removeEventListener('mousedown', this.boundHandleMouseDown);
            this.svg.removeEventListener('click', this.boundHandleClick);
            document.removeEventListener('mousemove', this.boundHandleGlobalMouseMove);
            document.removeEventListener('mouseup', this.boundHandleGlobalMouseUp);

            if (this.options.keyboardControls) {
                document.removeEventListener('keydown', this.boundHandleKeyDown);
            }

            this.enabled = false;
            this.events.emit('disabled', { message: 'Annotator disabled' });
        }

        // Fully destroy the annotator, cleaning up all DOM changes and listeners
        destroy() {
            // Disable first to remove event listeners
            if (this.enabled) {
                this.disable();
            } else {
                // Ensure all listeners are removed even if already disabled
                this.svg.removeEventListener('mousemove', this.boundHandleMouseMove);
                this.svg.removeEventListener('mousedown', this.boundHandleMouseDown);
                this.svg.removeEventListener('click', this.boundHandleClick);
                document.removeEventListener('mousemove', this.boundHandleGlobalMouseMove);
                document.removeEventListener('mouseup', this.boundHandleGlobalMouseUp);
                document.removeEventListener('keydown', this.boundHandleKeyDown);
            }

            // Clear handles
            this.handleManager.clearHandles();

            // Clear history
            if (this.history) {
                this.history.undoStack = [];
                this.history.redoStack = [];
                this.history = null;
            }

            // Clear event listeners
            this.events.listeners = {};

            // Clear UUID registry
            this.uuidRegistry = {};

            // Clear containment cache
            this.containmentCache = null;

            this.events.emit('destroyed', { message: 'Annotator destroyed' });
        }

        // Update zoom level
        setZoom(zoom) {
            if (typeof zoom !== 'number' || zoom <= 0) {
                this._log('error', 'Invalid zoom level. Must be a positive number.');
                return;
            }
            
            this.zoom = zoom;
            this.elementFactory.setZoom(zoom);
            
            // Update all existing elements to match the new zoom level
            this.refreshElementsForZoom();
            
            this.events.emit('zoomchange', { zoom: zoom });
        }
        
        // Public method to manually refresh zoom effects
        refreshZoom() {
            this.refreshElementsForZoom();
            return this;
        }

        // Refresh containment cache for performance optimization
        refreshContainmentCache() {
            this.containmentCache = null;
        }

        // Refresh all elements to match current zoom level
        refreshElementsForZoom() {
            const elements = this.svg.querySelectorAll('rect, circle, polygon, line');

            elements.forEach(element => {
                // Skip handle elements and other utility elements
                if (element.hasAttribute('data-handle-type') ||
                    element.getAttribute('data-role') === 'cross-indicator') {
                    return;
                }

                utils.applyZoomToElement(element, this.zoom);

                // For selected circles, override r with highlight radius and redraw cross indicator
                if (element.tagName.toLowerCase() === 'circle' &&
                    element.hasAttribute('data-selected') && element._originalProps) {
                    const highlightRadius = (element._originalProps.baseRadius * 3) / this.zoom;
                    element.setAttribute('r', highlightRadius);
                    this.handleManager.updateCrossIndicator(element);
                }
            });

            // Update handles if there's a selected element
            const selected = this.selection.getSelected();
            if (selected) {
                this.handleManager.updateHandlePositions(selected);
            }

            // Scale handle sizes according to zoom level
            this.handleManager.scaleHandlesForZoom(this.zoom);
        }
        
        // Get the currently selected element
        getSelectedElement() {
            const element = this.selection.getSelected();
            if (!element) return null;
            
            return {
                element: element,
                type: element.tagName.toLowerCase(),
                data: this.getElementData(element),
                uuid: element.getAttribute('data-uuid') || null,
                class: element.getAttribute('data-class') || null
            };
        }
        
        // Handle rect move
        handleRectMove(clientDeltaX, clientDeltaY) {
            const { targetElement } = this.dragInfo;
            
            // Convert client delta to SVG delta
            const svgDelta = utils.clientToSVGDelta(this.svg, clientDeltaX, clientDeltaY);
            
            // Get current rect properties
            const x = parseFloat(targetElement.getAttribute('x'));
            const y = parseFloat(targetElement.getAttribute('y'));
            
            // Update rectangle position
            targetElement.setAttribute('x', x + svgDelta.x);
            targetElement.setAttribute('y', y + svgDelta.y);
            
            // Update handle positions
            this.handleManager.updateRectHandlePositions(targetElement);
            
            // Handle bound elements
            this.updateBoundElements(targetElement, svgDelta);
        }
        
        // Handle polygon move
        handlePolygonMove(clientDeltaX, clientDeltaY) {
            const { targetElement } = this.dragInfo;
            
            // Convert client delta to SVG delta
            const svgDelta = utils.clientToSVGDelta(this.svg, clientDeltaX, clientDeltaY);
            
            // Get current points
            const pointsString = targetElement.getAttribute('points');
            if (!pointsString) return;
            
            const points = utils.pointsToArray(pointsString);
            
            // Move all points by the delta
            const newPoints = points.map(point => ({
                x: point.x + svgDelta.x,
                y: point.y + svgDelta.y
            }));
            
            // Update polygon
            targetElement.setAttribute('points', utils.formatPoints(newPoints));
            
            // Update handle positions if this is the selected element
            if (targetElement === this.selection.getSelected()) {
                this.handleManager.updatePolygonHandlePositions(targetElement, newPoints);
            }
            
            // Update bound elements
            this.updateBoundElements(targetElement, svgDelta);
            
            // Apply containment after updating positions
            this.enforceContainment(targetElement);
            
            // Emit annotationmodified event
            this.events.emit('annotationmodified', {
                element: targetElement,
                type: targetElement.tagName.toLowerCase(),
                modification: 'position',
                data: this.getElementData(targetElement)
            });
        }
        
        // Handle polygon vertex drag
        handlePolygonVertexDrag(currentPoint) {
            const { targetElement, index } = this.dragInfo;
            
            // Parse current points
            const pointsArray = utils.pointsToArray(targetElement.getAttribute('points'));
            
            // Update the specific vertex
            pointsArray[index] = {
                x: currentPoint.x,
                y: currentPoint.y
            };
            
            // Convert back to string and update the polygon
            const newPointsString = utils.formatPoints(pointsArray);
            targetElement.setAttribute('points', newPointsString);
            
            // Update position of the handle for this vertex
            this.handleManager.updatePolygonHandlePositions(targetElement, pointsArray);
            
            // Apply containment to ensure the polygon stays within bounds
            this.enforceContainment(targetElement);
            
            // Emit annotationmodified event
            this.events.emit('annotationmodified', {
                element: targetElement,
                type: targetElement.tagName.toLowerCase(),
                modification: 'vertex',
                vertexIndex: index,
                data: this.getElementData(targetElement)
            });
        }
        
        // Handle circle move
        handleCircleMove(clientDeltaX, clientDeltaY) {
            const { targetElement } = this.dragInfo;
            
            // Convert client delta to SVG delta
            const svgDelta = utils.clientToSVGDelta(this.svg, clientDeltaX, clientDeltaY);
            
            // Get current circle properties
            const cx = parseFloat(targetElement.getAttribute('cx'));
            const cy = parseFloat(targetElement.getAttribute('cy'));
            
            // Update circle position
            targetElement.setAttribute('cx', cx + svgDelta.x);
            targetElement.setAttribute('cy', cy + svgDelta.y);
            
            // Update handle position
            this.handleManager.updateCircleHandlePosition(targetElement);
            
            // Update cross indicator if the circle is selected
            if (targetElement.hasAttribute('data-selected')) {
                this.handleManager.updateCrossIndicator(targetElement);
            }
            
            // Apply containment - critical to do this AFTER updating position for direct moves
            this.enforceContainment(targetElement);

            // Emit annotationmodified event
            this.events.emit('annotationmodified', {
                element: targetElement,
                type: targetElement.tagName.toLowerCase(),
                modification: 'position',
                data: this.getElementData(targetElement)
            });
        }

        // Handle rect resize
        handleRectResize(clientDeltaX, clientDeltaY) {
            const { handleType, targetElement } = this.dragInfo;
            
            // Convert client delta to SVG delta
            const svgDelta = utils.clientToSVGDelta(this.svg, clientDeltaX, clientDeltaY);
            
            // Get current rect properties
            const x = parseFloat(targetElement.getAttribute('x'));
            const y = parseFloat(targetElement.getAttribute('y'));
            const width = parseFloat(targetElement.getAttribute('width'));
            const height = parseFloat(targetElement.getAttribute('height'));
            
            // Save original values for calculating relative changes
            const originalX = x;
            const originalY = y;
            const originalWidth = width;
            const originalHeight = height;
            
            let newX = x;
            let newY = y;
            let newWidth = width;
            let newHeight = height;
            
            // Adjust rectangle based on which corner is being dragged
            switch (handleType) {
                case 'corner-tl': // Top-left
                    newX = x + svgDelta.x;
                    newY = y + svgDelta.y;
                    newWidth = width - svgDelta.x;
                    newHeight = height - svgDelta.y;
                    break;
                case 'corner-tr': // Top-right
                    newY = y + svgDelta.y;
                    newWidth = width + svgDelta.x;
                    newHeight = height - svgDelta.y;
                    break;
                case 'corner-bl': // Bottom-left
                    newX = x + svgDelta.x;
                    newWidth = width - svgDelta.x;
                    newHeight = height + svgDelta.y;
                    break;
                case 'corner-br': // Bottom-right
                    newWidth = width + svgDelta.x;
                    newHeight = height + svgDelta.y;
                    break;
            }
            
            // Ensure width and height are not negative
            if (newWidth > 0 && newHeight > 0) {
                // Update rectangle
                targetElement.setAttribute('x', newX);
                targetElement.setAttribute('y', newY);
                targetElement.setAttribute('width', newWidth);
                targetElement.setAttribute('height', newHeight);
                
                // Update handle positions
                this.handleManager.updateRectHandlePositions(targetElement);
                
                // Prepare resize info for bound elements
                const resizeInfo = {
                    originalX,
                    originalY,
                    originalWidth,
                    originalHeight,
                    newX,
                    newY, 
                    newWidth,
                    newHeight,
                    deltaX: newX - originalX,
                    deltaY: newY - originalY,
                    scaleX: newWidth / originalWidth,
                    scaleY: newHeight / originalHeight
                };
                
                // Update bound elements
                this.updateBoundElementsOnResize(targetElement, resizeInfo);
                
                // Emit elementmoved event for position changes if position changed
                if (newX !== originalX || newY !== originalY) {
                    this.events.emit('elementmoved', {
                        element: targetElement,
                        type: targetElement.tagName.toLowerCase(),
                        deltaX: newX - originalX,
                        deltaY: newY - originalY
                    });
                }
                
                // Emit annotationmodified event
                this.events.emit('annotationmodified', {
                    element: targetElement,
                    type: targetElement.tagName.toLowerCase(),
                    modification: 'resize',
                    data: this.getElementData(targetElement)
                });
            }
        }
        
        // New method to update elements bound to the target element
        updateBoundElements(targetElement, svgDelta) {
            if (!this.options.bindElements) return;
            
            const targetId = targetElement.getAttribute('id');
            if (!targetId) return;
            
            // Find all elements bound to this element
            const boundElements = this.svg.querySelectorAll(`[data-bound-to="${CSS.escape(targetId)}"]`);

            boundElements.forEach(element => {
                utils.translateElement(element, svgDelta.x, svgDelta.y);

                // Update cross indicator if selected circle
                if (element.tagName.toLowerCase() === 'circle' && element.hasAttribute('data-selected')) {
                    this.handleManager.updateCrossIndicator(element);
                }

                if (this.selection.getSelected() === element) {
                    this.handleManager.updateHandlePositions(element);
                }
            });
            
            // Don't enforce containment here - containment is separate from binding
        }
        
        // Update elements bound to target element during resize
        updateBoundElementsOnResize(targetElement, resizeInfo) {
            if (!this.options.bindElements) return;
            
            const targetId = targetElement.getAttribute('id');
            if (!targetId) return;
            
            const {
                originalX, originalY, originalWidth, originalHeight,
                newX, newY, newWidth, newHeight,
                deltaX, deltaY, scaleX, scaleY
            } = resizeInfo;
            
            // Find all elements bound to this element
            const boundElements = this.svg.querySelectorAll(`[data-bound-to="${CSS.escape(targetId)}"]`);

            boundElements.forEach(element => {
                const tagName = element.tagName.toLowerCase();

                if (tagName === 'circle') {
                    // Calculate relative position in the original rectangle (0-1 range)
                    const cx = parseFloat(element.getAttribute('cx'));
                    const cy = parseFloat(element.getAttribute('cy'));
                    const relativeX = utils.safeDivide(cx - originalX, originalWidth);
                    const relativeY = utils.safeDivide(cy - originalY, originalHeight);
                    
                    // Apply new position based on resized rectangle and relative position
                    const newCx = deltaX + originalX + (relativeX * originalWidth * scaleX);
                    const newCy = deltaY + originalY + (relativeY * originalHeight * scaleY);
                    
                    element.setAttribute('cx', newCx);
                    element.setAttribute('cy', newCy);

                    // Update cross indicator if selected
                    if (element.hasAttribute('data-selected')) {
                        this.handleManager.updateCrossIndicator(element);
                    }
                } else if (tagName === 'polygon') {
                    const pointsString = element.getAttribute('points');
                    if (!pointsString) return;
                    
                    const points = utils.pointsToArray(pointsString);
                    const updatedPoints = points.map(p => {
                        // Calculate relative position in original rectangle
                        const relativeX = utils.safeDivide(p.x - originalX, originalWidth);
                        const relativeY = utils.safeDivide(p.y - originalY, originalHeight);
                        
                        // Apply new position
                        return {
                            x: deltaX + originalX + (relativeX * originalWidth * scaleX),
                            y: deltaY + originalY + (relativeY * originalHeight * scaleY)
                        };
                    });
                    
                    element.setAttribute('points', utils.formatPoints(updatedPoints));
                }
                
                // Check if this element has handles shown and update them
                if (this.selection.getSelected() === element) {
                    this.handleManager.updateHandlePositions(element);
                }
            });
            
            // Enforce containment rules
            this.enforceContainment(targetElement);
        }
        
        // Get bounding rectangle {x, y, width, height} of a container element.
        _getContainerBounds(container) {
            const tag = container.tagName.toLowerCase();
            if (tag === 'rect') {
                return {
                    x: parseFloat(container.getAttribute('x')),
                    y: parseFloat(container.getAttribute('y')),
                    width: parseFloat(container.getAttribute('width')),
                    height: parseFloat(container.getAttribute('height'))
                };
            }
            if (tag === 'polygon') {
                return utils.polygonBounds(utils.pointsToArray(container.getAttribute('points')));
            }
            return null;
        }

        // Constrain strategies — one per contained-element tag.
        // Returns true if the element was moved.
        _constrainCircle(element, bounds) {
            const cx = parseFloat(element.getAttribute('cx'));
            const cy = parseFloat(element.getAttribute('cy'));
            const r = parseFloat(element.getAttribute('r'));
            const newCx = Math.min(Math.max(cx, bounds.x + r), bounds.x + bounds.width - r);
            const newCy = Math.min(Math.max(cy, bounds.y + r), bounds.y + bounds.height - r);
            if (newCx === cx && newCy === cy) return false;
            element.setAttribute('cx', newCx);
            element.setAttribute('cy', newCy);
            if (element.hasAttribute('data-selected')) {
                this.handleManager.updateCrossIndicator(element);
            }
            return true;
        }

        _constrainRect(element, bounds) {
            const x = parseFloat(element.getAttribute('x'));
            const y = parseFloat(element.getAttribute('y'));
            const width = parseFloat(element.getAttribute('width'));
            const height = parseFloat(element.getAttribute('height'));
            const newX = Math.min(Math.max(x, bounds.x), bounds.x + bounds.width - width);
            const newY = Math.min(Math.max(y, bounds.y), bounds.y + bounds.height - height);
            if (newX === x && newY === y) return false;
            element.setAttribute('x', newX);
            element.setAttribute('y', newY);
            return true;
        }

        _constrainPolygon(element, bounds) {
            const pointsString = element.getAttribute('points');
            if (!pointsString) return false;
            const points = utils.pointsToArray(pointsString);
            const pb = utils.polygonBounds(points);

            let adjustX = 0;
            let adjustY = 0;
            if (pb.x < bounds.x) adjustX = bounds.x - pb.x;
            else if (pb.x + pb.width > bounds.x + bounds.width) adjustX = (bounds.x + bounds.width) - (pb.x + pb.width);
            if (pb.y < bounds.y) adjustY = bounds.y - pb.y;
            else if (pb.y + pb.height > bounds.y + bounds.height) adjustY = (bounds.y + bounds.height) - (pb.y + pb.height);

            if (adjustX === 0 && adjustY === 0) return false;
            const adjusted = points.map(p => ({ x: p.x + adjustX, y: p.y + adjustY }));
            element.setAttribute('points', utils.formatPoints(adjusted));
            return true;
        }

        // Enforce containment rules for elements that must stay within boundaries
        enforceContainment(element) {
            if (element.hasAttribute('data-ignore-containment')) return;

            // Lazily populate the cache; invalidated on annotation add/remove.
            if (!this.containmentCache) {
                this.containmentCache = this.svg.querySelectorAll('[data-contain]');
            }
            const containElements = this.containmentCache;
            if (!containElements || containElements.length === 0) return;

            const elType = element.tagName.toLowerCase();
            const elRole = element.getAttribute('data-role');

            const strategy = {
                circle: this._constrainCircle,
                rect: this._constrainRect,
                polygon: this._constrainPolygon
            }[elType];
            if (!strategy) return;

            const elementGroup = element.closest('[data-annotation-group]');

            containElements.forEach(container => {
                const containRules = container.getAttribute('data-contain').split(',');
                const matchesRule = (elRole && containRules.includes(elRole)) ||
                    (elType === 'circle' && containRules.includes('keypoint')) ||
                    (elType === 'polygon' && containRules.includes('polygon'));
                if (!matchesRule) return;
                if (elementGroup !== container.closest('[data-annotation-group]')) return;

                const bounds = this._getContainerBounds(container);
                if (!bounds) return;

                const moved = strategy.call(this, element, bounds);
                if (moved && this.selection.getSelected() === element) {
                    this.handleManager.updateHandlePositions(element);
                }
            });
        }
        
        // Toggle keyboard controls on/off
        enableKeyboardControls() {
            if (!this.options.keyboardControls) {
                this.options.keyboardControls = true;
                document.addEventListener('keydown', this.boundHandleKeyDown);
                this.events.emit('keyboardcontrolsenabled', {});
            }
        }
        
        // Public history management methods
        saveState(action = 'unknown') {
            if (this.options.historyEnabled && this.history) {
                this.history.saveState(action);
            }
        }
        
        undo() {
            if (this.options.historyEnabled && this.history) {
                return this.history.undo();
            }
            return false;
        }
        
        redo() {
            if (this.options.historyEnabled && this.history) {
                return this.history.redo();
            }
            return false;
        }
        
        clearHistory() {
            if (this.options.historyEnabled && this.history) {
                this.history.clearHistory();
            }
        }
        
        disableKeyboardControls() {
            if (this.options.keyboardControls) {
                this.options.keyboardControls = false;
                document.removeEventListener('keydown', this.boundHandleKeyDown);
                this.events.emit('keyboardcontrolsdisabled', {});
            }
        }
        
        // Export a single annotation group to a JSON object
        exportAnnotation(group) {
            if (!group || group.tagName.toLowerCase() !== 'g') {
                this._log('error', 'Invalid annotation group provided');
                return null;
            }
            
            // Base annotation object
            const annotation = {
                uuid: group.getAttribute('data-uuid') || utils.generateUUID(),
                class: group.getAttribute('data-class') || '',
                type: 'annotation'
            };
            
            // Find bounding box
            const bbox = group.querySelector('rect[data-role="bbox"]');
            if (bbox) {
                annotation.bbox = {
                    x: parseFloat(bbox.getAttribute('x')),
                    y: parseFloat(bbox.getAttribute('y')),
                    width: parseFloat(bbox.getAttribute('width')),
                    height: parseFloat(bbox.getAttribute('height')),
                    id: bbox.getAttribute('id') || ''
                };
            }
            
            // Find polygon
            const polygon = group.querySelector('polygon[data-role="polygon"]');
            if (polygon) {
                const pointsString = polygon.getAttribute('points');
                const points = pointsString ? utils.pointsToArray(pointsString) : [];
                
                // Convert points array to flat array for easy use
                const segmentation = [];
                points.forEach(point => {
                    segmentation.push(point.x);
                    segmentation.push(point.y);
                });
                
                annotation.segmentation = segmentation;
                annotation.polygon = {
                    points: points,
                    id: polygon.getAttribute('id') || ''
                };
            }
            
            // Find keypoints
            const keypoints = group.querySelectorAll('circle[data-role="keypoint"]');
            if (keypoints.length > 0) {
                annotation.keypoints = [];

                keypoints.forEach(keypoint => {
                    annotation.keypoints.push({
                        name: keypoint.getAttribute('data-label') || '',
                        id: keypoint.getAttribute('id') || '',
                        point: [
                            parseFloat(keypoint.getAttribute('cx')),
                            parseFloat(keypoint.getAttribute('cy'))
                        ],
                        visible: true // Assuming all keypoints are visible
                    });
                });
            }
            
            // Include custom data-* attributes from the group (safe prefix only)
            const internalAttrs = ['data-uuid', 'data-class', 'data-annotation-group', 'data-deletion-rules', 'data-selected', 'data-bound-to', 'data-contain', 'data-base-stroke-width', 'data-base-radius', 'data-handle-type', 'data-ignore-containment'];
            const customAttrList = group.getAttributeNames().filter(attrName =>
                attrName.startsWith('data-') && !internalAttrs.includes(attrName)
            );
            if (customAttrList.length > 0) {
                annotation.attributes = {};
                customAttrList.forEach(attrName => {
                    annotation.attributes[attrName] = group.getAttribute(attrName);
                });
            }
            
            return annotation;
        }

        // Normalize fields of a single annotation object in place
        _normalizeAnnotationFields(annotation, width, height) {
            if (annotation.bbox) {
                annotation.bbox.x = utils.safeDivide(annotation.bbox.x, width);
                annotation.bbox.y = utils.safeDivide(annotation.bbox.y, height);
                annotation.bbox.width = utils.safeDivide(annotation.bbox.width, width);
                annotation.bbox.height = utils.safeDivide(annotation.bbox.height, height);
                annotation.bbox.normalized = true;
            }
            if (annotation.polygon && annotation.polygon.points) {
                annotation.polygon.points = annotation.polygon.points.map(point => ({
                    x: utils.safeDivide(point.x, width),
                    y: utils.safeDivide(point.y, height)
                }));
                annotation.polygon.normalized = true;
            }
            if (annotation.segmentation && Array.isArray(annotation.segmentation)) {
                for (let i = 0; i < annotation.segmentation.length; i += 2) {
                    if (i + 1 < annotation.segmentation.length) {
                        annotation.segmentation[i] = utils.safeDivide(annotation.segmentation[i], width);
                        annotation.segmentation[i + 1] = utils.safeDivide(annotation.segmentation[i + 1], height);
                    }
                }
                annotation.segmentation_normalized = true;
            }
            if (annotation.keypoints && Array.isArray(annotation.keypoints)) {
                annotation.keypoints.forEach(keypoint => {
                    if (keypoint.point && keypoint.point.length === 2) {
                        keypoint.point = [
                            utils.safeDivide(keypoint.point[0], width),
                            utils.safeDivide(keypoint.point[1], height)
                        ];
                    }
                });
                annotation.keypoints_normalized = true;
            }
        }

        // Get export dimensions from SVG viewBox or rendered size
        _getExportDimensions(options) {
            const viewBox = this.svg.viewBox.baseVal;
            return {
                width: options.width || (viewBox ? viewBox.width : this.svg.width.baseVal.value),
                height: options.height || (viewBox ? viewBox.height : this.svg.height.baseVal.value)
            };
        }

        // Helper function to normalize coordinates
        normalizeCoordinates(data, width, height) {
            if (!data || !width || !height) return data;
            const normalized = JSON.parse(JSON.stringify(data));

            if (normalized.annotations && Array.isArray(normalized.annotations)) {
                normalized.annotations.forEach(a => this._normalizeAnnotationFields(a, width, height));
            } else if (normalized.type === 'annotation') {
                this._normalizeAnnotationFields(normalized, width, height);
            }

            normalized.normalized = true;
            normalized.normalization_width = width;
            normalized.normalization_height = height;
            return normalized;
        }

        // Export all annotations from the SVG
        exportAllAnnotations(options = {}) {
            const annotationGroups = this.svg.querySelectorAll('g[data-annotation-group="true"]');
            const annotations = [];
            
            annotationGroups.forEach(group => {
                const annotation = this.exportAnnotation(group);
                if (annotation) {
                    annotations.push(annotation);
                }
            });
            
            const result = {
                type: 'annotations',
                version: VERSION,
                count: annotations.length,
                annotations: annotations
            };
            
            if (options.normalize) {
                const { width, height } = this._getExportDimensions(options);
                return this.normalizeCoordinates(result, width, height);
            }

            return result;
        }

        // Export the currently selected annotation
        exportSelectedAnnotation(options = {}) {
            const selectedElement = this.selection.getSelected();
            if (!selectedElement) {
                this._log('warn', 'No element selected');
                return null;
            }

            let result;

            // If the selected element is already a group, export it
            if (selectedElement.tagName.toLowerCase() === 'g' &&
                selectedElement.getAttribute('data-annotation-group') === 'true') {
                result = this.exportAnnotation(selectedElement);
            } else {
                // If it's a child element, find its parent group
                const parentGroup = selectedElement.closest('g[data-annotation-group="true"]');
                if (parentGroup) {
                    result = this.exportAnnotation(parentGroup);
                } else {
                    result = {
                        type: 'element',
                        data: this.getElementData(selectedElement)
                    };
                }
            }

            if (result && options.normalize) {
                const { width, height } = this._getExportDimensions(options);
                return this.normalizeCoordinates(result, width, height);
            }

            return result;
        }

        // Get a JSON string of all annotations
        getAnnotationsAsJSON(options = {}) {
            return JSON.stringify(this.exportAllAnnotations(options), null, 2);
        }

        // Get a JSON string of the selected annotation
        getSelectedAnnotationAsJSON(options = {}) {
            const result = this.exportSelectedAnnotation(options);
            return result ? JSON.stringify(result, null, 2) : null;
        }

        // Public method to set requireSelectionToDrag option
        setRequireSelectionToDrag(requireSelection) {
            this.options.requireSelectionToDrag = !!requireSelection;
            
            // Emit event for option change
            this.events.emit('requireselectiontodragchanged', {
                requireSelectionToDrag: this.options.requireSelectionToDrag
            });
        }
        
                
        // Utility method to get current options
        getOptions() {
            return { ...this.options };
        }
        
        // Add a keypoint to an existing annotation
        addKeypoint(groupOrElement, name, x, y, options = {}) {
            // Find the annotation group
            let group;
            if (!groupOrElement) {
                // Use selected element if no element provided
                const selected = this.selection.getSelected();
                if (!selected) {
                    this._log('error', 'No element selected and no element provided');
                    return null;
                }
                group = selected.tagName.toLowerCase() === 'g' ? 
                    selected : selected.closest('g[data-annotation-group="true"]');
            } else {
                group = groupOrElement.tagName.toLowerCase() === 'g' ? 
                    groupOrElement : groupOrElement.closest('g[data-annotation-group="true"]');
            }
            
            if (!group || !group.getAttribute('data-annotation-group')) {
                this._log('error', 'Cannot find valid annotation group');
                return null;
            }
            
            // Get annotation UUID
            const uuid = group.getAttribute('data-uuid');
            if (!uuid) {
                this._log('error', 'Annotation group missing UUID');
                return null;
            }
            
            // Default options
            const settings = {
                fill: options.fill || '#FFFFFF',
                stroke: options.stroke || '#0000FF',
                fillOpacity: options.fillOpacity || 0.7,
                strokeOpacity: options.strokeOpacity || 0.8,
                bindElement: options.bindElement !== undefined ? options.bindElement : this.options.bindElements,
                ...options
            };
            
            // Find the bounding box (for binding)
            const bbox = group.querySelector('rect[data-role="bbox"]');
            
            // Create the keypoint
            const circle = this.elementFactory.createCircle(x, y, 5, {
                fill: settings.fill,
                stroke: settings.stroke,
                fillOpacity: settings.fillOpacity,
                strokeOpacity: settings.strokeOpacity,
                vectorEffect: "non-scaling-stroke",
                class: 'KeypointElement',
                'data-role': 'keypoint',
                'data-label': name,
                'id': `keypoint-${name}-${uuid}`
            });
            
            // Add keypoint to UUID registry
            this.uuidRegistry[`keypoint-${name}-${uuid}`] = { 
                type: 'circle', 
                element: circle 
            };
            
            // Bind keypoint to bbox if both exist and binding is enabled
            if (bbox && settings.bindElement) {
                circle.setAttribute('data-bound-to', bbox.getAttribute('id'));
            } else if (!settings.bindElement) {
                // Mark as ignoring containment if binding is disabled
                circle.setAttribute('data-ignore-containment', 'true');
            }
            
            // Add to the annotation group
            group.appendChild(circle);

            // Save state if history is enabled
            this.saveState('add_keypoint');
            
            // Emit event
            this.events.emit('keypointadded', {
                element: circle,
                name: name,
                position: {x, y},
                group: group
            });
            
            // Emit annotationmodificationcomplete event for keypoint addition
            this.events.emit('annotationmodificationcomplete', {
                element: circle,
                type: 'circle',
                modificationType: 'add_keypoint',
                data: this.getElementData(circle)
            });
            
            // Return the created keypoint
            return circle;
        }
        
        // Update an existing annotation with new properties
        updateAnnotation(options = {}) {
            // Find the annotation to update by id, uuid, or element reference
            let existingGroup = null;
            
            if (options.element && options.element.tagName) {
                // If an element reference is provided
                existingGroup = options.element.tagName.toLowerCase() === 'g' ? 
                    options.element : options.element.closest('g[data-annotation-group="true"]');
            } else if (options.id) {
                // Find by ID attribute
                existingGroup = this.svg.getElementById(options.id);
                
                // If not found by ID, look for elements with that ID inside annotation groups
                if (!existingGroup) {
                    const el = this.svg.querySelector(`#${CSS.escape(options.id)}`);
                    if (el) {
                        existingGroup = el.closest('g[data-annotation-group="true"]');
                    }
                }
            } else if (options.uuid) {
                // Find by UUID attribute
                existingGroup = this.svg.querySelector(`g[data-uuid="${options.uuid}"]`);
            }
            
            if (!existingGroup) {
                this._log('error', 'No existing annotation found to update');
                return null;
            }
            
            // Store original group properties
            const uuid = existingGroup.getAttribute('data-uuid');
            const originalGroup = existingGroup;
            const groupParent = existingGroup.parentNode;
            const nextSibling = existingGroup.nextSibling;
            
            // Prepare options for creating the new annotation
            const newOptions = {
                uuid: uuid, // Preserve the original UUID
                ...options
            };
            
            // If the existing group has an ID attribute, preserve it
            if (existingGroup.hasAttribute('id')) {
                newOptions.id = existingGroup.getAttribute('id');
            }
            
            // Handle the special case where options.id should be set on the group
            if (options.id && !existingGroup.hasAttribute('id')) {
                // We need to manually set the ID after creation
                newOptions._groupId = options.id; // Temporary store to apply after creation
            }
            
            // Delete the old group (without triggering selection events)
            const wasSelected = this.selection.getSelected() === existingGroup;
            if (wasSelected) {
                this.selection.deselect();
            }
            
            // Remove old group from DOM
            groupParent.removeChild(existingGroup);
            
            // Create new annotation with updated options
            const newGroup = this.createAnnotation(newOptions);
            
            // Apply group ID if needed
            if (newOptions._groupId) {
                newGroup.setAttribute('id', newOptions._groupId);
            }
            
            // Restore the position in the DOM if needed
            if (nextSibling) {
                groupParent.insertBefore(newGroup, nextSibling);
            }
            
            // Restore selection if needed
            if (wasSelected) {
                this.selection.select(newGroup);
                this.handleManager.showHandlesForElement(newGroup);
            }
            
            // Save state for undo/redo
            this.saveState('update_annotation');
            
            // Emit event
            this.events.emit('annotationupdated', {
                uuid: uuid,
                id: newGroup.getAttribute('id'),
                group: newGroup,
                oldGroup: originalGroup
            });
            
            return newGroup;
        }
    }

    // Handle Manager - manages element handles and manipulation
    class HandleManager {
        constructor(annotator) {
            this.annotator = annotator;
            this.handles = [];
            this.handleRadius = 4; // Radius for circular handles
        }
        
        clearHandles() {
            // Remove all handle elements from DOM
            this.handles.forEach(handle => {
                if (handle.parentNode) {
                    handle.parentNode.removeChild(handle);
                }
            });
            
            // Also find and remove any left-over handles in the SVG
            const extraHandles = this.annotator.svg.querySelectorAll('[data-handle-type], [data-role="cross-indicator"]');
            extraHandles.forEach(handle => {
                if (handle.parentNode) {
                    handle.parentNode.removeChild(handle);
                }
            });
            
            // Clear the handles array
            this.handles = [];
        }
        
        showHandlesForElement(element) {
            if (!element) return;
            
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'polygon') {
                this.showPolygonVertices(element);
            } else if (tagName === 'rect') {
                this.showCornerHandles(element);
            } else if (tagName === 'circle') {
                this.showCircleHandles(element);
            } else if (tagName === 'g') {
                // For groups, find the first child element to handle
                const children = element.children;
                if (children.length > 0) {
                    const firstChild = children[0];
                    const childTagName = firstChild.tagName.toLowerCase();
                    
                    if (childTagName === 'rect' && firstChild.getAttribute('data-role') === 'bbox') {
                        // Important: Don't mark the group as selected, just the child
                        // Mark the group as having a selected child, but style only the child
                        element.setAttribute('data-has-selected-child', 'true');
                        firstChild.setAttribute('data-selected', 'true');
                        firstChild.setAttribute('stroke-dasharray', '5,5');
                        this.showCornerHandles(firstChild);
                    }
                }
            }
        }
        
        // Add handles for a rectangle (corner handles only)
        showCornerHandles(rect) {
            const x = parseFloat(rect.getAttribute('x'));
            const y = parseFloat(rect.getAttribute('y'));
            const width = parseFloat(rect.getAttribute('width'));
            const height = parseFloat(rect.getAttribute('height'));

            // Create corner handles only, no center move handle
            this.createHandle(x, y, 0, rect, 'corner-tl'); // Top-left
            this.createHandle(x + width, y, 1, rect, 'corner-tr'); // Top-right
            this.createHandle(x, y + height, 2, rect, 'corner-bl'); // Bottom-left
            this.createHandle(x + width, y + height, 3, rect, 'corner-br'); // Bottom-right
        }
        
        // Add handles for a polygon
        showPolygonVertices(polygon) {
            // Get points
            const pointsString = polygon.getAttribute('points');
            if (!pointsString) return;
            
            const points = utils.pointsToArray(pointsString);
            
            // Create handle for each vertex, no center move handle
            points.forEach((point, index) => {
                this.createHandle(point.x, point.y, index, polygon, 'vertex');
            });
        }
        
        // Add handle for a circle
        showCircleHandles(circle) {
            // No handles for circles - they can be moved directly
            // But we should add the cross indicator for visual reference
            this.addCrossIndicator(circle);
        }
        
        // Create a handle element
        createHandle(x, y, index, targetElement, handleType = 'vertex') {
            const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            handle.setAttribute('cx', x);
            handle.setAttribute('cy', y);
            handle.setAttribute('r', this.handleRadius);
            handle.setAttribute('fill', handleType === 'move' ? 'blue' : 'black');
            handle.setAttribute('fill-opacity', '0.5');
            handle.setAttribute('stroke', 'white');
            handle.setAttribute('stroke-width', 1);
            handle.setAttribute('vector-effect', 'non-scaling-stroke');
            handle.setAttribute('data-index', index);
            handle.setAttribute('data-handle-type', handleType);
            handle.setAttribute('pointer-events', 'all');
            handle.setAttribute('class', 'HandleElement');
            
            // Set cursor based on handle type
            if (handleType === 'vertex' || handleType === 'move') {
                handle.setAttribute('cursor', 'move');
            } else if (handleType === 'corner-tl' || handleType === 'corner-br') {
                handle.setAttribute('cursor', 'nwse-resize');
            } else if (handleType === 'corner-tr' || handleType === 'corner-bl') {
                handle.setAttribute('cursor', 'nesw-resize');
            }
            
            // Find appropriate parent - must be a group
            let parentGroup = targetElement.parentElement;
            if (!parentGroup || parentGroup.tagName.toLowerCase() !== 'g') {
                // If no parent group or not a g element, use the SVG root
                parentGroup = this.annotator.svg;
            }
            
            // Append handle
            parentGroup.appendChild(handle);
            this.handles.push(handle);
            
            // Add event listeners for dragging
            this.addHandleDragListeners(handle, targetElement, handleType);
            
            return handle;
        }
        
        // Add drag event listeners to a handle
        addHandleDragListeners(handle, targetElement, handleType) {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevent new selection
                e.preventDefault(); // Prevent default browser behavior
                
                // Get current SVG point for initial position
                const svgPoint = utils.clientToSVGPoint(this.annotator.svg, e.clientX, e.clientY);
                
                // Make sure this element is selected first
                this.annotator.selection.select(targetElement);
                
                // If target element is inside a group, ensure only the element (not the group) is marked as selected
                if (targetElement.parentNode && targetElement.parentNode.tagName.toLowerCase() === 'g') {
                    targetElement.parentNode.removeAttribute('data-selected');
                    targetElement.parentNode.setAttribute('data-has-selected-child', 'true');
                    targetElement.setAttribute('data-selected', 'true');
                    
                    // Apply styling only to the child, not the group
                    if (targetElement.tagName.toLowerCase() !== 'circle') {
                        targetElement.setAttribute('stroke-dasharray', '5,5');
                    }
                }
                
                // Initialize drag info
                this.annotator.dragInfo = {
                    handle: handle,
                    handleType: handleType,
                    index: parseInt(handle.getAttribute('data-index')),
                    targetElement: targetElement,
                    startClientX: e.clientX,
                    startClientY: e.clientY,
                    lastClientX: e.clientX,
                    lastClientY: e.clientY,
                    startSVGX: svgPoint.x,
                    startSVGY: svgPoint.y,
                    originalData: this.annotator.getElementData(targetElement)
                };
                
                // Emit dragstart event
                this.annotator.events.emit('dragstart', {
                    element: targetElement,
                    type: targetElement.tagName.toLowerCase(),
                    handleType: handleType,
                    position: svgPoint
                });
            });
        }
        
        // Calculate the center of a polygon
        calculatePolygonCenter(points) {
            if (!points || points.length === 0) return { x: 0, y: 0 };
            const b = utils.polygonBounds(points);
            return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }
        
        // Add a cross indicator to a circle
        addCrossIndicator(circle) {
            const cx = parseFloat(circle.getAttribute('cx'));
            const cy = parseFloat(circle.getAttribute('cy'));
            const r = parseFloat(circle.getAttribute('r'));
            
            // Create vertical line
            const vLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            vLine.setAttribute('x1', cx);
            vLine.setAttribute('y1', cy - r);
            vLine.setAttribute('x2', cx);
            vLine.setAttribute('y2', cy + r);
            vLine.setAttribute('stroke', '#000000');
            vLine.setAttribute('stroke-width', 1);
            vLine.setAttribute('stroke-opacity', '0.35');
            vLine.setAttribute('data-role', 'cross-indicator');
            vLine.setAttribute('pointer-events', 'none');
            
            // Create horizontal line
            const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            hLine.setAttribute('x1', cx - r);
            hLine.setAttribute('y1', cy);
            hLine.setAttribute('x2', cx + r);
            hLine.setAttribute('y2', cy);
            hLine.setAttribute('stroke', '#000000');
            hLine.setAttribute('stroke-width', 1);
            hLine.setAttribute('stroke-opacity', '0.35');
            hLine.setAttribute('data-role', 'cross-indicator');
            hLine.setAttribute('pointer-events', 'none');
            
            // Add to parent group
            const parent = circle.parentNode;
            parent.appendChild(vLine);
            parent.appendChild(hLine);
            
            // Add to handles for cleanup
            this.handles.push(vLine);
            this.handles.push(hLine);
        }

        updateRectHandlePositions(rect) {
            // Get current rect properties
            const x = parseFloat(rect.getAttribute('x'));
            const y = parseFloat(rect.getAttribute('y'));
            const width = parseFloat(rect.getAttribute('width'));
            const height = parseFloat(rect.getAttribute('height'));
            
            // Update handle positions
            this.handles.forEach(handle => {
                const handleType = handle.getAttribute('data-handle-type');
                
                switch (handleType) {
                    case 'corner-tl':
                        handle.setAttribute('cx', x);
                        handle.setAttribute('cy', y);
                    break;
                    case 'corner-tr':
                        handle.setAttribute('cx', x + width);
                        handle.setAttribute('cy', y);
                    break;
                    case 'corner-bl':
                        handle.setAttribute('cx', x);
                        handle.setAttribute('cy', y + height);
                    break;
                    case 'corner-br':
                        handle.setAttribute('cx', x + width);
                        handle.setAttribute('cy', y + height);
                    break;
            }
            });
        }
        
        updatePolygonHandlePositions(polygon, points) {
            // If points not provided, get them from the polygon
            if (!points) {
                const pointsString = polygon.getAttribute('points');
                if (!pointsString) return;
                points = utils.pointsToArray(pointsString);
            }
            
            // Update handle positions
            this.handles.forEach(handle => {
                const handleType = handle.getAttribute('data-handle-type');
                const index = parseInt(handle.getAttribute('data-index'));
                
                if (handleType === 'vertex' && index >= 0 && index < points.length) {
                    // Update vertex handle
                    handle.setAttribute('cx', points[index].x);
                    handle.setAttribute('cy', points[index].y);
                }
            });
        }
        
        updateCircleHandlePosition(circle) {
            // Circle now uses direct dragging, no need to update handles
        }
        
        // Update the cross indicator for a circle
        updateCrossIndicator(circle) {
            const cx = parseFloat(circle.getAttribute('cx'));
            const cy = parseFloat(circle.getAttribute('cy'));
            const r = parseFloat(circle.getAttribute('r'));
            
            // Find and update cross indicator lines
            this.handles.forEach(handle => {
                if (handle.getAttribute('data-role') === 'cross-indicator') {
                    if (handle.tagName.toLowerCase() === 'line') {
                        const isVertical = handle.getAttribute('x1') === handle.getAttribute('x2');
                        
                        if (isVertical) {
                            // Update vertical line
                            handle.setAttribute('x1', cx);
                            handle.setAttribute('y1', cy - r);
                            handle.setAttribute('x2', cx);
                            handle.setAttribute('y2', cy + r);
            } else {
                            // Update horizontal line
                            handle.setAttribute('x1', cx - r);
                            handle.setAttribute('y1', cy);
                            handle.setAttribute('x2', cx + r);
                            handle.setAttribute('y2', cy);
                        }
                    }
                }
            });
        }
        
        // General method to update handle positions for any element type
        updateHandlePositions(element) {
            if (!element) return;
            
            const tagName = element.tagName.toLowerCase();
            
            if (tagName === 'rect') {
                this.updateRectHandlePositions(element);
            } else if (tagName === 'polygon') {
                this.updatePolygonHandlePositions(element);
            } else if (tagName === 'circle') {
                this.updateCircleHandlePosition(element);
                if (element.hasAttribute('data-selected')) {
                    this.updateCrossIndicator(element);
                }
            }
        }

        // Add a new method to scale handles during zoom operations
        scaleHandlesForZoom(zoom) {
            // Adjust all circular handles to match the current zoom level
            this.handles.forEach(handle => {
                if (handle.tagName.toLowerCase() === 'circle' && handle.hasAttribute('data-handle-type')) {
                    // Store original radius if not already stored
                    if (!handle.hasAttribute('data-base-radius')) {
                        handle.setAttribute('data-base-radius', this.handleRadius);
                    }
                    
                    // Get base radius (default to this.handleRadius)
                    const baseRadius = parseFloat(handle.getAttribute('data-base-radius') || this.handleRadius);
                    
                    // Set radius based on zoom level (smaller radius for higher zoom)
                    handle.setAttribute('r', baseRadius / zoom);
                }
            });
        }
    }
    
    // History Manager for Undo/Redo functionality
    class HistoryManager {
        constructor(annotator, maxStates = 50) {
            this.annotator = annotator;
            this.maxStates = maxStates;
            this.undoStack = [];
            this.redoStack = [];
        }

        // Snapshot only the annotation groups — handles and other transient UI
        // are re-derived on demand. Much cheaper than cloning the whole SVG.
        _snapshot() {
            const groups = this.annotator.svg.querySelectorAll('g[data-annotation-group="true"]');
            return Array.from(groups, g => g.cloneNode(true));
        }

        saveState(action = 'unknown') {
            // Clear redo stack when a new action is performed
            this.redoStack = [];

            this.undoStack.push({
                groups: this._snapshot(),
                action,
                timestamp: Date.now()
            });

            // Limit stack size
            if (this.undoStack.length > this.maxStates) {
                this.undoStack.shift();
            }
        }

        undo() {
            if (this.undoStack.length <= 1) return false;

            const currentState = this.undoStack.pop();
            this.redoStack.push(currentState);

            const prevState = this.undoStack[this.undoStack.length - 1];
            this.applyState(prevState);
            return true;
        }

        redo() {
            if (this.redoStack.length === 0) return false;

            const nextState = this.redoStack.pop();
            this.undoStack.push(nextState);

            this.applyState(nextState);
            return true;
        }

        // Apply a snapshot by swapping the annotation groups currently in the SVG
        // with the snapshot's clones. Clears transient handles first.
        applyState(snapshot) {
            if (!snapshot || !snapshot.groups) return;

            const svg = this.annotator.svg;
            if (!svg) return;

            const wasEnabled = this.annotator.enabled;
            this.annotator.disable();

            // Clear any visible handles/indicators so they don't linger
            this.annotator.handleManager.clearHandles();

            // Remove current annotation groups
            svg.querySelectorAll('g[data-annotation-group="true"]').forEach(g => g.remove());

            // Re-insert snapshot clones
            snapshot.groups.forEach(g => svg.appendChild(g.cloneNode(true)));

            // Containment cache must be rebuilt — containers may have changed
            this.annotator.containmentCache = null;

            if (wasEnabled) this.annotator.enable();
        }

        hasUndo() {
            return this.undoStack.length > 1;
        }

        hasRedo() {
            return this.redoStack.length > 0;
        }

        clearHistory() {
            this.undoStack = [];
            this.redoStack = [];
            this.saveState('initial');
        }
    }

    // Build the shared public API object for an annotator instance
    function buildPublicAPI(annotator) {
        return {
            enable: annotator.enable.bind(annotator),
            disable: annotator.disable.bind(annotator),
            setZoom: annotator.setZoom.bind(annotator),
            enableKeyboardControls: annotator.enableKeyboardControls.bind(annotator),
            disableKeyboardControls: annotator.disableKeyboardControls.bind(annotator),
            getSelectedElement: annotator.getSelectedElement.bind(annotator),
            deselect: annotator.selection.deselect.bind(annotator.selection),
            deleteSelectedElement: annotator.deleteSelectedElement.bind(annotator),
            deleteElement: annotator.deleteElement.bind(annotator),
            deleteGroup: annotator.deleteGroup.bind(annotator),
            setDeletionRules: function(rules) { annotator.options.deletionRules = rules; },
            setRequireSelectionToDrag: annotator.setRequireSelectionToDrag.bind(annotator),
            on: annotator.events.on.bind(annotator.events),
            off: annotator.events.off.bind(annotator.events),
            createAnnotation: annotator.createAnnotation.bind(annotator),
            addKeypoint: annotator.addKeypoint.bind(annotator),
            updateAnnotation: annotator.updateAnnotation.bind(annotator),
            exportAnnotation: annotator.exportAnnotation.bind(annotator),
            exportAllAnnotations: annotator.exportAllAnnotations.bind(annotator),
            exportSelectedAnnotation: annotator.exportSelectedAnnotation.bind(annotator),
            getAnnotationsAsJSON: annotator.getAnnotationsAsJSON.bind(annotator),
            getSelectedAnnotationAsJSON: annotator.getSelectedAnnotationAsJSON.bind(annotator),
            saveState: annotator.saveState.bind(annotator),
            undo: annotator.undo.bind(annotator),
            redo: annotator.redo.bind(annotator),
            clearHistory: annotator.clearHistory.bind(annotator),
            history: annotator.history,
        };
    }

    // Return public API
    return {
        version: VERSION,

        /**
         * Create an annotator attached to an existing SVG element.
         * @param {string} svgId - ID of the SVG element in the document.
         * @param {object} [options] - Configuration.
         * @param {boolean} [options.bindElements=true] - Link keypoints/polygons to their bbox.
         * @param {boolean} [options.bboxContainPolygon=true] - Keep polygons inside bbox.
         * @param {boolean} [options.bboxContainKeypoints=true] - Keep keypoints inside bbox.
         * @param {boolean} [options.requireBbox=false] - Always create a bbox for new annotations.
         * @param {boolean} [options.requireSelectionToDrag=true] - Only drag after selection.
         * @param {boolean} [options.keyboardControls=false] - Listen for keyboard shortcuts.
         * @param {boolean} [options.historyEnabled=true] - Enable undo/redo.
         * @param {boolean} [options.strict=false] - Throw TypeError instead of logging on invalid input.
         * @param {boolean} [options.silent=false] - Suppress all library logging.
         * @param {function} [options.logger] - Custom logger(level, message).
         * @returns {object} Public API instance.
         * @throws {Error} If the SVG element is not found.
         */
        createAnnotator: function(svgId, options = {}) {
            const annotator = new SVGAnnotator(svgId, options);
            return {
                ...buildPublicAPI(annotator),
                getSVGElement: function() { return annotator.svg; },
                destroy: function() { annotator.destroy(); }
            };
        },

        /**
         * Create an annotator that overlays an existing <img>.
         * Wraps the image in a container and inserts an SVG overlay at the same size.
         * @param {string} imageId - ID of the image element.
         * @param {object} [options] - Same options as createAnnotator.
         * @returns {object|null} Public API with extra getImageElement/getContainerElement helpers, or null if the image isn't found.
         */
        createImageAnnotator: function(imageId, options = {}) {
            // Find the image element
            const image = document.getElementById(imageId);
            if (!image) {
                console.error(`Image element with id '${imageId}' not found`);
                return null;
            }

            // Get the parent element where we'll insert the SVG
            const parent = image.parentElement;
            if (!parent) {
                console.error(`Image element with id '${imageId}' doesn't have a parent`);
                return null;
            }

            // Create a container div with relative positioning
            const container = document.createElement('div');
            container.style.position = 'relative';
            container.style.display = 'inline-block';
            container.style.lineHeight = '0'; // Prevent extra space under the image

            // Generate a unique ID for the SVG element
            const svgId = `markin-svg-${imageId}`;

            // Wrap the image with the container
            parent.insertBefore(container, image);
            container.appendChild(image);

            // Create the SVG element with absolute positioning
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('id', svgId);
            svg.style.position = 'absolute';
            svg.style.top = '0';
            svg.style.left = '0';
            svg.style.pointerEvents = 'none'; // Allow clicks to pass through to the image by default
            container.appendChild(svg);

            // Function to update SVG dimensions to match the image
            const updateSVGDimensions = () => {
                // Get the original/natural dimensions of the image
                const naturalWidth = image.naturalWidth;
                const naturalHeight = image.naturalHeight;

                // Remove explicit width/height and use CSS to make SVG fill container
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.style.width = '100%';
                svg.style.height = '100%';

                // Set viewBox to use the natural image dimensions
                svg.setAttribute('viewBox', `0 0 ${naturalWidth} ${naturalHeight}`);

                // Enable pointer events on the SVG so it can receive interactions
                svg.style.pointerEvents = 'auto';
            };

            // Set initial dimensions
            updateSVGDimensions();

            // Update dimensions when the image is loaded
            if (!image.complete) {
                image.addEventListener('load', updateSVGDimensions);
            }

            // Update dimensions when the window is resized
            window.addEventListener('resize', updateSVGDimensions);

            // Create the annotator with the generated SVG
            const annotator = new SVGAnnotator(svgId, options);

            // Store additional references
            annotator.image = image;
            annotator.svgOverlay = svg;
            annotator.updateSVGDimensions = updateSVGDimensions;

            // Enhanced API with image-specific methods
            return {
                ...buildPublicAPI(annotator),
                getImageElement: function() { return image; },
                getSVGElement: function() { return svg; },
                updateDimensions: updateSVGDimensions,
                getContainerElement: function() { return container; },
                destroy: function() {
                    window.removeEventListener('resize', updateSVGDimensions);
                    image.removeEventListener('load', updateSVGDimensions);
                    annotator.destroy();
                    if (container.parentNode) {
                        container.parentNode.insertBefore(image, container);
                        container.parentNode.removeChild(container);
                    }
                }
            };
        }
    };
})();

// Module exports
export default MarkinJS;