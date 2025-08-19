# Changelog

All notable changes to MarkinJS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- TypeScript definitions (planned)
- React/Vue component wrappers (planned)
- Automated testing suite (planned)
- Performance optimizations (planned)

## [0.0.1] - 2025-01-19

### Added
- Initial release of MarkinJS
- Core annotation functionality
  - Bounding box annotations with resize handles
  - Polygon annotations with draggable vertices
  - Keypoint annotations with precise positioning
  - Hierarchical grouping of annotation elements
- Image overlay system
  - `MarkinJS.createImageAnnotator()` for automatic SVG overlay creation
  - `MarkinJS.createAnnotator()` for existing SVG elements
- Interactive features
  - Drag and drop for all annotation types
  - Selection system with visual feedback
  - Keyboard controls for precise movement (1px, 10px, 0.2px)
  - Delete key support for removing selected elements
- Advanced annotation features
  - Element binding (child elements move with parents)
  - Containment rules (keep elements within boundaries)
  - Customizable deletion rules (cascade deletion behavior)
  - UUID-based element identification
- Comprehensive event system
  - Selection events (`select`, `deselect`, `deselection`)
  - Interaction events (`dragstart`, `drag`, `dragend`, `elementmoved`)
  - Lifecycle events (`annotationcreated`, `delete`, `deletegroup`)
  - State change events (`enabled`, `disabled`, `zoomchange`)
- Configuration options
  - Zoom level support
  - Keyboard controls toggle
  - Element binding configuration
  - Containment rule settings
  - Custom deletion rule definitions
- Zero-dependency architecture
  - Pure JavaScript implementation
  - No external libraries required
  - Modern browser compatibility

### Technical Details
- **File Size**: ~25KB uncompressed
- **Browser Support**: Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- **Dependencies**: None
- **License**: MIT

### Known Issues
- API is unstable and subject to breaking changes
- No automated tests yet
- Documentation may be incomplete
- No TypeScript definitions

### Breaking Changes
- This is the initial release, so no breaking changes yet
- Future versions before 1.0.0 may include breaking changes

---

## Release Notes

### Version 0.0.1 Notes

This is the initial public release of MarkinJS. The library is functional but should be considered **unstable**. We recommend using it for:

- Prototyping and experimentation
- Non-production annotation tools  
- Research projects
- Personal projects

**Not recommended for:**
- Production applications
- Critical data annotation workflows
- Large-scale deployments

### Migration Guide

Since this is the first release, there are no migrations required.

### Roadmap to 1.0.0

Before reaching stable 1.0.0, we plan to:

1. **API Stabilization** - Lock down the public API
2. **Comprehensive Testing** - Unit tests, integration tests, browser testing
3. **Documentation** - Complete API docs, tutorials, examples
4. **Performance** - Optimize for large datasets and complex annotations
5. **TypeScript** - Add full TypeScript definitions
6. **Framework Integration** - React, Vue, Angular components

### Contributing

MarkinJS is currently in active development. We welcome:

- Bug reports and issues
- Feature requests  
- Documentation improvements
- Code contributions (after discussing in issues)

Contact: markinjs@datamarkin.com

---

## Semantic Versioning

MarkinJS follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions  
- **PATCH** version for backwards-compatible bug fixes

Since we're in 0.x.x territory, **minor versions may include breaking changes** until we reach 1.0.0.