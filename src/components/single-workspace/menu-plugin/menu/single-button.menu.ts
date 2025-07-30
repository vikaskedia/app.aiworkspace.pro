import type { IMenuButtonItem } from '@univerjs/ui';
import { MenuItemType } from '@univerjs/ui';
import { SingleButtonOperation } from '../commands/single-button.operation';

export function CustomMenuItemSingleButtonFactory(): IMenuButtonItem<string> {
  return {
    id: SingleButtonOperation.id,
    type: MenuItemType.BUTTON,
    title: 'Item 1',
    icon: 'ButtonIcon',
    tooltip: 'Custom single button - Item 1',
  };
} 