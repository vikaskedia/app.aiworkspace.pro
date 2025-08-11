# Task Attachments Folder Feature

## Overview
Files uploaded through the TipTap editor when working with tasks (both comments and descriptions) are now automatically organized into a `task-attachments` folder within the workspace repository, instead of being uploaded to the root folder.

## Changes Made

### 1. TiptapEditor.vue
- Added `ensureTaskAttachmentsFolder()` method to check if the `task-attachments` folder exists and create it if needed
- Added `isTaskRelated` prop to handle task descriptions (in addition to existing `isTaskComment` prop)
- Modified `handleFileSelected()` to upload files to `task-attachments/` when either `isTaskComment` or `isTaskRelated` prop is true
- Updated FileInsertDialog component usage to pass `isTaskContext` prop

### 2. FileInsertDialog.vue
- Added `isTaskContext` prop to differentiate between task and non-task file uploads
- Added `ensureTaskAttachmentsFolder()` method (same logic as TiptapEditor)
- Modified upload logic to use `task-attachments/` folder when in task context
- Updated dialog title to indicate where files will be uploaded
- Enhanced file browser to automatically navigate to `task-attachments` folder when in task context

### 3. Task Components Updated
- **DetailedTaskViewCt.vue**: Added `isTaskRelated="true"` to task description editors and create new task dialog
- **QuickTaskViewCt.vue**: Added `isTaskRelated="true"` to task description editors
- **TasksCt.vue**: Added `isTaskRelated="true"` to new task creation form

## How It Works

1. **Folder Creation**: When uploading a file in task context:
   - System checks if `task-attachments` folder exists in the workspace
   - If it doesn't exist, creates the folder with a `.gitkeep` file
   - If creation fails, falls back to root folder upload

2. **File Upload Path**: 
   - Task context uploads (comments + descriptions): `task-attachments/{uniqueFileName}`
   - Non-task uploads: `{uniqueFileName}` (root folder)

3. **User Experience**:
   - Dialog title shows where files will be uploaded
   - File browser automatically navigates to task-attachments folder in task context
   - Success messages indicate the upload location

## File Naming
Files are uploaded with unique timestamps to prevent naming conflicts:
- Original: `document.pdf`
- Uploaded as: `document_1704067200000.pdf`

## Backward Compatibility
- Existing files in the root folder are not affected
- Non-task file uploads continue to go to the root folder
- The feature gracefully falls back to root folder if folder creation fails

## Usage
This feature is automatically active when:
- Using the TipTap editor in task comments (when `isTaskComment` prop is true)
- Using the TipTap editor in task descriptions (when `isTaskRelated` prop is true)
- Using the file upload button in the TipTap toolbar during any task-related editing
- Using the FileInsertDialog component with `isTaskContext` prop set to true

No additional configuration is required.
