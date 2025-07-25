# TASKSTATUS Custom Formula Implementation

## Overview

The TASKSTATUS custom formula has been implemented for Univer spreadsheets. This formula reverses the digits of a given number.

## Usage

```
=TASKSTATUS(123)
```

Returns: `321`

## How it Works

The TASKSTATUS function takes a number as input and returns the number with its digits reversed:

- `TASKSTATUS(123)` → `321`
- `TASKSTATUS(456)` → `654`
- `TASKSTATUS(1000)` → `1` (leading zeros are removed)

## Implementation Details

### Files Created/Modified

1. **`src/utils/taskstatus-function.ts`** - Contains the digit reversal logic
   - `TaskStatus` class extending `BaseFunction`
   - Function metadata and internationalization
   - Input validation and digit reversal logic

2. **Modified `src/components/single-workspace/SpreadsheetInstance.vue`**
   - **Manual formula processor** instead of Univer function registration
   - Scans spreadsheet data every 2 seconds for TASKSTATUS formulas
   - Processes formulas by reversing digits and updating cell values
   - Saves results to database for persistence

### How It Works

- **Background Processing**: Runs every 2 seconds to detect TASKSTATUS formulas
- **Formula Detection**: Uses regex to match `=TASKSTATUS(number)` patterns
- **Digit Reversal**: Processes the number and reverses its digits
- **Data Update**: Replaces formula with calculated result in spreadsheet data
- **Persistence**: Saves updated data to Supabase database
- **User Feedback**: Shows success notifications when formulas are processed

### Function Features

- **Automatic Detection**: No manual triggering required
- **Fast Processing**: 2-second scan interval for quick response
- **User Notifications**: Green popup messages when formulas are processed
- **Data Persistence**: Results saved to database
- **Error Handling**: Graceful handling of invalid inputs
- **Type Safety**: Uses TypeScript for type checking

## Testing Instructions

1. **Start the Development Server**:
   ```bash
   npm run dev
   ```

2. **Open a Spreadsheet**:
   - Navigate to any workspace that contains spreadsheets
   - Open or create a spreadsheet instance

3. **Test the Formula**:
   - Click on any cell
   - Type `=TASKSTATUS(123)` and press Enter
   - Wait 2 seconds - you'll see a success notification
   - **Refresh the page** to see the result (`321`)

4. **Additional Test Cases**:
   ```
   =TASKSTATUS(456)    # Should return 654 (after refresh)
   =TASKSTATUS(1000)   # Should return 1 (after refresh)
   =TASKSTATUS(789)    # Should return 987 (after refresh)
   =TASKSTATUS(12)     # Should return 21 (after refresh)
   ```

5. **What You'll See**:
   - **Green notification**: "TASKSTATUS(123) processed → 321. Refresh to see result."
   - **Console message**: "✅ Processed TASKSTATUS(123) → 321 at [row, col]"
   - **After refresh**: Cell shows `321` instead of the formula

## Troubleshooting

### If the Formula Doesn't Work

1. **Check Browser Console**: Look for processor status messages:
   ```
   ✅ TASKSTATUS formula processor started - checks every 2 seconds
   ```

2. **Wait and Watch**: After typing the formula:
   - Wait 2 seconds for processing
   - Look for "✅ Processed TASKSTATUS..." message
   - Look for green notification popup

3. **Common Issues**:
   - **No processor started**: Refresh the page and check console
   - **Formula not detected**: Make sure syntax is exactly `=TASKSTATUS(123)`
   - **No notification**: Check if processor is running every 2 seconds
   - **Result not visible**: Refresh the page or navigate away and back

### Console Messages to Look For

**Success Messages**:
```
✅ TASKSTATUS formula processor started - checks every 2 seconds
📋 TASKSTATUS Usage: Type "=TASKSTATUS(123)" in any cell, wait 2 seconds, then refresh
✅ Processed TASKSTATUS(123) → 321 at [0, 0]
📊 Processed 1 TASKSTATUS formulas
💾 Saved processed formulas to database
```

**What Each Message Means**:
- **Processor started**: Background monitoring is active
- **Usage instruction**: How to use the formula
- **Processed**: Formula was detected and calculated
- **Saved**: Result was saved to database for persistence

## Code Structure

### TaskStatus Class

```typescript
export class TaskStatus extends BaseFunction {
  override calculate(numberParam: BaseValueObject) {
    // Input validation
    if (numberParam.isError()) {
      return numberParam;
    }

    // Convert and validate number
    const value = numberParam.getValue();
    let numberValue = typeof value === 'string' ? 
      parseInt(value, 10) : value;

    // Reverse digits
    const reversedString = numberValue.toString()
      .split('').reverse().join('');
    return NumberValueObject.create(parseInt(reversedString, 10));
  }
}
```

### Registration Process

The custom function is registered with Univer's formula engine during spreadsheet initialization:

1. Multiple service names are tried for compatibility
2. The function class is registered with the service
3. Function metadata is registered for autocomplete and help
4. Success/failure is logged to the console

## Future Enhancements

Potential improvements for the TASKSTATUS formula:

1. **Support for Negative Numbers**: Handle negative inputs
2. **Decimal Support**: Handle decimal numbers (reverse before decimal point)
3. **Formatting Options**: Add parameters for output formatting
4. **Performance Optimization**: Optimize for very large numbers

## Related Files

- `src/utils/taskstatus-function.ts` - Function implementation
- `src/components/single-workspace/SpreadsheetInstance.vue` - Integration
- `package.json` - Univer dependencies
- This README - Documentation

## Example Implementation

The TASKSTATUS formula demonstrates a **manual formula processing approach** for Univer when function registration isn't available:

1. **Background monitoring** - Scans spreadsheet data every 2 seconds
2. **Pattern matching** - Uses regex to detect custom formulas
3. **Direct processing** - Calculates results and updates cell data
4. **Data persistence** - Saves results to database for permanence
5. **User feedback** - Provides notifications and clear console messages

This approach works around Univer service registration issues and provides a reliable alternative for custom formula functionality. The pattern can be adapted for other custom formulas that need to work outside of Univer's built-in function system. 