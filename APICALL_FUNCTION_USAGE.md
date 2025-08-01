# APICALL Function Usage Guide

## Overview

The `APICALL` function allows you to make HTTP GET requests to APIs and extract specific values from JSON responses directly within Univer Sheets cells.

## Syntax

```
=APICALL(url, key)
```

- **url**: The API endpoint URL (must return JSON)
- **key**: The JSON key/property to extract from the response

## Examples

### 1. Get Your IP Address
```
=APICALL("https://api.ipify.org/?format=json", "ip")
```
This will fetch your public IP address from the ipify API.

### 2. Get Random Joke
```
=APICALL("https://official-joke-api.appspot.com/random_joke", "setup")
=APICALL("https://official-joke-api.appspot.com/random_joke", "punchline")
```

### 3. Get Weather Data (example with nested keys)
```
=APICALL("https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current_weather=true", "current_weather.temperature")
```

### 4. Get Random User Data
```
=APICALL("https://randomuser.me/api/", "results.0.name.first")
=APICALL("https://randomuser.me/api/", "results.0.email")
```

## Features

- **Async Processing**: The function works asynchronously and updates the cell when the API response is received
- **Dot Notation Support**: Use dot notation to access nested JSON properties (e.g., "user.profile.name")
- **Error Handling**: Shows descriptive error messages for failed requests or missing keys
- **Type Preservation**: Returns numbers as numbers and everything else as strings

## Testing Instructions

1. **Open your application** and navigate to a workspace with a spreadsheet
2. **Wait for initialization** - Check the browser console for: "✅ APICALL formula processor started"
3. **Click on any cell** in the spreadsheet
4. **Type one of the example formulas** above (e.g., `=APICALL("https://api.ipify.org/?format=json", "ip")`)
5. **Press Enter** and wait 2 seconds for the processor to detect and process the formula
6. **You'll see a green notification** when the API call completes
7. **Refresh the page** to see the actual result value in the cell

## Current Status

✅ **Build Status**: Successfully implemented and builds without errors
✅ **Manual Processor**: Implemented as background processor (same approach as TASKSTATUS)
🔧 **Processing**: Scans for formulas every 2 seconds and processes them automatically
📝 **Logging**: Check browser console for detailed processing status and API call logs
🐛 **Console Error**: Fixed - No more Univer formula registration errors

## Implementation Details

The APICALL function is now implemented as a **manual formula processor** (same approach as TASKSTATUS), which avoids all Univer formula engine registration issues:

### How It Works:
1. **Background Scanning**: Runs every 2 seconds to detect APICALL formulas in spreadsheet data
2. **Pattern Matching**: Uses regex to match `=APICALL("url", "key")` patterns
3. **API Calls**: Makes HTTP GET requests to the specified URLs
4. **Value Extraction**: Extracts values from JSON responses using dot notation
5. **Cell Updates**: Replaces formulas with actual values in spreadsheet data
6. **Data Persistence**: Saves results to database automatically

### Files Modified:
- **`src/components/single-workspace/SpreadsheetInstance.vue`** - Added APICALL processor alongside TASKSTATUS processor

### Key Features:
- **No Registration Needed**: Bypasses Univer's formula engine entirely
- **Background Processing**: Automatic detection and processing every 2 seconds
- **User Notifications**: Green success messages when formulas are processed
- **Error Handling**: Graceful handling of network errors and invalid URLs
- **Dot Notation Support**: Extract nested JSON values like `"user.profile.name"`
- **Database Persistence**: Results are saved and persist across page refreshes

## Expected Behavior

- **Type the formula**: `=APICALL("https://api.ipify.org/?format=json", "ip")`
- **Wait 2 seconds**: The processor detects and processes the formula
- **Green notification appears**: "APICALL: Got ip = 123.456.789.0"
- **Console message**: "✅ Processed APICALL(...) → "123.456.789.0" at [row, col]"
- **Refresh the page**: Cell now shows `123.456.789.0` instead of the formula
- **If there's an error**: Cell will show "Error: HTTP 404" or "Key 'xyz' not found"

## Troubleshooting

### Common Issues

1. **CORS Errors**: Some APIs may not allow cross-origin requests from web browsers
   - Solution: Use APIs that support CORS or have public access

2. **Invalid URL**: Make sure the URL is correctly formatted
   - Example: Include `https://` at the beginning

3. **Key Not Found**: Verify the JSON structure and key name
   - Use browser developer tools to inspect the API response

4. **Network Issues**: Check your internet connection

### Debugging Tips

1. **Check Browser Console**: Look for detailed error messages in the browser's developer console
2. **Test API Directly**: Try the API URL in your browser to see the JSON structure
3. **Use Simple Examples**: Start with the IP address example to verify the function works

## Technical Details

- Uses the browser's `fetch()` API
- Supports only GET requests
- Automatically adds JSON accept headers
- CORS mode enabled for cross-origin requests
- Maximum response processing time depends on the API

## Security Notes

- Only use trusted APIs
- Be aware that API calls are made from the client browser
- API keys should not be embedded in formulas (use server-side proxies for authenticated APIs)
- Consider rate limiting when making multiple API calls

## Examples of APIs That Work Well

1. **ipify** - Get IP address: `https://api.ipify.org/?format=json`
2. **JSONPlaceholder** - Test data: `https://jsonplaceholder.typicode.com/posts/1`
3. **Open-Meteo** - Weather data: `https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true`
4. **Random User API** - Random user data: `https://randomuser.me/api/`
5. **Cat Facts** - Random facts: `https://catfact.ninja/fact`

Enjoy using the APICALL function to integrate live data into your spreadsheets! 