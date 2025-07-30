import type { IAccessor, ICommand } from '@univerjs/core';
import { CommandType } from '@univerjs/core';

export const DropdownListFirstItemOperation: ICommand = {
  id: 'custom-menu.operation.dropdown-list-first-item',
  type: CommandType.OPERATION,
  handler: async (_accessor: IAccessor) => {
    alert('Dropdown list first item operation - Item 1 clicked!');
    console.log('🎯 Dropdown first item operation executed');
    return true;
  },
};

export const DropdownListSecondItemOperation: ICommand = {
  id: 'custom-menu.operation.dropdown-list-second-item',
  type: CommandType.OPERATION,
  handler: async (_accessor: IAccessor) => {
    alert('Dropdown list second item operation - Item 2 clicked!');
    console.log('🎯 Dropdown second item operation executed');
    return true;
  },
}; 