import type { IAccessor, ICommand } from '@univerjs/core';
import { CommandType } from '@univerjs/core';

export const SingleButtonOperation: ICommand = {
  id: 'custom-menu.operation.single-button',
  type: CommandType.OPERATION,
  handler: async (_accessor: IAccessor) => {
    alert('Single button operation - Item 1 clicked!');
    console.log('🎯 Single button operation executed');
    return true;
  },
}; 