import { Plugin, Injector, ICommandService } from '@univerjs/core';
import { ComponentManager, IMenuManagerService, RibbonStartGroup } from '@univerjs/ui';
import { SingleButtonOperation } from './commands/single-button.operation';
import { CsvImportOperation } from './commands/csv-import.operation';
import { 
  DropdownListFirstItemOperation,
  DropdownListSecondItemOperation 
} from './commands/dropdown-list.operation';
import { ButtonIcon } from './components/button-icon';
import { ItemIcon } from './components/item-icon';
import { MainButtonIcon } from './components/main-button-icon';
import { ImportCsvIcon } from './components/import-csv-icon';
import {
  CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID,
  CustomMenuItemDropdownListFirstItemFactory,
  CustomMenuItemDropdownListMainButtonFactory,
  CustomMenuItemDropdownListSecondItemFactory,
} from './menu/dropdown-list.menu';
import { CustomMenuItemSingleButtonFactory } from './menu/single-button.menu';
import { CsvImportMenuItemFactory } from './menu/csv-import.menu';

export class UniverSheetsCustomMenuPlugin extends Plugin {
  static override pluginName = 'UNIVER_SHEETS_CUSTOM_MENU_PLUGIN';

  protected readonly _injector!: Injector;

  override onStarting(): void {
    console.log('✅ Custom Menu Plugin starting...');
    console.log('🎯 Attempting to initialize menu...');
    
    // Try to initialize immediately
    this._tryInitializeMenu();
  }

  override onReady(): void {
    console.log('✅ Custom Menu Plugin is ready');
    
    // Try again in onReady if it failed in onStarting
    this._tryInitializeMenu();
  }

  private _tryInitializeMenu(): void {
    try {
      console.log('🔍 Trying to get injector...');
      
      // Try to get injector through different methods
      let injector: Injector | null = null;
      
      // Method 1: Try to access through the instance
      if ((this as any)._injector) {
        injector = (this as any)._injector;
        console.log('✅ Got injector from _injector property');
      }
      
      // Method 2: Try to access through getInjector if it exists
      else if (typeof (this as any).getInjector === 'function') {
        injector = (this as any).getInjector();
        console.log('✅ Got injector from getInjector method');
      }
      
             // Method 3: Try to access through plugin context
       else if ((this as any)._context && (this as any)._context.injector) {
         injector = (this as any)._context.injector;
         console.log('✅ Got injector from context');
       }
       
       // Method 4: Try to access through global window if available
       else if (typeof window !== 'undefined' && (window as any).univer) {
         const univerInstance = (window as any).univer;
         if (univerInstance && typeof univerInstance.getInjector === 'function') {
           injector = univerInstance.getInjector();
           console.log('✅ Got injector from global univer instance');
         }
       }
       
       if (!injector) {
         console.warn('⚠️ Could not find injector, will try again later');
         setTimeout(() => this._tryInitializeMenu(), 1000); // Retry after 1 second
         return;
       }
      
      console.log('🎯 Initializing custom menu with found injector...');
      
      // Get services directly from the injector
      const commandService = injector.get(ICommandService);
      const menuManagerService = injector.get(IMenuManagerService);
      const componentManager = injector.get(ComponentManager);
      
      console.log('✅ Got all required services');
      
      // Register commands
      this.disposeWithMe(commandService.registerCommand(SingleButtonOperation));
      this.disposeWithMe(commandService.registerCommand(CsvImportOperation));
      this.disposeWithMe(commandService.registerCommand(DropdownListFirstItemOperation));
      this.disposeWithMe(commandService.registerCommand(DropdownListSecondItemOperation));
      console.log('✅ Commands registered');
      
      // Register components
      this.disposeWithMe(componentManager.register('ButtonIcon', ButtonIcon));
      this.disposeWithMe(componentManager.register('ImportCsvIcon', ImportCsvIcon));
      this.disposeWithMe(componentManager.register('ItemIcon', ItemIcon));
      this.disposeWithMe(componentManager.register('MainButtonIcon', MainButtonIcon));
      console.log('✅ Components registered');
      
      // Register menus
      menuManagerService.mergeMenu({
        [RibbonStartGroup.OTHERS]: {
          [CsvImportOperation.id]: {
            order: 9,
            menuItemFactory: CsvImportMenuItemFactory,
          },
          [SingleButtonOperation.id]: {
            order: 10,
            menuItemFactory: CustomMenuItemSingleButtonFactory,
          },
          [CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID]: {
            order: 11,
            menuItemFactory: CustomMenuItemDropdownListMainButtonFactory,
            [DropdownListFirstItemOperation.id]: {
              order: 0,
              menuItemFactory: CustomMenuItemDropdownListFirstItemFactory,
            },
            [DropdownListSecondItemOperation.id]: {
              order: 1,
              menuItemFactory: CustomMenuItemDropdownListSecondItemFactory,
            },
          },
        },
      });
      console.log('✅ Menus registered');
      
      console.log('🎯 Custom dropdown menu should now appear in Univer toolbar!');
      
    } catch (error) {
      console.error('❌ Failed to initialize custom menu:', error);
    }
  }
} 