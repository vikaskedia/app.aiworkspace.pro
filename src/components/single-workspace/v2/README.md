# Portfolio Manager - Unified Workbook Storage

## 🎯 Overview

New implementation of the Portfolio Manager that stores all spreadsheets in a portfolio as **sheets within a single workbook JSON object**, creating only **one database row per portfolio**.

## 📊 Key Differences from AI Portfolio Manager

### AI Portfolio Manager (Original)
- Each `SpreadsheetInstance` = Separate workbook
- Each spreadsheet = Separate database row
- Multiple rows per portfolio in `ai_portfolio_data` table

### Portfolio Manager (New Implementation)
- One portfolio = One unified workbook
- All spreadsheets = Sheets within single workbook
- **Single database row per portfolio** with all sheets under `sheets` key

## 🏗️ Architecture

```
Portfolio Tab
├── SpreadsheetInstanceV2 (Unified Workbook Manager)
│   ├── Sheet 1: "Budget Analysis"
│   ├── Sheet 2: "Market Research" 
│   ├── Sheet 3: "Risk Assessment"
│   └── ...more sheets
└── Single JSON object in database:
    {
      "id": "workbook-portfolio-{portfolioId}",
      "sheets": {
        "sheet-{spreadsheet1Id}": { ...sheet1Data },
        "sheet-{spreadsheet2Id}": { ...sheet2Data },
        "sheet-{spreadsheet3Id}": { ...sheet3Data }
      },
      "styles": { ...combinedStyles },
      "sheetOrder": [...],
      "resources": [...]
    }
```

## 🚀 Access URLs

### AI Portfolio Manager (Original):
- `/single-workspace/{workspaceId}/ai_portfolio`
- `/single-workspace/{workspaceId}/ai_portfolio/{portfolioId}`

### Portfolio Manager (New):
- `/single-workspace/{workspaceId}/portfolio`
- `/single-workspace/{workspaceId}/portfolio/{portfolioId}`

## 📁 Component Structure

```
src/components/single-workspace/v2/
├── PortfolioCt.vue                # Main portfolio manager
├── SheetInstance.vue              # Unified workbook component
└── README.md                      # This file
```

## 🔧 Features

### ✅ Implemented
- Portfolio routes and navigation
- Unified workbook data structure
- Portfolio-level save logic
- Clean UI without version badges
- Basic sheet management

### 🚧 To Be Implemented
- Complete portfolio management functions
- Sheet switching within unified workbook
- Migration tools from AI Portfolio Manager
- Advanced sheet operations
- History tracking for unified workbooks

## 💾 Database Schema

The new implementation uses the same `ai_portfolio_data` table but with different data organization:

```sql
-- AI Portfolio Manager: Multiple rows per portfolio
INSERT INTO ai_portfolio_data (spreadsheet_id, portfolio_id, data) VALUES
('sheet_123', 'portfolio_1', { sheets: { "sheet-01": {...} } }),
('sheet_456', 'portfolio_1', { sheets: { "sheet-01": {...} } }),
('sheet_789', 'portfolio_1', { sheets: { "sheet-01": {...} } });

-- Portfolio Manager: Single row per portfolio
INSERT INTO ai_portfolio_data (spreadsheet_id, portfolio_id, data) VALUES
('portfolio_1', 'portfolio_1', { 
  sheets: { 
    "sheet-sheet_123": {...},
    "sheet-sheet_456": {...}, 
    "sheet-sheet_789": {...}
  }
});
```

## 🧪 Testing

To test the new implementation:

1. Navigate to `/single-workspace/{workspaceId}/portfolio`
2. Create a new portfolio
3. Add multiple spreadsheets to the portfolio
4. Save and verify only one row is created in database
5. Check that all sheets are stored under the `sheets` key

## 🔄 Migration Strategy

When ready to migrate from AI Portfolio Manager:

1. **Data Migration Script**: Convert multiple records into single records
2. **Gradual Rollout**: Keep both implementations accessible during transition
3. **User Choice**: Allow users to choose which implementation to use
4. **Backup**: Ensure original data is preserved during migration

## 📝 Notes

- This is a parallel implementation, not a replacement
- Both implementations can coexist
- Uses the same Univer.js libraries and features
- Database table structure remains the same
- Only the data organization within JSON changes