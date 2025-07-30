import type { IMenuButtonItem, IMenuSelectorItem } from '@univerjs/ui';
import { MenuItemType } from '@univerjs/ui';
import { DropdownListFirstItemOperation, DropdownListSecondItemOperation } from '../commands/dropdown-list.operation';

export const CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID = 'custom-menu.operation.dropdown-list';

export function CustomMenuItemDropdownListMainButtonFactory(): IMenuSelectorItem<string> {
  return {
    // When type is MenuItemType.SUBITEMS, this factory serves as a container for the drop-down list, and you can set any unique id
    id: CUSTOM_MENU_DROPDOWN_LIST_OPERATION_ID,
    // The type of the menu item, in this case, it is a subitems
    type: MenuItemType.SUBITEMS,
    icon: 'MainButtonIcon',
    tooltip: 'Custom dropdown menu',
    title: 'Dropdown Menu',
  };
}

export function CustomMenuItemDropdownListFirstItemFactory(): IMenuButtonItem<string> {
  return {
    id: DropdownListFirstItemOperation.id,
    type: MenuItemType.BUTTON,
    title: 'Item 1',
    icon: 'ItemIcon',
  };
}

export function CustomMenuItemDropdownListSecondItemFactory(): IMenuButtonItem<string> {
  return {
    id: DropdownListSecondItemOperation.id,
    type: MenuItemType.BUTTON,
    title: 'Item 2', 
    icon: 'ItemIcon',
  };
} 