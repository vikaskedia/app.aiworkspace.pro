# Excalidraw Integration with Vue 3

This project now includes Excalidraw integration using Veaury for React-Vue component interoperability.

## Setup

### Dependencies Installed

```bash
npm install @excalidraw/excalidraw veaury
```

### Components Created

1. **ExcalidrawWrapper.vue** - A Vue wrapper component that integrates Excalidraw using Veaury
2. **ExcalidrawPage.vue** - A standalone page component for Excalidraw with its own URL
3. **Modified CanvasCt.vue** - Simplified to only include the custom canvas functionality

## Features

### ExcalidrawWrapper.vue
- Full Excalidraw functionality with hand-drawn style diagrams
- Export/Import functionality for drawings
- Clear canvas functionality
- Automatic saving to Supabase database
- Integration with workspace system

### Separate Excalidraw Page
- Dedicated URL: `/single-workspace/{workspaceId}/excalidraw`
- Full-screen Excalidraw experience
- Navigation link in the workspace menu
- Preserved existing custom canvas functionality

## Usage

1. Navigate to any workspace
2. Click on the workspace dropdown menu
3. Select "Excalidraw" from the navigation menu
4. Or directly visit: `/single-workspace/{workspaceId}/excalidraw`
5. In Excalidraw, you can:
   - Draw freehand with hand-drawn style
   - Add shapes, text, and arrows
   - Export drawings as JSON
   - Import existing drawings
   - Clear the canvas
   - Use the "Back to Workspace" button to return

## Technical Details

### Veaury Integration
- Uses `applyReactInVue` function from Veaury
- Wraps the React-based Excalidraw component
- Handles props passing and event handling
- Import syntax: `import { applyReactInVue } from 'veaury'`

### Data Persistence
- Excalidraw data is stored in the existing `canvas_data` table
- Uses the `excalidraw` field in the JSON structure
- Maintains compatibility with existing canvas data

### Styling
- Responsive design that fits the existing UI
- Proper height management for the Excalidraw component
- Consistent with Element Plus design system

## File Structure

```
src/components/single-workspace/
├── CanvasCt.vue (modified - simplified)
├── ExcalidrawWrapper.vue (new - wrapper component)
└── ExcalidrawPage.vue (new - standalone page)
```

## Troubleshooting

### Common Issues

1. **Excalidraw not loading**: Check browser console for errors, ensure all dependencies are installed
2. **Styling issues**: Verify CSS classes are properly applied
3. **Data not saving**: Check Supabase connection and authentication

### Development

To run the development server:
```bash
npm run dev
```

## Future Enhancements

- Collaborative drawing features
- Real-time synchronization
- Custom Excalidraw themes
- Integration with task attachments
- Advanced export options (PNG, SVG)

## References

- [Excalidraw GitHub](https://github.com/excalidraw/excalidraw)
- [Veaury Documentation](https://github.com/devilwjp/veaury)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html) 