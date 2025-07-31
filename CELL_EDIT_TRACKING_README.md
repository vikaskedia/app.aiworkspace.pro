# Cell Edit Tracking Feature

## Overview
The spreadsheet component now tracks who edited each cell and when, providing a complete audit trail for collaborative work.

## Features

### 🔍 Edit History Tracking
- **Who**: Tracks the user ID and display name of the editor
- **When**: Records the exact timestamp of each edit
- **What**: Stores the command that caused the change
- **History**: Maintains the last 10 edits per cell to prevent data bloat

### 📝 Cell Data Structure
Each cell now includes additional metadata:

```javascript
{
  v: "Cell Value",                    // Original cell value
  lastEditedBy: "user-id-123",        // User ID of last editor
  lastEditedByName: "John Doe",       // Display name of last editor
  lastEditedAt: "2024-01-15T10:30:00Z", // ISO timestamp
  editHistory: [                      // Array of recent edits
    {
      userId: "user-id-123",
      userName: "John Doe",
      timestamp: "2024-01-15T10:30:00Z",
      commandId: "set-range-value"
    }
    // ... up to 10 recent edits
  ]
}
```

### 🎯 How to Use

#### 1. Automatic Tracking
- Edit tracking happens automatically when cells are modified
- No configuration required - works out of the box
- User information is fetched from Supabase authentication

#### 2. View Edit History
- **Keyboard Shortcut**: Press `Ctrl+I` while the spreadsheet container has focus
- **Cell Info Panel**: Shows who last edited and recent edit history
- **Timestamp Formatting**: Smart relative time display (e.g., "2 minutes ago", "3 hours ago")

#### 3. Features in Action
```javascript
// When a user edits cell A1:
// 1. Current user is captured from Supabase auth
// 2. Edit metadata is added to cell data
// 3. Change is tracked with timestamp
// 4. Data is saved to database with edit history

// Press Ctrl+I to see:
// 📝 Edit History
// Last edited by: John Doe
// When: 2 minutes ago
// Recent edits:
//   Jane Smith - 1 hour ago
//   Bob Johnson - 3 hours ago
```

## Implementation Details

### 🔧 Technical Components

1. **User Management**
   - `getCurrentUser()`: Fetches current user from Supabase auth
   - `getUserDisplayName()`: Caches user display names for performance
   - User info is loaded when component initializes

2. **Change Detection**
   - Hooks into Univer's command system
   - Listens for `set-range-value` and `SetRangeValues` commands
   - Captures affected cell ranges and edit metadata

3. **Data Storage**
   - Edit metadata is stored in the same cell data structure
   - Persisted to Supabase with the rest of the spreadsheet data
   - Historical edits are kept in the database

4. **UI Components**
   - `selectedCellInfo`: Reactive data for edit info panel
   - `cell-edit-info-panel`: Styled popup showing edit history
   - Keyboard event handlers for user interaction

### 🎨 User Experience

- **Unobtrusive**: Doesn't interfere with normal spreadsheet usage
- **On-Demand**: Edit history only shows when requested (Ctrl+I)
- **Informative**: Clear display of who edited what and when
- **Responsive**: Works across different screen sizes

### ⚡ Performance Considerations

- **Efficient Storage**: Only stores essential edit metadata
- **Limited History**: Maximum 10 edits per cell to prevent bloat
- **Cached User Names**: User display names are cached to reduce API calls
- **Async Operations**: User lookups don't block spreadsheet operations

## Usage Examples

### Example 1: Basic Edit Tracking
```javascript
// User "alice@company.com" edits cell B2
// Cell data becomes:
{
  v: "Updated Value",
  lastEditedBy: "alice-user-id",
  lastEditedByName: "Alice Johnson", 
  lastEditedAt: "2024-01-15T14:22:00Z",
  editHistory: [
    {
      userId: "alice-user-id",
      userName: "Alice Johnson",
      timestamp: "2024-01-15T14:22:00Z",
      commandId: "set-range-value"
    }
  ]
}
```

### Example 2: Multiple Edits
```javascript
// After several users edit the same cell:
{
  v: "Final Value",
  lastEditedBy: "charlie-user-id",
  lastEditedByName: "Charlie Brown",
  lastEditedAt: "2024-01-15T16:45:00Z",
  editHistory: [
    {
      userId: "charlie-user-id", 
      userName: "Charlie Brown",
      timestamp: "2024-01-15T16:45:00Z",
      commandId: "set-range-value"
    },
    {
      userId: "bob-user-id",
      userName: "Bob Wilson", 
      timestamp: "2024-01-15T15:30:00Z",
      commandId: "set-range-value"
    },
    {
      userId: "alice-user-id",
      userName: "Alice Johnson",
      timestamp: "2024-01-15T14:22:00Z", 
      commandId: "set-range-value"
    }
  ]
}
```

## Future Enhancements

### Possible Improvements
- **Right-click context menu**: Alternative to keyboard shortcut
- **Cell highlighting**: Visual indicator for recently edited cells
- **Detailed change log**: Show what the previous value was
- **Export functionality**: Export edit history to CSV/Excel
- **User avatars**: Show profile pictures in edit history
- **Real-time collaboration**: Live cursor tracking with user names

### Configuration Options
- **History length**: Configurable number of edits to keep
- **Auto-show**: Option to automatically show edit info on cell selection
- **Permissions**: Control who can see edit history
- **Notifications**: Alert when specific cells are edited

## Security & Privacy

- **User Authentication**: Relies on Supabase authentication
- **Permission-based**: Only shows edit history to authorized users
- **Data Integrity**: Edit metadata is stored securely with spreadsheet data
- **No Sensitive Data**: Only stores user IDs, names, and timestamps

---

This feature provides transparency and accountability in collaborative spreadsheet editing, making it easy to track changes and understand the evolution of your data. 