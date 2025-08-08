# TASKSTATUS Custom Formula Implementation

## Overview

The TASKSTATUS custom formula displays the status of a task in Univer spreadsheets. Users can click on cells with TASKSTATUS formulas to navigate directly to the task detail page, and can right-click to open in new tabs.

## Usage

```
=TASKSTATUS(1893)
```

Returns: The formatted status of task ID 1893 (e.g., "In Progress", "Not Started", etc.)

## How it Works

The TASKSTATUS function takes a task ID as input and displays the current status of that task:

- `TASKSTATUS(1893)` → "In Progress"
- `TASKSTATUS(2001)` → "Completed" 
- `TASKSTATUS(404)` → "Task Not Found"

## Click Navigation Features

### Left Click Navigation
- **Direct Navigation**: Click on any TASKSTATUS cell to navigate directly to the task detail page
- **Success Feedback**: Shows "Opening task {taskId}" message when navigating
- **Error Handling**: Shows warnings if workspace is missing or navigation fails

### Right Click Features (Hyperlinks)
- **Open in New Tab**: Right-click → "Open link in new tab"
- **Copy Link**: Right-click → "Copy link address" 
- **Split View**: Open in new window or split view
- **All Standard Browser Link Features**: Full browser context menu support

## Implementation Details

### Files Created/Modified

1. **`src/utils/taskstatus-function.ts`** - Contains the task status lookup logic
   - `TaskStatus` class extending `BaseFunction`
   - Function metadata and internationalization
   - Input validation and task status fetching

2. **Modified `src/components/single-workspace/SpreadsheetInstance.vue`**
   - **Manual formula processor** instead of Univer function registration
   - Scans spreadsheet data every 2 seconds for TASKSTATUS formulas
   - Processes formulas by fetching task status from database
   - **Click detection** for cell navigation
   - **Hyperlink creation** for right-click functionality
   - Saves results to database for persistence

### How It Works

- **Background Processing**: Runs every 2 seconds to detect TASKSTATUS formulas
- **Formula Detection**: Uses regex to match `=TASKSTATUS(taskId)` patterns  
- **Task Status Lookup**: Fetches actual task status from database
- **Data Update**: Replaces formula with formatted task status in spreadsheet
- **Click Detection**: Stores task data in cells for navigation
- **Hyperlink Creation**: Adds clickable hyperlinks to processed cells
- **Persistence**: Saves updated data to Supabase database
- **User Feedback**: Shows success notifications when formulas are processed

### Function Features

- **Automatic Detection**: No manual triggering required
- **Fast Processing**: 2-second scan interval for quick response  
- **Click Navigation**: Left-click cells to navigate to task detail page
- **Right-Click Support**: Full browser context menu for hyperlinks
- **User Notifications**: Success/error messages for all operations
- **Data Persistence**: Results and hyperlinks saved to database
- **Error Handling**: Graceful handling of invalid task IDs and permissions
- **Cross-Sheet Support**: Works across all sheets in the spreadsheet
- **Type Safety**: Uses TypeScript for type checking

## Testing Instructions

### Basic Testing
1. **Start the Development Server**:
   ```bash
   npm run dev
   ```

2. **Test TASKSTATUS Formula**:
   - Open any spreadsheet in a workspace
   - Enter `=TASKSTATUS(1893)` in a cell (replace with valid task ID)
   - Wait ~2 seconds for the formula to process
   - Cell should show the task status (e.g., "In Progress")

### Navigation Testing
3. **Test Left-Click Navigation**:
   - Click on the TASKSTATUS cell
   - Should navigate to task detail page: `/single-workspace/{workspaceId}/tasks/{taskId}`
   - Should show "Opening task {taskId}" success message

4. **Test Right-Click Features**:
   - Right-click on the TASKSTATUS cell
   - Should see standard browser context menu with link options:
     - "Open link in new tab" 
     - "Open link in new window"
     - "Copy link address"
   - Try opening in new tab to verify URL works

### Debug Testing
5. **Check Console Logs**:
   - Open browser developer tools
   - Look for logs starting with 🖱️, 🔗, and 🔍
   - Should see cell click detection and navigation attempts

## Expected Behavior

- **Formula Processing**: TASKSTATUS formulas are detected and processed automatically within 2 seconds
- **Status Display**: Cell shows formatted task status (e.g., "In Progress", "Completed", "Task Not Found")
- **Click Navigation**: Left-clicking navigates to task detail page with success message
- **Hyperlink Features**: Right-clicking shows browser context menu with link options
- **Error Handling**: Invalid task IDs show "Task Not Found" but still allow navigation attempts
- **Data Persistence**: All results and hyperlinks are saved to database

## URL Pattern

Navigation follows the standard task detail URL pattern:
```
/single-workspace/{workspaceId}/tasks/{taskId}
```

Example: `/single-workspace/123/tasks/1893`

## Technical Implementation Notes

### Cell Click Detection
The implementation uses Univer's command service to detect various cell selection commands:
- `sheet.operation.set-active-cell`
- `set-active-cell`
- `SetActiveCell`
- `SelectCell`
- `sheet.command.set-selection`
- And more selection-related commands

### Data Storage
Each processed TASKSTATUS cell stores metadata for click detection:
```javascript
cell.taskStatusData = {
  taskId: taskId,
  originalFormula: formula,
  workspaceId: workspaceStore.currentWorkspace?.id
};
```

### Hyperlink Implementation
Uses Univer's `insertHyperlinkInCell` function to add proper HTML hyperlinks:
```javascript
const absoluteUrl = `${window.location.origin}/single-workspace/${workspaceId}/tasks/${taskId}`;
insertHyperlinkInCell(row, col, formattedStatus, absoluteUrl);
```

This provides full browser functionality including:
- Right-click context menu
- Ctrl+click to open in new tab
- Copy link address
- Standard accessibility features