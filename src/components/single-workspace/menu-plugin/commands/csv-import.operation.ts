import type { IAccessor, ICommand } from '@univerjs/core';
import { CommandType } from '@univerjs/core';

export const CsvImportOperation: ICommand = {
  id: 'custom-menu.operation.csv-import',
  type: CommandType.OPERATION,
  handler: async (accessor: IAccessor) => {
    console.log('🔄 CSV Import operation started');
    
    try {
      // Create file input element
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.csv';
      fileInput.style.display = 'none';
      
      // Add to DOM temporarily
      document.body.appendChild(fileInput);
      
      // Wait for user to select file
      const file = await new Promise<File | null>((resolve) => {
        fileInput.onchange = (event) => {
          const target = event.target as HTMLInputElement;
          const selectedFile = target.files?.[0] || null;
          resolve(selectedFile);
          document.body.removeChild(fileInput);
        };
        
        fileInput.oncancel = () => {
          resolve(null);
          document.body.removeChild(fileInput);
        };
        
        fileInput.click();
      });
      
      if (!file) {
        console.log('📝 CSV import cancelled by user');
        return false;
      }
      
      console.log('📁 Selected file:', file.name);
      
      // Read and parse CSV file
      const csvContent = await readFileAsText(file);
      const csvData = parseCSV(csvContent);
      
      if (csvData.length === 0) {
        console.warn('⚠️ CSV file is empty or invalid');
        alert('The selected CSV file is empty or invalid.');
        return false;
      }
      
      console.log('📊 Parsed CSV data:', csvData.length, 'rows');
      
      // Get current Univer workbook and worksheet
      const { IUniverInstanceService, UniverInstanceType } = await import('@univerjs/core');
      const { SheetsSelectionsService } = await import('@univerjs/sheets');
      
      const univerInstanceService = accessor.get(IUniverInstanceService);
      const selectionService = accessor.get(SheetsSelectionsService);
      
      const workbook = univerInstanceService.getCurrentUniverSheetInstance();
      if (!workbook) {
        console.error('❌ No active workbook found');
        alert('No active spreadsheet found.');
        return false;
      }
      
      const worksheet = workbook.getActiveSheet();
      if (!worksheet) {
        console.error('❌ No active worksheet found');
        alert('No active worksheet found.');
        return false;
      }
      
      // Get current selection or use A1 as starting point
      const selection = selectionService.getCurrentLastSelection();
      const startRow = selection?.primary?.startRow ?? 0;
      const startCol = selection?.primary?.startColumn ?? 0;
      
      console.log(`📍 Importing CSV data starting at row ${startRow}, column ${startCol}`);
      
      // Convert CSV data to cell matrix and set to worksheet
      const { ICommandService } = await import('@univerjs/core');
      const { SetRangeValuesMutation } = await import('@univerjs/sheets');
      
      const commandService = accessor.get(ICommandService);
      
      // Build cell data object
      const cellData: any = {};
      
      csvData.forEach((row, rowIndex) => {
        const actualRow = startRow + rowIndex;
        cellData[actualRow] = {};
        
        row.forEach((cellValue, colIndex) => {
          const actualCol = startCol + colIndex;
          cellData[actualRow][actualCol] = {
            v: cellValue,
            t: detectCellType(cellValue),
          };
        });
      });
      
      // Execute the mutation to set cell values
      const unitId = workbook.getUnitId();
      const sheetId = worksheet.getSheetId();
      
      await commandService.executeCommand(SetRangeValuesMutation.id, {
        unitId,
        subUnitId: sheetId,
        cellValue: cellData,
      });
      
      console.log('✅ CSV data imported successfully');
      alert(`CSV file "${file.name}" imported successfully! ${csvData.length} rows imported.`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error importing CSV:', error);
      alert('Error importing CSV file. Please check the console for details.');
      return false;
    }
  },
};

// Helper function to read file as text
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
}

// Helper function to parse CSV content
function parseCSV(csvContent: string): string[][] {
  const lines = csvContent.split('\n');
  const result: string[][] = [];
  
  for (const line of lines) {
    // Skip empty lines
    if (line.trim() === '') continue;
    
    // Simple CSV parsing (handles basic cases)
    // For production, consider using a more robust CSV parser like PapaParse
    const row = parseCSVLine(line.trim());
    result.push(row);
  }
  
  return result;
}

// Helper function to parse a single CSV line
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget the last field
  result.push(current.trim());
  
  return result;
}

// Helper function to detect cell data type
function detectCellType(value: string): number {
  // Remove quotes if present
  const cleanValue = value.replace(/^["']|["']$/g, '');
  
  // Check if it's a number
  if (!isNaN(Number(cleanValue)) && cleanValue.trim() !== '') {
    return 2; // Number type
  }
  
  // Default to string
  return 1; // String type
}
