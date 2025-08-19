# MarkinJS Examples

This directory contains various examples showcasing MarkinJS's capabilities for different use cases.

## Available Examples

### 📖 [Interactive Demo](./index.html)
Complete interactive demo showcasing all MarkinJS features:
- All annotation types (bounding boxes, polygons, keypoints)
- Real-time event logging and coordinate tracking
- API demonstrations and code examples
- Interactive controls and configuration options

**Perfect for**: Getting started, exploring all features, API reference

### 📚 [API Documentation](./api.html)
Comprehensive API reference with examples:
- Method documentation
- Event system details
- Configuration options
- Integration examples

**Perfect for**: Development reference, API exploration

## Quick Start

1. **Choose an example** based on your use case
2. **Open the HTML file** in your browser
3. **Start annotating** - click, drag, and interact with the tools
4. **Export your data** using the built-in export functions

## File Structure

```
examples/
├── index.html           # Interactive demo with all features
├── api.html             # API documentation and examples
├── assets/              # Shared resources
│   ├── css/            # Stylesheets
│   ├── images/         # Sample images
│   └── js/             # Third-party libraries
└── README.md           # This file
```

## Running Examples Locally

### Option 1: Direct File Opening
Simply open any `.html` file in your web browser.

### Option 2: Local Server (Recommended)
For better performance and to avoid CORS issues:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then visit `http://localhost:8000/examples/`

## Customizing Examples

All examples are self-contained and can be easily customized:

1. **Modify the HTML** to change layout and controls
2. **Update the JavaScript** to add new features or change behavior  
3. **Adjust the CSS** for different styling
4. **Change the image** by replacing files in `assets/images/`

## Use Case Guides

### For Computer Vision Research
- Start with [Interactive Demo](./index.html)
- Modify classes to match your dataset categories
- Adapt export format for your ML framework

### For Medical Imaging
- Use [Interactive Demo](./index.html) as foundation
- Add medical-specific annotation types (measurements, regions)
- Implement DICOM coordinate handling

### For UI/UX Prototyping
- Begin with [Interactive Demo](./index.html)
- Customize interface for your workflow
- Add project-specific export formats

## Integration Examples

### React Component
```jsx
import { useEffect, useRef } from 'react';

function AnnotationComponent({ imageUrl, onAnnotationChange }) {
  const imageRef = useRef();
  const annotatorRef = useRef();

  useEffect(() => {
    if (window.MarkinJS && imageRef.current) {
      annotatorRef.current = MarkinJS.createImageAnnotator(imageRef.current.id, {
        keyboardControls: true
      });
      
      annotatorRef.current.on('annotationcreated', onAnnotationChange);
    }
  }, []);

  return <img ref={imageRef} id="annotation-target" src={imageUrl} />;
}
```

### Vue Component
```vue
<template>
  <img ref="imageEl" :src="imageUrl" @load="initAnnotator" />
</template>

<script>
export default {
  props: ['imageUrl'],
  methods: {
    initAnnotator() {
      this.annotator = MarkinJS.createImageAnnotator(this.$refs.imageEl.id, {
        keyboardControls: true
      });
    }
  }
}
</script>
```

## Contributing Examples

Have a great use case or example to share? We'd love to include it!

1. **Create your example** following the existing structure
2. **Add documentation** explaining the use case
3. **Submit a pull request** with your addition

## Getting Help

- 📧 **Questions**: markinjs@datamarkin.com
- 🐛 **Issues**: [GitHub Issues](https://github.com/datamarkin/markinjs/issues)
- 📖 **Documentation**: [Main Docs](../docs/)

## License

All examples are released under the MIT License, same as MarkinJS.