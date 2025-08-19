# MarkinJS

A lightweight, zero-dependency SVG annotation library for computer vision and image labeling projects.

![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![No Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)

---

## Overview

MarkinJS enables developers to create precise, pixel-perfect annotations on images for computer vision applications. Built for simplicity and performance, it provides a complete toolkit for bounding boxes, polygons, and keypoint annotations with advanced features like element binding, containment rules, and hierarchical relationships.

**Perfect for:**
- Computer vision datasets
- Image labeling workflows  
- Data annotation platforms
- ML training data preparation
- Research and prototyping

## Demo

🚀 **[Live Demo](./examples/index.html)** - See MarkinJS in action with interactive examples

📚 **[More Examples](./examples/)** - Object detection, medical imaging, and advanced use cases

## Quick Start

### Installation

No build process required. Simply include the script:

```html
<script src="markin.js"></script>
```

### Basic Usage

```javascript
// Create annotator on an existing image
const annotator = MarkinJS.createImageAnnotator('your-image-id', {
    zoom: 1.0,
    keyboardControls: true
});

// Add a bounding box
annotator.createAnnotation({
    class: "person",
    bbox: [100, 100, 300, 250]
});

// Listen for events
annotator.on('select', (data) => {
    console.log('Selected:', data.element);
});
```

## Core Features

### 📦 Annotation Types
- **Bounding Boxes** - Rectangular regions with resize handles
- **Polygons** - Precise outlines with draggable vertices
- **Keypoints** - Point markers for specific features
- **Groups** - Hierarchical element relationships

### 🎯 Advanced Capabilities
- **Element Binding** - Child elements move with parents
- **Containment Rules** - Keep elements within boundaries  
- **Custom Deletion Rules** - Configure cascade deletion behavior
- **Keyboard Controls** - Precise movement (1px, 10px, 0.2px)
- **Event System** - Rich interaction events for custom UI
- **Zoom Support** - Works at any zoom level

### ⚡ Technical Highlights
- Zero dependencies
- Modern browser support
- Pixel-perfect precision
- Memory efficient
- Framework agnostic

## API Reference

### Initialization

#### `MarkinJS.createImageAnnotator(imageId, options)`

Creates an SVG overlay on an existing image element.

```javascript
const annotator = MarkinJS.createImageAnnotator('my-image', {
    zoom: 1.0,
    keyboardControls: true,
    bindElements: true
});
```

#### `MarkinJS.createAnnotator(svgId, options)`

Uses an existing SVG element for annotations.

### Core Methods

| Method | Description |
|--------|-------------|
| `createAnnotation(options)` | Create new annotation |
| `getSelectedElement()` | Get currently selected element |
| `deleteSelectedElement()` | Delete selected element |
| `enable()` / `disable()` | Toggle annotator state |
| `setZoom(level)` | Set zoom level |
| `on(event, callback)` | Add event listener |
| `off(event, callback)` | Remove event listener |

### Annotation Options

```javascript
annotator.createAnnotation({
    uuid: "unique-id",           // Optional: auto-generated if not provided
    class: "person",             // Classification label
    bbox: [x1, y1, x2, y2],     // Bounding box coordinates
    segmentation: [x1,y1,x2,y2...], // Polygon points (flat array)
    keypoints: [                 // Named keypoints
        { name: "head", point: [x, y] },
        { name: "center", point: [x, y] }
    ],
    bindElements: true,          // Bind child elements to parent
    containRules: ["keypoint"],  // Elements to keep inside bbox
    deletionRules: {             // Custom deletion behavior
        "bbox": ["keypoint", "polygon"],
        "polygon": ["bbox"]
    }
});
```

### Events

| Event | Description | Data |
|-------|-------------|------|
| `select` | Element selected | `{element, type, data}` |
| `deselect` | Element deselected | `{element, type}` |
| `annotationcreated` | New annotation created | `{uuid, class, group, elements}` |
| `delete` | Element deleted | `{role, groupId}` |
| `elementmoved` | Element moved | `{element, type, deltaX, deltaY}` |
| `dragstart`, `drag`, `dragend` | Drag operations | `{element, position}` |

## Examples

### Computer Vision Dataset

```javascript
// Initialize on dataset image
const annotator = MarkinJS.createImageAnnotator('dataset-image');

// Add person detection
annotator.createAnnotation({
    class: "person",
    bbox: [150, 100, 300, 400],
    keypoints: [
        { name: "head", point: [225, 120] },
        { name: "torso", point: [225, 250] }
    ],
    bindElements: true,
    containRules: ["keypoint"]
});

// Export annotations
annotator.on('annotationcreated', (data) => {
    saveToDataset({
        id: data.uuid,
        class: data.class,
        bbox: getBBoxCoordinates(data.group),
        keypoints: getKeypointCoordinates(data.group)
    });
});
```

### Medical Imaging

```javascript
const annotator = MarkinJS.createImageAnnotator('medical-scan', {
    keyboardControls: true,
    deletionRules: {
        "bbox": ["keypoint"],  // Remove markers with regions
        "keypoint": []         // Keep regions when removing markers
    }
});

// Add anatomical region
annotator.createAnnotation({
    class: "lesion", 
    bbox: [200, 150, 280, 220],
    keypoints: [
        { name: "center", point: [240, 185] },
        { name: "edge", point: [270, 200] }
    ]
});
```

### Interactive Labeling Tool

```javascript
const annotator = MarkinJS.createImageAnnotator('labeling-canvas');

// Real-time coordinate display
annotator.on('elementmoved', (data) => {
    document.getElementById('coordinates').textContent = 
        `Position: (${Math.round(data.position.x)}, ${Math.round(data.position.y)})`;
});

// Selection info panel
annotator.on('select', (data) => {
    document.getElementById('selection-info').innerHTML = `
        <h3>Selected: ${data.type}</h3>
        <p>Class: ${data.data.class || 'None'}</p>
        <p>UUID: ${data.data.uuid || 'None'}</p>
    `;
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `zoom` | Number | 1.0 | Current zoom level |
| `keyboardControls` | Boolean | true | Enable arrow key movement |
| `bindElements` | Boolean | true | Bind child to parent elements |
| `requireBbox` | Boolean | false | Require bbox for all annotations |
| `bboxContainPolygon` | Boolean | true | Keep polygons inside bbox |
| `bboxContainKeypoints` | Boolean | true | Keep keypoints inside bbox |
| `deletionRules` | Object | See docs | Default deletion behavior |

## Browser Support

- All modern browsers

## Roadmap

- **v1.0.0**: Stable API, comprehensive testing
- **Future**: TypeScript definitions, React/Vue components, performance optimizations

## Contributing

MarkinJS is currently in active development. We welcome feedback and bug reports!

## Support

- 📧 **Contact**: markinjs@datamarkin.com
- 🌐 **Website**: https://datamarkin.com  
- 📝 **Issues**: Use GitHub issues for bug reports

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Maintained by [Datamarkin](https://datamarkin.com)**

> ⚠️ **Note**: Version 0.0.1 is unstable. Breaking changes expected before v1.0.0.