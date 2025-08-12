import type { IMenuButtonItem } from '@univerjs/ui';
import { MenuItemType } from '@univerjs/ui';
import { CsvImportOperation } from '../commands/csv-import.operation';

export function CsvImportMenuItemFactory(): IMenuButtonItem<string> {
  return {
    id: CsvImportOperation.id,
    type: MenuItemType.BUTTON,
    title: 'Import CSV',
    icon: 'ImportCsvIcon',
    tooltip: 'Import data from a CSV file into the current spreadsheet',
  };
}
