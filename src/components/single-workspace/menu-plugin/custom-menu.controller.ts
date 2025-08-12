import { Disposable, ICommandService, Injector } from '@univerjs/core';
import { ComponentManager, IMenuManagerService, RibbonStartGroup, ContextMenuGroup, ContextMenuPosition } from '@univerjs/ui';
import { DropdownListFirstItemOperation, DropdownListSecondItemOperation } from './commands/dropdown-list.operation';
import { SingleButtonOperation } from './commands/single-button.operation';
import { CsvImportOperation } from './commands/csv-import.operation';
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

export class CustomMenuController extends Disposable {
  private readonly _injector: Injector;
  private readonly _commandService: ICommandService;
  private readonly _menuManagerService: IMenuManagerService;
  private readonly _componentManager: ComponentManager;

  constructor(injector: Injector) {
    super();
    
    this._injector = injector;
    
    // Check if injector is valid
    if (!injector) {
      console.error('❌ Injector is null or undefined');
      throw new Error('Invalid injector provided');
    }
    
    // Check if injector has get method
    if (typeof injector.get !== 'function') {
      console.error('❌ Injector does not have get method');
      throw new Error('Invalid injector - missing get method');
    }
    
    let servicesObtained = 0;
    
    try {
      this._commandService = injector.get(ICommandService);
      console.log('✅ Command service obtained');
      servicesObtained++;
    } catch (error) {
      console.warn('⚠️ Failed to get command service:', error);
    }
    
    try {
      this._menuManagerService = injector.get(IMenuManagerService);
      console.log('✅ Menu manager service obtained');
      servicesObtained++;
    } catch (error) {
      console.warn('⚠️ Failed to get menu manager service:', error);
    }
    
    try {
      this._componentManager = injector.get(ComponentManager);
      console.log('✅ Component manager obtained');
      servicesObtained++;
    } catch (error) {
      console.warn('⚠️ Failed to get component manager:', error);
    }

    console.log(`📊 Obtained ${servicesObtained}/3 services`);

    // Initialize in correct order if services are available
    if (this._commandService && this._componentManager && this._menuManagerService) {
      console.log('✅ All services available - initializing complete menu system');
      this._initCommands();
      this._registerComponents();
      this._initMenus();
      console.log('🎯 Custom dropdown menu with 3-dot should now appear in Univer toolbar');
    } else {
      console.warn('⚠️ Some services missing - menu may not appear correctly');
      console.log(`Missing: ${!this._commandService ? 'CommandService ' : ''}${!this._componentManager ? 'ComponentManager ' : ''}${!this._menuManagerService ? 'MenuManagerService' : ''}`);
    }
  }

  /**
   * register commands
   */
  private _initCommands(): void {
    [
      CsvImportOperation,
      SingleButtonOperation,
      DropdownListFirstItemOperation,
      DropdownListSecondItemOperation,
    ].forEach((c) => {
      this.disposeWithMe(this._commandService.registerCommand(c));
    });
  }

  /**
   * register icon components
   */
  private _registerComponents(): void {
    this.disposeWithMe(this._componentManager.register('ButtonIcon', ButtonIcon));
    this.disposeWithMe(this._componentManager.register('ImportCsvIcon', ImportCsvIcon));
    this.disposeWithMe(this._componentManager.register('ItemIcon', ItemIcon));
    this.disposeWithMe(this._componentManager.register('MainButtonIcon', MainButtonIcon));
  }

  /**
   * register menu items
   */
  private _initMenus(): void {
    this._menuManagerService.mergeMenu({
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
      [ContextMenuPosition.MAIN_AREA]: {
        [ContextMenuGroup.OTHERS]: {
          [SingleButtonOperation.id]: {
            order: 12,
            menuItemFactory: CustomMenuItemSingleButtonFactory,
          },
          [CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID]: {
            order: 9,
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
      },
    });
  }
} 