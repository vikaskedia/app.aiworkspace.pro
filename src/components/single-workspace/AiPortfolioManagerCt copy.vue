<template>
  <div class="univer-container-wrapper">
    <div id="univer-container" class="univer-container"></div>
  </div>
</template>

<script>
import { onMounted, onBeforeUnmount } from 'vue';

// Univer core with locale support
import { LocaleType, merge, Univer, UniverInstanceType } from '@univerjs/core';

// Locale imports
import DesignEnUS from '@univerjs/design/locale/en-US';
import UIEnUS from '@univerjs/ui/locale/en-US';
import DocsUIEnUS from '@univerjs/docs-ui/locale/en-US';
import SheetsEnUS from '@univerjs/sheets/locale/en-US';
import SheetsUIEnUS from '@univerjs/sheets-ui/locale/en-US';
import SheetsFormulaUIEnUS from '@univerjs/sheets-formula-ui/locale/en-US';
import SheetsNumfmtUIEnUS from '@univerjs/sheets-numfmt-ui/locale/en-US';

// Plugin imports
import { UniverRenderEnginePlugin } from '@univerjs/engine-render';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverUIPlugin } from '@univerjs/ui';
import { UniverDocsPlugin } from '@univerjs/docs';
import { UniverDocsUIPlugin } from '@univerjs/docs-ui';
import { UniverSheetsPlugin } from '@univerjs/sheets';
import { UniverSheetsUIPlugin } from '@univerjs/sheets-ui';
import { UniverSheetsFormulaUIPlugin } from '@univerjs/sheets-formula-ui';
import { UniverSheetsNumfmtUIPlugin } from '@univerjs/sheets-numfmt-ui';

// CSS imports - exactly as in documentation
import '@univerjs/design/lib/index.css';
import '@univerjs/ui/lib/index.css';
import '@univerjs/docs-ui/lib/index.css';
import '@univerjs/sheets-ui/lib/index.css';
import '@univerjs/sheets-formula-ui/lib/index.css';
import '@univerjs/sheets-numfmt-ui/lib/index.css';

export default {
  name: 'AiPortfolioManagerCt',
  setup() {
    let univer = null;

    // Workbook data structure
    const WORKBOOK_DATA = {
      id: 'workbook-01',
      locale: LocaleType.EN_US,
      name: 'UniverSheet Demo',
      sheetOrder: ['sheet-01'],
      sheets: {
        'sheet-01': {
          id: 'sheet-01',
          name: 'Sheet1',
          cellData: {},
          tabColor: '',
          hidden: 0,
          rowCount: 1000,
          columnCount: 26,
          zoomRatio: 1,
          scrollTop: 0,
          scrollLeft: 0,
          defaultColumnWidth: 93,
          defaultRowHeight: 27,
          mergeData: [],
          rowData: {},
          columnData: {},
          showGridlines: 1,
          rowHeader: {
            width: 46,
            hidden: 0,
          },
          columnHeader: {
            height: 20,
            hidden: 0,
          },
          selections: ['A1'],
          rightToLeft: 0,
        },
      },
    };

    const initializeUniver = () => {
      try {
        console.log('🚀 Initializing Univer with full documentation setup...');

        // Create Univer instance with locales - exactly as in documentation
        univer = new Univer({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: merge(
              {},
              DesignEnUS,
              UIEnUS,
              DocsUIEnUS,
              SheetsEnUS,
              SheetsUIEnUS,
              SheetsFormulaUIEnUS,
              SheetsNumfmtUIEnUS,
            ),
          },
        });

        // Register plugins in exact order from documentation
        univer.registerPlugin(UniverRenderEnginePlugin);
        univer.registerPlugin(UniverFormulaEnginePlugin);

        univer.registerPlugin(UniverUIPlugin, {
          container: 'univer-container',
        });

        univer.registerPlugin(UniverDocsPlugin);
        univer.registerPlugin(UniverDocsUIPlugin);

        univer.registerPlugin(UniverSheetsPlugin);
        univer.registerPlugin(UniverSheetsUIPlugin);
        univer.registerPlugin(UniverSheetsFormulaUIPlugin);
        univer.registerPlugin(UniverSheetsNumfmtUIPlugin);

        // Create workbook
        univer.createUnit(UniverInstanceType.UNIVER_SHEET, WORKBOOK_DATA);

        console.log('✅ Univer initialized successfully with full documentation setup!');
        
      } catch (error) {
        console.error('❌ Failed to initialize Univer:', error);
      }
    };

    onMounted(() => {
      // Ensure DOM is ready before initialization
      setTimeout(() => {
        initializeUniver();
      }, 100);
    });

    onBeforeUnmount(() => {
      if (univer) {
        try {
          univer.dispose();
          console.log('📤 Univer disposed successfully');
        } catch (error) {
          console.warn('⚠️ Error disposing Univer:', error);
        }
      }
    });

    return {};
  },
};
</script>

<style scoped>
.univer-container-wrapper {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

.univer-container {
  width: 100%;
  height: 100%;
  flex: 1;
  background: white;
  border: 1px solid #e0e6ed;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  margin: 8px;
}

/* Ensure Univer takes full space */
:deep(.univer-container) {
  width: 100%;
  height: 100%;
}

:deep(.univer-container .univer) {
  width: 100%;
  height: 100%;
}

/* Specific styling for Univer components */
:deep(.univer-container .universheet-render-canvas) {
  width: 100% !important;
  height: 100% !important;
}

/* Hide scrollbars on the container to prevent double scrollbars */
:deep(.univer-container .univer-scroll-container) {
  overflow: hidden;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .univer-container {
    margin: 4px;
    border-radius: 4px;
  }
}

@media (max-width: 480px) {
  .univer-container-wrapper {
    height: calc(100vh - 60px);
  }
  
  .univer-container {
    margin: 2px;
  }
}
</style>