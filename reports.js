document.addEventListener('DOMContentLoaded', () => {
  const BASE = 'http://localhost:3000/api';

  const reportTypeMenu = document.getElementById('reportTypeMenu');
  const printButton = document.querySelector('.reports-print-btn');

  const pendingPanel = document.getElementById('pendingPurchasesPanel');
  const deadInventoryPanel = document.getElementById('deadInventoryPanel');
  const deadInventoryMeta = document.getElementById('deadInventoryMeta');
  const deadInventoryTableBody = document.getElementById('deadInventoryTableBody');
  const genericPanel = document.getElementById('genericReportPanel');
  const genericMessage = document.getElementById('genericReportMessage');

  const projectSearchInput = document.getElementById('pendingProjectSearch');
  const reportThemeSelect = document.getElementById('reportThemeSelect');
  const projectSuggestions = document.getElementById('pendingProjectSuggestions');
  const pendingMeta = document.getElementById('pendingPurchasesMeta');
  const pendingTableBody = document.getElementById('pendingPurchasesTableBody');
  const filterQisInput = document.getElementById('filterQis');
  const filterPartInput = document.getElementById('filterPart');
  const filterDescriptionInput = document.getElementById('filterDescription');
  const filterVendorInput = document.getElementById('filterVendor');
  const filterQuantityInput = document.getElementById('filterQuantity');
  const filterTriggers = document.querySelectorAll('.th-filter-trigger');
  const filterPopovers = document.querySelectorAll('.th-filter-popover');

  const kpiTotalPurchases = document.getElementById('kpiTotalPurchases');
  const kpiPendingQuoted = document.getElementById('kpiPendingQuoted');
  const kpiPendingPercent = document.getElementById('kpiPendingPercent');
  const kpiProjectsWithPending = document.getElementById('kpiProjectsWithPending');
  const pendingPercentBar = document.getElementById('pendingPercentBar');
  const pendingPercentProgress = document.getElementById('pendingPercentProgress');
  const pendingPercentCaption = document.getElementById('pendingPercentCaption');

  const pendingStatusChartEl = document.getElementById('pendingStatusChart');
  const pendingProjectsChartEl = document.getElementById('pendingProjectsChart');
  const reportKpiLabels = document.querySelectorAll('.report-kpi-label');
  const reportChartTitles = document.querySelectorAll('.report-chart-title');

  let allPurchases = [];
  let allProjects = [];
  let pendingPurchases = [];
  let currentFilteredRows = [];
  let statusChart = null;
  let projectsChart = null;
  let activeReportType = 'pending-purchases';

  const REPORT_MODES = Object.freeze({
    spending: {
      pendingLabel: 'registros de gasto',
      kpiPendingLabel: 'Gasto total',
      kpiPercentLabel: 'Ticket promedio',
      kpiProjectsLabel: 'Networks con gasto',
      topProjectsTitle: 'Top proyectos por gasto',
      projectsDatasetLabel: 'Monto gastado',
      loadingMessage: 'Cargando reporte de gastos...',
      emptyMessage: 'No se encontraron registros de gasto para el filtro aplicado.',
      errorMeta: 'No fue posible cargar el reporte de gastos.',
      errorTable: 'Error al cargar datos del reporte de gastos.',
      excelTitle: 'Reporte de Gastos',
      excelPendingKpiLabel: 'Gasto total',
      excelTopSectionTitle: 'Top proyectos por gasto (filtro actual)',
      excelFilePrefix: 'reporte_gastos',
      statusFilter: () => true
    },
    'pending-purchases': {
      pendingLabel: 'compras pendientes (Quoted)',
      kpiPendingLabel: 'Pendientes Quoted',
      kpiPercentLabel: '% Pendiente (Quoted)',
      kpiProjectsLabel: 'Proyectos con compras pendientes',
      topProjectsTitle: 'Top proyectos con compras pendientes',
      projectsDatasetLabel: 'Compras pendientes',
      loadingMessage: 'Cargando compras pendientes...',
      emptyMessage: 'No se encontraron compras pendientes para el proyecto buscado.',
      errorMeta: 'No fue posible cargar el reporte de compras pendientes.',
      errorTable: 'Error al cargar datos de compras pendientes.',
      excelTitle: 'Reporte de Compras Pendientes',
      excelPendingKpiLabel: 'Compras pendientes (Quoted)',
      excelTopSectionTitle: 'Top proyectos con compras pendientes (filtro actual)',
      excelFilePrefix: 'reporte_compras_pendientes',
      statusFilter: (status) => isQuotedStatus(status)
    },
    'po-pending-delivery': {
      pendingLabel: 'compras pendientes de entrega (Pending Delivery)',
      kpiPendingLabel: 'Pendientes Delivery',
      kpiPercentLabel: '% Pendiente (Delivery)',
      kpiProjectsLabel: 'Proyectos con pendientes de entrega',
      topProjectsTitle: 'Top proyectos con pendientes de entrega',
      projectsDatasetLabel: 'Pendientes de entrega',
      loadingMessage: 'Cargando compras pendientes de entrega...',
      emptyMessage: 'No se encontraron compras pendientes de entrega para el proyecto buscado.',
      errorMeta: 'No fue posible cargar el reporte de pendientes de entrega.',
      errorTable: 'Error al cargar datos de pendientes de entrega.',
      excelTitle: 'Reporte de POs Pendientes de Entrega',
      excelPendingKpiLabel: 'Compras pendientes de entrega (Pending Delivery)',
      excelTopSectionTitle: 'Top proyectos con pendientes de entrega (filtro actual)',
      excelFilePrefix: 'reporte_pos_pendientes_entrega',
      statusFilter: (status) => isPendingDeliveryStatus(status)
    },
    'po-closed': {
      pendingLabel: 'POs cerradas (Delivered)',
      kpiPendingLabel: 'POs Cerradas',
      kpiPercentLabel: '% Cerradas',
      kpiProjectsLabel: 'Proyectos con PO cerradas',
      topProjectsTitle: 'Top proyectos con POs cerradas',
      projectsDatasetLabel: 'POs cerradas',
      loadingMessage: 'Cargando POs cerradas...',
      emptyMessage: 'No se encontraron POs cerradas para el proyecto buscado.',
      errorMeta: 'No fue posible cargar el reporte de POs cerradas.',
      errorTable: 'Error al cargar datos de POs cerradas.',
      excelTitle: 'Reporte de POs Cerradas',
      excelPendingKpiLabel: 'POs cerradas (Delivered)',
      excelTopSectionTitle: 'Top proyectos con POs cerradas (filtro actual)',
      excelFilePrefix: 'reporte_pos_cerradas',
      statusFilter: (status) => isDeliveredStatus(status)
    }
  });

  const REPORT_THEMES = Object.freeze({
    silver: {
      cssVars: {
        '--report-header-from': '#1F3A5F',
        '--report-header-to': '#2E5B8A',
        '--report-header-text': '#FFFFFF',
        '--report-card-from': '#1F3A5F',
        '--report-card-to': '#2E5B8A',
        '--report-card-accent': '#F5A623',
        '--report-chart-card': '#FFFFFF',
        '--report-progress-from': '#2E5B8A',
        '--report-progress-to': '#F5A623',
        '--report-filter-btn-from': '#F5A623',
        '--report-filter-btn-to': '#D9901A',
        '--report-filter-btn-hover-from': '#F8C146',
        '--report-filter-btn-hover-to': '#F5A623',
        '--report-toolbar-from': '#1F3A5F',
        '--report-toolbar-to': '#2E5B8A',
        '--report-toolbar-border': 'rgba(31, 58, 95, 0.35)',
        '--report-label-color': '#FFFFFF',
        '--report-field-bg': '#FFFFFF',
        '--report-field-text': '#2F3E4D',
        '--report-field-border': '#C9D4E2',
        '--report-field-focus': '#2E5B8A',
        '--report-field-focus-ring': 'rgba(46, 91, 138, 0.2)',
        '--report-print-text': '#FFFFFF',
        '--report-panel-from': '#F4F6F8',
        '--report-panel-to': '#EDF2F7',
        '--report-panel-border': '#D8E0EA',
        '--report-panel-shadow': 'rgba(31, 58, 95, 0.12)',
        '--report-meta-text': '#5F6E7D',
        '--report-kpi-label-text': '#E5EDF7',
        '--report-kpi-value-text': '#FFFFFF',
        '--report-kpi-emphasis-glow': 'rgba(248, 193, 70, 0.35)',
        '--report-percent-strip-bg': '#FFFFFF',
        '--report-percent-strip-border': '#D8E0EA',
        '--report-percent-title': '#2F3E4D',
        '--report-progress-bg': '#E7EDF5',
        '--report-percent-caption': '#6B7C8D',
        '--report-chart-title': '#2F3E4D',
        '--report-chart-border': '#D8E0EA',
        '--report-table-border': '#CFD8E3',
        '--report-table-text': '#2F3E4D',
        '--report-row-hover': 'rgba(46, 91, 138, 0.1)',
        '--report-popover-bg': '#FFFFFF',
        '--report-popover-border': '#CBD6E3',
        '--report-popover-input-bg': '#F7FAFD',
        '--report-popover-input-border': '#C8D4E2',
        '--report-popover-input-text': '#2F3E4D',
        '--report-popover-input-placeholder': '#7A8A99',
        '--report-placeholder-text': '#526273'
      },
      excel: {
        headerBg: 'DCE8F6',
        tableHeaderBg: 'C9D9ED',
        sectionTitle: '2F4D6E',
        textLight: '1F2D3D',
        zebraRow: 'F6FAFF',
        kpiLabelBg: 'EAF1FB',
        border: 'B8CBE1',
        gridBorder: '7E92A8'
      },
      chart: {
        quoted: '#2E5B8A',
        pr: '#1F3A5F',
        shopping: '#F5A623',
        po: '#F8C146',
        delivered: '#7A8A99',
        other: '#A8B4C0',
        projectsBar: '#2E5B8A',
        legendText: '#2F3E4D',
        ticks: '#2F3E4D',
        gridMajor: 'rgba(46, 91, 138, 0.2)',
        gridMinor: 'rgba(46, 91, 138, 0.1)'
      }
    },
    ocean: {
      cssVars: {
        '--report-header-from': '#7C6ACF',
        '--report-header-to': '#4A90E2',
        '--report-header-text': '#FFFFFF',
        '--report-card-from': '#7C6ACF',
        '--report-card-to': '#4A90E2',
        '--report-card-accent': '#6FCF97',
        '--report-chart-card': '#FFFFFF',
        '--report-progress-from': '#7CB342',
        '--report-progress-to': '#6FCF97',
        '--report-filter-btn-from': '#7C6ACF',
        '--report-filter-btn-to': '#6A59BC',
        '--report-filter-btn-hover-from': '#A58BD6',
        '--report-filter-btn-hover-to': '#7C6ACF',
        '--report-toolbar-from': '#7C6ACF',
        '--report-toolbar-to': '#4A90E2',
        '--report-toolbar-border': 'rgba(124, 106, 207, 0.3)',
        '--report-label-color': '#FFFFFF',
        '--report-field-bg': '#FFFFFF',
        '--report-field-text': '#2E3A45',
        '--report-field-border': '#E0E6ED',
        '--report-field-focus': '#7C6ACF',
        '--report-field-focus-ring': 'rgba(124, 106, 207, 0.2)',
        '--report-print-text': '#FFFFFF',
        '--report-panel-from': '#F5F7FA',
        '--report-panel-to': '#EEF2F7',
        '--report-panel-border': '#E0E6ED',
        '--report-panel-shadow': 'rgba(74, 144, 226, 0.12)',
        '--report-meta-text': '#7B8794',
        '--report-kpi-label-text': '#F0EEFB',
        '--report-kpi-value-text': '#FFFFFF',
        '--report-kpi-emphasis-glow': 'rgba(124, 106, 207, 0.35)',
        '--report-percent-strip-bg': '#FFFFFF',
        '--report-percent-strip-border': '#E0E6ED',
        '--report-percent-title': '#2E3A45',
        '--report-progress-bg': '#EEF2F7',
        '--report-percent-caption': '#7B8794',
        '--report-chart-title': '#2E3A45',
        '--report-chart-border': '#E0E6ED',
        '--report-table-border': '#E0E6ED',
        '--report-table-text': '#2E3A45',
        '--report-row-hover': 'rgba(124, 106, 207, 0.08)',
        '--report-popover-bg': '#FFFFFF',
        '--report-popover-border': '#D9E1EA',
        '--report-popover-input-bg': '#F7F9FC',
        '--report-popover-input-border': '#D5DFEA',
        '--report-popover-input-text': '#2E3A45',
        '--report-popover-input-placeholder': '#7B8794',
        '--report-placeholder-text': '#617181'
      },
      excel: {
        headerBg: 'EAE4FA',
        tableHeaderBg: 'DCD3F6',
        sectionTitle: '4E3F82',
        textLight: '2E3A45',
        zebraRow: 'F7F4FF',
        kpiLabelBg: 'EEE9FB',
        border: 'D8DDF0',
        gridBorder: '8791A6'
      },
      chart: {
        quoted: '#7C6ACF',
        pr: '#A58BD6',
        shopping: '#4A90E2',
        po: '#7FB3F6',
        delivered: '#6FCF97',
        other: '#7CB342',
        projectsBar: '#7C6ACF',
        legendText: '#2E3A45',
        ticks: '#2E3A45',
        gridMajor: 'rgba(224, 230, 237, 0.95)',
        gridMinor: 'rgba(238, 242, 247, 0.95)'
      }
    },
    carbon: {
      cssVars: {
        '--report-header-from': '#111827',
        '--report-header-to': '#1E293B',
        '--report-header-text': '#E5E7EB',
        '--report-card-from': '#6D28D9',
        '--report-card-to': '#3B82F6',
        '--report-card-accent': '#22D3EE',
        '--report-chart-card': '#111827',
        '--report-progress-from': '#3B82F6',
        '--report-progress-to': '#8B5CF6',
        '--report-filter-btn-from': '#3B82F6',
        '--report-filter-btn-to': '#6D28D9',
        '--report-filter-btn-hover-from': '#22D3EE',
        '--report-filter-btn-hover-to': '#8B5CF6',
        '--report-toolbar-from': '#0F172A',
        '--report-toolbar-to': '#111827',
        '--report-toolbar-border': 'rgba(51, 65, 85, 0.8)',
        '--report-label-color': '#E5E7EB',
        '--report-field-bg': '#1E293B',
        '--report-field-text': '#E5E7EB',
        '--report-field-border': '#334155',
        '--report-field-focus': '#3B82F6',
        '--report-field-focus-ring': 'rgba(59, 130, 246, 0.35)',
        '--report-print-text': '#E5E7EB',
        '--report-panel-from': '#0F172A',
        '--report-panel-to': '#111827',
        '--report-panel-border': '#334155',
        '--report-panel-shadow': 'rgba(59, 130, 246, 0.22)',
        '--report-meta-text': '#9CA3AF',
        '--report-kpi-label-text': '#C6D2E3',
        '--report-kpi-value-text': '#E5E7EB',
        '--report-kpi-emphasis-glow': 'rgba(139, 92, 246, 0.4)',
        '--report-percent-strip-bg': '#1E293B',
        '--report-percent-strip-border': '#334155',
        '--report-percent-title': '#E5E7EB',
        '--report-progress-bg': '#0F172A',
        '--report-percent-caption': '#9CA3AF',
        '--report-chart-title': '#E5E7EB',
        '--report-chart-border': '#334155',
        '--report-table-border': '#334155',
        '--report-table-text': '#E5E7EB',
        '--report-row-hover': 'rgba(59, 130, 246, 0.18)',
        '--report-popover-bg': '#1E293B',
        '--report-popover-border': '#334155',
        '--report-popover-input-bg': '#111827',
        '--report-popover-input-border': '#334155',
        '--report-popover-input-text': '#E5E7EB',
        '--report-popover-input-placeholder': '#9CA3AF',
        '--report-placeholder-text': '#9CA3AF'
      },
      excel: {
        headerBg: 'E5EDFF',
        tableHeaderBg: 'D3E2FF',
        sectionTitle: '334A78',
        textLight: '1F2D46',
        zebraRow: 'F5F8FF',
        kpiLabelBg: 'E8EEFA',
        border: 'BDCCE6',
        gridBorder: '71839E'
      },
      chart: {
        quoted: '#60A5FA',
        pr: '#A78BFA',
        shopping: '#6EE7B7',
        po: '#FACC15',
        delivered: '#22D3EE',
        other: '#8B5CF6',
        projectsBar: '#3B82F6',
        legendText: '#E5E7EB',
        ticks: '#9CA3AF',
        gridMajor: 'rgba(59, 130, 246, 0.28)',
        gridMinor: 'rgba(139, 92, 246, 0.22)'
      }
    }
  });
  let activeReportThemeKey = 'silver';

  function argb(hexValue) {
    return `FF${String(hexValue || '').replace('#', '').toUpperCase()}`;
  }

  function getActiveTheme() {
    return REPORT_THEMES[activeReportThemeKey] || REPORT_THEMES.silver;
  }

  function getExcelGridBorderArgb(theme) {
    return argb(theme?.excel?.gridBorder || theme?.excel?.border || 'A0A0A0');
  }

  function buildExcelCellBorder(theme, style = 'thin') {
    const borderArgb = getExcelGridBorderArgb(theme);
    return {
      top: { style, color: { argb: borderArgb } },
      bottom: { style, color: { argb: borderArgb } },
      left: { style, color: { argb: borderArgb } },
      right: { style, color: { argb: borderArgb } }
    };
  }

  function applyExcelRangeBorders(sheet, fromRow, toRow, fromColumn, toColumn, theme, style = 'thin') {
    for (let row = fromRow; row <= toRow; row += 1) {
      for (let col = fromColumn; col <= toColumn; col += 1) {
        sheet.getRow(row).getCell(col).border = buildExcelCellBorder(theme, style);
      }
    }
  }

  function setExcelBorderSide(cell, side, style, borderArgb) {
    const currentBorder = cell.border || {};
    cell.border = {
      ...currentBorder,
      [side]: { style, color: { argb: borderArgb } }
    };
  }

  function applyExcelTableBorders(sheet, fromRow, toRow, fromColumn, toColumn, theme) {
    if (toRow < fromRow || toColumn < fromColumn) {
      return;
    }

    applyExcelRangeBorders(sheet, fromRow, toRow, fromColumn, toColumn, theme, 'thin');

    const borderArgb = getExcelGridBorderArgb(theme);
    for (let col = fromColumn; col <= toColumn; col += 1) {
      setExcelBorderSide(sheet.getRow(fromRow).getCell(col), 'top', 'medium', borderArgb);
      setExcelBorderSide(sheet.getRow(toRow).getCell(col), 'bottom', 'medium', borderArgb);
    }

    for (let row = fromRow; row <= toRow; row += 1) {
      setExcelBorderSide(sheet.getRow(row).getCell(fromColumn), 'left', 'medium', borderArgb);
      setExcelBorderSide(sheet.getRow(row).getCell(toColumn), 'right', 'medium', borderArgb);
    }
  }

  function applyHeaderCellStyle(cell, theme) {
    cell.font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.tableHeaderBg) }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = buildExcelCellBorder(theme, 'thin');
  }

  function applyReportTheme(themeKey) {
    const selectedKey = REPORT_THEMES[themeKey] ? themeKey : 'silver';
    activeReportThemeKey = selectedKey;

    const theme = getActiveTheme();
    Object.entries(theme.cssVars).forEach(([cssVar, value]) => {
      document.documentElement.style.setProperty(cssVar, value);
    });

    if (reportThemeSelect && reportThemeSelect.value !== selectedKey) {
      reportThemeSelect.value = selectedKey;
    }

    if (allPurchases.length > 0) {
      updateStatusChart();
      updateProjectsChart(currentFilteredRows);
    }
  }

  function normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isQuotedStatus(status) {
    return normalizeText(status) === 'quoted';
  }

  function isPendingDeliveryStatus(status) {
    return normalizeText(status) === 'pending delivery';
  }

  function isDeliveredStatus(status) {
    const normalized = normalizeText(status);
    return normalized === 'delivered' ||
           normalized === 'delivered to brk' ||
           normalized === 'reviewed and imported' ||
           normalized === 'delivered to hw us' ||
           normalized === 'in the process of delivery to hw us';
  }

  function getActiveReportConfig() {
    return REPORT_MODES[activeReportType] || REPORT_MODES['pending-purchases'];
  }

  function getPendingItemLabel() {
    return activeReportType === 'po-closed' ? 'Cerradas' : 'Pendientes';
  }

  function isSpendingMode() {
    return activeReportType === 'spending';
  }

  function parseAmount(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
  }

  function formatCurrency(value) {
    const amount = parseAmount(value);
    return `$${amount.toFixed(2)}`;
  }

  function filterClosedPOs(rows) {
    // Agrupar por número de PO
    const poMap = new Map();
    
    rows.forEach((row) => {
      const poNumber = row.po || '';
      if (!poNumber) return; // Ignorar items sin PO
      
      if (!poMap.has(poNumber)) {
        poMap.set(poNumber, []);
      }
      poMap.get(poNumber).push(row);
    });

    // Retornar solo un item representativo por cada PO donde TODOS los items están delivered
    const closedPOs = [];
    poMap.forEach((items, poNumber) => {
      const allDelivered = items.every((item) => isDeliveredStatus(item.status));
      
      if (allDelivered) {
        // Usar el primer item como representante del PO
        closedPOs.push(items[0]);
      }
    });

    return closedPOs;
  }

  function applyReportModeUI() {
    const config = getActiveReportConfig();
    const shouldShowPoColumn = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';
    const isSpending = isSpendingMode();

    if (reportKpiLabels[1]) {
      reportKpiLabels[1].textContent = config.kpiPendingLabel;
    }
    if (reportKpiLabels[2]) {
      reportKpiLabels[2].textContent = config.kpiPercentLabel;
    }
    if (reportKpiLabels[3]) {
      reportKpiLabels[3].textContent = config.kpiProjectsLabel;
    }
    if (reportChartTitles[1]) {
      reportChartTitles[1].textContent = config.topProjectsTitle;
    }

    const searchLabel = document.querySelector('label[for="pendingProjectSearch"]');
    if (searchLabel) {
      searchLabel.textContent = isSpending ? 'Buscar proyecto o network' : 'Buscar proyecto';
    }

    const quantityHeader = filterQuantityInput?.closest('th')?.querySelector('span');
    if (quantityHeader) {
      quantityHeader.textContent = isSpending ? 'Monto' : 'Cantidad';
    }
    if (filterQuantityInput) {
      filterQuantityInput.placeholder = isSpending ? 'Buscar monto' : 'Buscar cantidad';
    }
    
    // Mostrar/ocultar columna de PO
    const poColumnHeader = document.getElementById('poColumnHeader');
    if (poColumnHeader) {
      poColumnHeader.style.display = shouldShowPoColumn ? '' : 'none';
    }
  }

  function isActiveProjectStatus(status) {
    const value = normalizeText(status || 'active');
    return !value || value === 'active';
  }

  function buildActiveProjectKeySet(projects) {
    const activeKeys = new Set();

    (Array.isArray(projects) ? projects : []).forEach((project) => {
      if (!isActiveProjectStatus(project.status)) {
        return;
      }

      const noProject = String(project.no_project || '').trim();
      const projectName = String(project.name_project || '').trim();

      if (noProject) {
        activeKeys.add(normalizeText(noProject));
      }
      if (projectName) {
        activeKeys.add(normalizeText(projectName));
      }
    });

    return activeKeys;
  }

  function isPurchaseFromActiveProject(row, activeProjectKeys) {
    if (!(activeProjectKeys instanceof Set) || activeProjectKeys.size === 0) {
      return true;
    }

    const noProject = normalizeText(row.no_project || '');
    const projectName = normalizeText(row.project_name || '');

    return activeProjectKeys.has(noProject) || activeProjectKeys.has(projectName);
  }

  function normalizeStage(status) {
    const value = normalizeText(status);

    if (value === 'quoted') return 'Quoted';
    if (value === 'pr') return 'PR';
    if (value === 'shopping cart') return 'Shopping cart';
    if (value === 'po') return 'PO';
    if (
      value === 'delivered' ||
      value === 'delivered to brk' ||
      value === 'reviewed and imported' ||
      value === 'delivered to hw us' ||
      value === 'in the process of delivery to hw us'
    ) {
      return 'Delivered';
    }

    return 'Otros';
  }

  function toPercent(value) {
    const safe = Number.isFinite(value) ? value : 0;
    return `${safe.toFixed(1)}%`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatProjectCell(row) {
    const projectName = String(row.project_name || '').trim();
    const noProject = String(row.no_project || '').trim();

    if (projectName && noProject) {
      return `${projectName}`;
    }

    return projectName || noProject || '-';
  }

  async function loadAllProjects() {
    try {
      const response = await fetch(`${BASE}/projects/all`);
      const projects = await response.json();
      allProjects = (Array.isArray(projects) ? projects : []).filter((project) => {
        return isActiveProjectStatus(project.status);
      });
    } catch (error) {
      allProjects = [];
    }
  }

  function renderProjectSuggestions(termRaw) {
    if (!projectSuggestions) {
      return;
    }

    const term = normalizeText(termRaw || '');
    projectSuggestions.innerHTML = '';

    if (!term) {
      projectSuggestions.style.display = 'none';
      return;
    }

    const filtered = allProjects
      .filter((project) => {
        const projectName = normalizeText(project.name_project || '');
        const projectId = normalizeText(project.no_project || '');
        if (projectName.includes('sin asignar')) return false;
        return projectName.includes(term) || projectId.includes(term);
      })
      .sort((a, b) => {
        const aName = normalizeText(a.name_project || '');
        const bName = normalizeText(b.name_project || '');
        const aStarts = aName.startsWith(term);
        const bStarts = bName.startsWith(term);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return aName.localeCompare(bName);
      })
      .slice(0, 20);

    filtered.forEach((project) => {
      const item = document.createElement('div');
      item.className = 'reports-project-suggestion-item';
      item.textContent = `${project.no_project} - ${project.name_project || ''}`;
      item.addEventListener('click', () => {
        projectSearchInput.value = `${project.no_project} - ${project.name_project || ''}`;
        projectSearchInput.dataset.noProject = String(project.no_project || '').trim();
        projectSuggestions.style.display = 'none';
        applyProjectFilter();
      });
      projectSuggestions.appendChild(item);
    });

    projectSuggestions.style.display = filtered.length ? 'block' : 'none';
  }

  function updateMeta(total, filteredCount, searchTerm) {
    const config = getActiveReportConfig();

    if (!searchTerm) {
      pendingMeta.textContent = `Total ${config.pendingLabel}: ${total}`;
      return;
    }

    pendingMeta.textContent = `Mostrando ${filteredCount} de ${total} ${config.pendingLabel}`;
  }

  function renderPendingRows(rows) {
    const config = getActiveReportConfig();

    if (!Array.isArray(rows) || rows.length === 0) {
      currentFilteredRows = [];
      const showPoColumn = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';
      const colspan = showPoColumn ? 8 : 7;
      pendingTableBody.innerHTML = `
        <tr>
          <td colspan="${colspan}" class="text-center">${config.emptyMessage}</td>
        </tr>
      `;
      return;
    }

    currentFilteredRows = rows;
    const showPoColumn = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';

    pendingTableBody.innerHTML = rows
      .map((row) => {
        const networkValueRaw = String(row.network || '').trim();
        const projectBase = formatProjectCell(row);
        const projectDisplay = isSpendingMode() && networkValueRaw
          ? `${projectBase} (${networkValueRaw})`
          : projectBase;
        const projectValue = escapeHtml(projectDisplay);
        const noProjectValue = escapeHtml(row.no_project || '-');
        const poValue = escapeHtml(row.po || '-');
        const qisValue = escapeHtml(row.no_qis || '-');
        const partValue = escapeHtml(row.no_part || '-');
        const descriptionValue = escapeHtml(row.description || '-');
        const vendorValue = escapeHtml(row.vendor_name || '-');
        const quantityValue = isSpendingMode()
          ? escapeHtml(formatCurrency(row.total_amount))
          : escapeHtml(row.quantity ?? '-');

        const poCell = showPoColumn ? `<td>${poValue}</td>` : '';

        return `
          <tr>
            <td>${projectValue}</td>
            <td>${noProjectValue}</td>
            ${poCell}
            <td>${qisValue}</td>
            <td>${partValue}</td>
            <td>${descriptionValue}</td>
            <td>${vendorValue}</td>
            <td>${quantityValue}</td>
          </tr>
        `;
      })
      .join('');
  }

  function getExcelTimestamp() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}${mm}${dd}_${hh}${min}`;
  }

  function getStatusDistributionRows() {
    const labels = ['Quoted', 'PR', 'Shopping cart', 'PO', 'Delivered', 'Otros'];
    const counts = labels.reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});

    allPurchases.forEach((row) => {
      const stage = normalizeStage(row.status);
      counts[stage] = (counts[stage] || 0) + 1;
    });

    const total = allPurchases.length || 1;
    return labels.map((label) => {
      const value = counts[label] || 0;
      const pct = (value / total) * 100;
      return [label, value, `${pct.toFixed(1)}%`];
    });
  }

  function getTopProjectsRows(rows, limit = 10) {
    const projectTotals = new Map();
    const spendingMode = isSpendingMode();

    rows.forEach((row) => {
      const noProject = String(row.no_project || '').trim();
      const projectName = String(row.project_name || '').trim();
      const label = noProject ? `${noProject}${projectName ? ` - ${projectName}` : ''}` : 'Sin proyecto';
      const increment = spendingMode ? parseAmount(row.total_amount) : 1;
      projectTotals.set(label, (projectTotals.get(label) || 0) + increment);
    });

    return Array.from(projectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([project, pendingCount]) => [project, pendingCount]);
  }

  function buildSummarySheetData() {
    const config = getActiveReportConfig();
    const totalPurchases = allPurchases.length;
    const totalPending = pendingPurchases.length;
    const visiblePending = currentFilteredRows.length;
    const totalSpent = pendingPurchases.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
    const visibleSpent = currentFilteredRows.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
    const pendingPercent = totalPurchases > 0 ? (totalPending / totalPurchases) * 100 : 0;
    const visiblePercent = totalPending > 0 ? (visiblePending / totalPending) * 100 : 0;
    const selectedProjectLabel = projectSearchInput?.value?.trim() || 'Todos los proyectos';
    const pendingLabel = getPendingItemLabel();
    const spendingMode = isSpendingMode();

    const statusDistributionRows = getStatusDistributionRows();
    const topProjectsRows = getTopProjectsRows(currentFilteredRows);

    const kpiRows = spendingMode
      ? [
          ['Total registros de gasto (proyectos activos)', totalPurchases],
          ['Gasto total', formatCurrency(totalSpent)],
          ['Ticket promedio', formatCurrency(totalPending > 0 ? (totalSpent / totalPending) : 0)],
          ['Gasto visible (filtro actual)', formatCurrency(visibleSpent)],
          ['Cobertura del filtro', `${(totalSpent > 0 ? (visibleSpent / totalSpent) * 100 : 0).toFixed(1)}%`]
        ]
      : [
          ['Total compras (proyectos activos)', totalPurchases],
          [config.excelPendingKpiLabel, totalPending],
          [`${pendingLabel} % (proyectos activos)`, `${pendingPercent.toFixed(1)}%`],
          [`${pendingLabel} visibles (filtro actual)`, visiblePending],
          ['Cobertura del filtro', `${visiblePercent.toFixed(1)}%`]
        ];

    const rows = [
      [config.excelTitle],
      [`Generado: ${new Date().toLocaleString()}`],
      [`Filtro de proyecto: ${selectedProjectLabel}`],
      [],
      ['Resumen Ejecutivo'],
      ['Indicador', 'Valor'],
      ...kpiRows,
      [],
      ['Distribucion de estatus (general)'],
      ['Estatus', 'Cantidad', 'Porcentaje'],
      ...statusDistributionRows,
      [],
      [config.excelTopSectionTitle],
      ['Proyecto', spendingMode ? 'Monto' : pendingLabel],
      ...(topProjectsRows.length ? topProjectsRows : [['Sin datos para el filtro actual', 0]])
    ];

    return rows;
  }

  async function exportPendingPurchasesToExcel() {
    const config = getActiveReportConfig();

    if (typeof ExcelJS === 'undefined') {
      alert('No se pudo cargar el motor de ExcelJS. Recarga la pagina e intenta de nuevo.');
      return;
    }

    if (!Array.isArray(currentFilteredRows) || currentFilteredRows.length === 0) {
      alert('No hay datos visibles para exportar a Excel.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const theme = getActiveTheme();
    workbook.creator = 'Purchase System';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Resumen', {
      properties: { defaultRowHeight: 18 }
    });

    summarySheet.columns = [
      { width: 56 },
      { width: 22 },
      { width: 18 },
      { width: 18 }
    ];

    summarySheet.mergeCells('A1:D1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = config.excelTitle;
    titleCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: argb(theme.excel.textLight) } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.headerBg) }
    };

    const generatedAt = new Date().toLocaleString();
    const selectedProjectLabel = projectSearchInput?.value?.trim() || 'Todos los proyectos';

    summarySheet.getCell('A2').value = `Generado: ${generatedAt}`;
    summarySheet.getCell('A3').value = `Filtro de proyecto: ${selectedProjectLabel}`;
    summarySheet.getCell('A2').font = { name: 'Calibri', size: 11 };
    summarySheet.getCell('A3').font = { name: 'Calibri', size: 11 };

    const totalPurchases = allPurchases.length;
    const totalPending = pendingPurchases.length;
    const visiblePending = currentFilteredRows.length;
    const totalSpent = pendingPurchases.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
    const visibleSpent = currentFilteredRows.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
    const pendingPercent = totalPurchases > 0 ? (totalPending / totalPurchases) * 100 : 0;
    const visiblePercent = totalPending > 0 ? (visiblePending / totalPending) * 100 : 0;

    summarySheet.getCell('A5').value = 'Resumen Ejecutivo';
    summarySheet.getCell('A5').font = { bold: true, size: 13, color: { argb: argb(theme.excel.sectionTitle) } };

    const pendingLabel = getPendingItemLabel();
    const spendingMode = isSpendingMode();
    const kpiRows = spendingMode
      ? [
          ['Total registros de gasto (proyectos activos)', totalPurchases],
          ['Gasto total', formatCurrency(totalSpent)],
          ['Ticket promedio', formatCurrency(totalPending > 0 ? (totalSpent / totalPending) : 0)],
          ['Gasto visible (filtro actual)', formatCurrency(visibleSpent)],
          ['Cobertura del filtro', `${(totalSpent > 0 ? (visibleSpent / totalSpent) * 100 : 0).toFixed(1)}%`]
        ]
      : [
          ['Total compras (proyectos activos)', totalPurchases],
          [config.excelPendingKpiLabel, totalPending],
          [`${pendingLabel} % (proyectos activos)`, `${pendingPercent.toFixed(1)}%`],
          [`${pendingLabel} visibles (filtro actual)`, visiblePending],
          ['Cobertura del filtro', `${visiblePercent.toFixed(1)}%`]
        ];

    kpiRows.forEach((item, index) => {
      const rowNumber = 6 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      summarySheet.getCell(`A${rowNumber}`).font = { bold: true };
      summarySheet.getCell(`A${rowNumber}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(theme.excel.kpiLabelBg) }
      };
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
      summarySheet.getCell(`A${rowNumber}`).border = buildExcelCellBorder(theme, 'thin');
      summarySheet.getCell(`B${rowNumber}`).border = buildExcelCellBorder(theme, 'thin');
    });
    applyExcelTableBorders(summarySheet, 6, 5 + kpiRows.length, 1, 2, theme);

    const statusStart = 13;
    summarySheet.getCell(`A${statusStart}`).value = 'Distribucion de estatus (general)';
    summarySheet.getCell(`A${statusStart}`).font = { bold: true, size: 12, color: { argb: argb(theme.excel.sectionTitle) } };
    summarySheet.getCell(`A${statusStart + 1}`).value = 'Estatus';
    summarySheet.getCell(`B${statusStart + 1}`).value = 'Cantidad';
    summarySheet.getCell(`C${statusStart + 1}`).value = 'Porcentaje';

    ['A', 'B', 'C'].forEach((col) => {
      applyHeaderCellStyle(summarySheet.getCell(`${col}${statusStart + 1}`), theme);
    });

    const statusRows = getStatusDistributionRows();
    statusRows.forEach((item, index) => {
      const rowNumber = statusStart + 2 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      summarySheet.getCell(`C${rowNumber}`).value = item[2];
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
      summarySheet.getCell(`C${rowNumber}`).alignment = { horizontal: 'right' };
    });

    if (statusRows.length > 0) {
      applyExcelTableBorders(summarySheet, statusStart + 1, statusStart + 1 + statusRows.length, 1, 3, theme);
    }

    const topProjectsRows = getTopProjectsRows(currentFilteredRows);
    const topStart = statusStart + 10;
    summarySheet.getCell(`A${topStart}`).value = config.excelTopSectionTitle;
    summarySheet.getCell(`A${topStart}`).font = { bold: true, size: 12, color: { argb: argb(theme.excel.sectionTitle) } };
    summarySheet.getCell(`A${topStart + 1}`).value = 'Proyecto';
    summarySheet.getCell(`B${topStart + 1}`).value = spendingMode ? 'Monto' : pendingLabel;

    ['A', 'B'].forEach((col) => {
      applyHeaderCellStyle(summarySheet.getCell(`${col}${topStart + 1}`), theme);
    });

    (topProjectsRows.length ? topProjectsRows : [['Sin datos para el filtro actual', 0]]).forEach((item, index) => {
      const rowNumber = topStart + 2 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
    });

    const topRowsCount = (topProjectsRows.length ? topProjectsRows : [['Sin datos para el filtro actual', 0]]).length;
    applyExcelTableBorders(summarySheet, topStart + 1, topStart + 1 + topRowsCount, 1, 2, theme);

    summarySheet.views = [{ state: 'frozen', ySplit: 5 }];

    const statusCanvas = pendingStatusChartEl;
    if (statusCanvas && statusCanvas.toDataURL) {
      const statusImageId = workbook.addImage({
        base64: statusCanvas.toDataURL('image/png'),
        extension: 'png'
      });
      summarySheet.addImage(statusImageId, {
        tl: { col: 3.15, row: 5.1 },
        ext: { width: 420, height: 240 }
      });
    }

    const topCanvas = pendingProjectsChartEl;
    if (topCanvas && topCanvas.toDataURL) {
      const topImageId = workbook.addImage({
        base64: topCanvas.toDataURL('image/png'),
        extension: 'png'
      });
      summarySheet.addImage(topImageId, {
        tl: { col: 3.15, row: 19.6 },
        ext: { width: 460, height: 260 }
      });
    }

    const detailSheet = workbook.addWorksheet('Detalle', {
      properties: { defaultRowHeight: 18 }
    });

    const detailColumns = [
      { header: 'Proyecto', key: 'project_name', width: 32 },
      { header: 'No. Proyecto', key: 'no_project', width: 16 }
    ];
    
    const showPoColumnInExcel = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';
    if (showPoColumnInExcel) {
      detailColumns.push({ header: 'No. PO', key: 'po', width: 14 });
    }
    
    detailColumns.push(
      { header: 'No. QIS', key: 'no_qis', width: 14 },
      { header: 'No. Parte', key: 'no_part', width: 18 },
      { header: 'Descripcion', key: 'description', width: 42 },
      { header: 'Proveedor', key: 'vendor_name', width: 26 },
      { header: spendingMode ? 'Monto' : 'Cantidad', key: 'quantity', width: 12 }
    );
    
    detailSheet.columns = detailColumns;

    detailSheet.getRow(1).font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
    detailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.tableHeaderBg) }
    };
    detailSheet.getRow(1).height = 22;
    
    // Aplicar estilos al encabezado solo a las primeras 8 columnas
    const numDetailColumns = detailColumns.length;
    for (let col = 1; col <= numDetailColumns; col += 1) {
      applyHeaderCellStyle(detailSheet.getRow(1).getCell(col), theme);
    }

    currentFilteredRows.forEach((row) => {
      const rowData = {
        project_name: String(row.project_name || '').trim() || '-',
        no_project: String(row.no_project || '').trim() || '-',
        no_qis: String(row.no_qis || '').trim() || '-',
        no_part: String(row.no_part || '').trim() || '-',
        description: String(row.description || '').trim() || '-',
        vendor_name: String(row.vendor_name || '').trim() || '-',
        quantity: spendingMode
          ? parseAmount(row.total_amount).toFixed(2)
          : (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : String(row.quantity ?? '-'))
      };
      
      if (showPoColumnInExcel) {
        rowData.po = String(row.po || '').trim() || '-';
      }
      
      detailSheet.addRow(rowData);
    });

    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    const quantityColumnIndex = detailColumns.length; // La cantidad siempre es la última columna
    detailSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: quantityColumnIndex }
    };

    detailSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.getCell(quantityColumnIndex).alignment = { horizontal: 'right' };
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argb(theme.excel.zebraRow) }
          };
        });
      }
    });

    const lastDetailRow = detailSheet.rowCount;
    if (lastDetailRow >= 1) {
      applyExcelTableBorders(detailSheet, 1, lastDetailRow, 1, quantityColumnIndex, theme);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fileName = `${config.excelFilePrefix}_${getExcelTimestamp()}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function exportDeadInventoryToExcel() {
    if (typeof ExcelJS === 'undefined') {
      alert('No se pudo cargar el motor de ExcelJS. Recarga la página e intenta de nuevo.');
      return;
    }

    if (!Array.isArray(allDeadInventory) || allDeadInventory.length === 0) {
      alert('No hay datos para exportar a Excel.');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const theme = getActiveTheme();
    workbook.creator = 'Purchase System';
    workbook.created = new Date();

    // Resumen sheet
    const summarySheet = workbook.addWorksheet('Resumen', {
      properties: { defaultRowHeight: 18 }
    });

    summarySheet.columns = [
      { width: 56 },
      { width: 22 },
      { width: 18 },
      { width: 18 }
    ];

    summarySheet.mergeCells('A1:D1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'Reporte de Inventario Muerto';
    titleCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: argb(theme.excel.textLight) } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.headerBg) }
    };

    const generatedAt = new Date().toLocaleString();
    summarySheet.getCell('A2').value = `Generado: ${generatedAt}`;
    summarySheet.getCell('A2').font = { name: 'Calibri', size: 11 };

    const deadCount = allDeadInventory.length;
    const deadQuantity = allDeadInventory.reduce((sum, row) => sum + (parseInt(row.available) || 0), 0);
    const deadPercent = totalItemsInStock > 0 ? ((deadCount / totalItemsInStock) * 100).toFixed(1) : 0;

    summarySheet.getCell('A4').value = 'Resumen Ejecutivo';
    summarySheet.getCell('A4').font = { bold: true, size: 13, color: { argb: argb(theme.excel.sectionTitle) } };

    const kpiRows = [
      ['Total items en stock (números de parte únicos)', totalItemsInStock],
      ['Cantidad total en stock', totalQuantityInStock],
      ['Items sin movimiento en 3 meses', deadCount],
      ['Cantidad muerta en stock', deadQuantity],
      ['% Items muertos', `${deadPercent}%`]
    ];

    kpiRows.forEach((item, index) => {
      const rowNumber = 5 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      summarySheet.getCell(`A${rowNumber}`).font = { bold: true };
      summarySheet.getCell(`A${rowNumber}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argb(theme.excel.kpiLabelBg) }
      };
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
      summarySheet.getCell(`A${rowNumber}`).border = buildExcelCellBorder(theme, 'thin');
      summarySheet.getCell(`B${rowNumber}`).border = buildExcelCellBorder(theme, 'thin');
    });
    applyExcelTableBorders(summarySheet, 5, 4 + kpiRows.length, 1, 2, theme);

    // Age distribution section
    const ageStart = 11;
    summarySheet.getCell(`A${ageStart}`).value = 'Distribución por antigüedad';
    summarySheet.getCell(`A${ageStart}`).font = { bold: true, size: 12, color: { argb: argb(theme.excel.sectionTitle) } };

    const ageData = analyzeDeadInventoryAge();
    const ageRows = [
      ['Rango de antigüedad', 'Cantidad de items']
    ];
    ageData.labels.forEach((label, idx) => {
      ageRows.push([label, ageData.data[idx]]);
    });

    ageRows.forEach((item, index) => {
      const rowNumber = ageStart + 1 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      if (index === 0) {
        summarySheet.getCell(`A${rowNumber}`).font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
        summarySheet.getCell(`B${rowNumber}`).font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
        summarySheet.getCell(`A${rowNumber}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: argb(theme.excel.tableHeaderBg) }
        };
        summarySheet.getCell(`B${rowNumber}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: argb(theme.excel.tableHeaderBg) }
        };
      }
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
    });

    summarySheet.views = [{ state: 'frozen', ySplit: 5 }];

    // Agregar gráficas como imágenes
    const ageCanvas = document.getElementById('deadInventoryAgeChart');
    if (ageCanvas && ageCanvas.toDataURL) {
      try {
        const ageImageId = workbook.addImage({
          base64: ageCanvas.toDataURL('image/png'),
          extension: 'png'
        });
        summarySheet.addImage(ageImageId, {
          tl: { col: 3.15, row: 5.1 },
          ext: { width: 340, height: 340 }
        });
      } catch (err) {
        console.warn('No se pudo agregar gráfica de antigüedad:', err);
      }
    }

    const topCanvas = document.getElementById('deadInventoryTopChart');
    if (topCanvas && topCanvas.toDataURL) {
      try {
        const topImageId = workbook.addImage({
          base64: topCanvas.toDataURL('image/png'),
          extension: 'png'
        });
        summarySheet.addImage(topImageId, {
          tl: { col: 3.15, row: 19.6 },
          ext: { width: 460, height: 260 }
        });
      } catch (err) {
        console.warn('No se pudo agregar gráfica de top items:', err);
      }
    }

    // Data sheet
    const sheet = workbook.addWorksheet('Inventario Muerto', {
      properties: { defaultRowHeight: 18 }
    });

    sheet.columns = [
      { header: 'No. Parte', key: 'no_part', width: 18 },
      { header: 'Descripcion', key: 'description', width: 42 },
      { header: 'Cantidad en Stock', key: 'available', width: 18 },
      { header: 'Último Movimiento', key: 'last_movement_date', width: 20 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.tableHeaderBg) }
    };
    sheet.getRow(1).height = 22;

    for (let col = 1; col <= 4; col += 1) {
      applyHeaderCellStyle(sheet.getRow(1).getCell(col), theme);
    }

    allDeadInventory.forEach((row) => {
      sheet.addRow({
        no_part: row.no_part || '-',
        description: row.description || '-',
        available: row.available || 0,
        last_movement_date: row.last_movement_date 
          ? new Date(row.last_movement_date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-'
      });
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 4 }
    };

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argb(theme.excel.zebraRow) }
          };
        });
      }
    });

    const lastRow = sheet.rowCount;
    if (lastRow >= 1) {
      applyExcelTableBorders(sheet, 1, lastRow, 1, 4, theme);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fileName = `reporte_inventario_muerto_${getExcelTimestamp()}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function getColumnFilters() {
    return {
      qis: normalizeText(filterQisInput?.value || ''),
      part: normalizeText(filterPartInput?.value || ''),
      description: normalizeText(filterDescriptionInput?.value || ''),
      vendor: normalizeText(filterVendorInput?.value || ''),
      quantity: normalizeText(filterQuantityInput?.value || '')
    };
  }

  function rowMatchesColumnFilters(row, filters) {
    const qis = normalizeText(row.no_qis || '');
    const part = normalizeText(row.no_part || '');
    const description = normalizeText(row.description || '');
    const vendor = normalizeText(row.vendor_name || '');
    const quantity = isSpendingMode()
      ? normalizeText(parseAmount(row.total_amount).toFixed(2))
      : normalizeText(row.quantity ?? '');

    if (filters.qis && !qis.includes(filters.qis)) return false;
    if (filters.part && !part.includes(filters.part)) return false;
    if (filters.description && !description.includes(filters.description)) return false;
    if (filters.vendor && !vendor.includes(filters.vendor)) return false;
    if (filters.quantity && !quantity.includes(filters.quantity)) return false;

    return true;
  }

  function clearColumnFilters() {
    if (filterQisInput) filterQisInput.value = '';
    if (filterPartInput) filterPartInput.value = '';
    if (filterDescriptionInput) filterDescriptionInput.value = '';
    if (filterVendorInput) filterVendorInput.value = '';
    if (filterQuantityInput) filterQuantityInput.value = '';
  }

  function closeAllFilterPopovers() {
    filterPopovers.forEach((popover) => {
      popover.hidden = true;
    });
  }

  function toggleFilterPopover(popoverId) {
    const target = document.getElementById(popoverId);
    if (!target) {
      return;
    }

    const shouldOpen = target.hidden;
    closeAllFilterPopovers();
    target.hidden = !shouldOpen;
  }

  function getUniqueProjectsCount(rows) {
    const projectSet = new Set(
      rows
        .map((row) => String(row.no_project || '').trim())
        .filter((value) => value)
    );

    return projectSet.size;
  }

  function updateKpiCards(filteredRows) {
    const config = getActiveReportConfig();

    if (isSpendingMode()) {
      const totalRows = allPurchases.length;
      const totalSpent = pendingPurchases.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
      const visibleSpent = filteredRows.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
      const averageTicket = pendingPurchases.length > 0 ? (totalSpent / pendingPurchases.length) : 0;
      const networksWithSpend = new Set(
        filteredRows
          .map((row) => String(row.network || '').trim())
          .filter((value) => value)
      ).size;

      const visiblePct = totalSpent > 0 ? (visibleSpent / totalSpent) * 100 : 0;
      const boundedVisiblePct = Math.max(0, Math.min(visiblePct, 100));

      kpiTotalPurchases.textContent = String(totalRows);
      kpiPendingQuoted.textContent = formatCurrency(totalSpent);
      kpiPendingPercent.textContent = formatCurrency(averageTicket);
      kpiProjectsWithPending.textContent = String(networksWithSpend);

      pendingPercentBar.style.width = `${boundedVisiblePct.toFixed(1)}%`;
      if (pendingPercentProgress) {
        pendingPercentProgress.setAttribute('aria-valuenow', boundedVisiblePct.toFixed(1));
      }
      pendingPercentCaption.textContent = `${toPercent(visiblePct)} del gasto visible con el filtro.`;
      return;
    }

    const totalPurchases = allPurchases.length;
    const totalPending = pendingPurchases.length;
    const visiblePending = filteredRows.length;
    const projectsWithPending = getUniqueProjectsCount(filteredRows);

    const pendingPct = totalPurchases > 0 ? (totalPending / totalPurchases) * 100 : 0;
    const visiblePct = totalPending > 0 ? (visiblePending / totalPending) * 100 : 0;
    const boundedVisiblePct = Math.max(0, Math.min(visiblePct, 100));

    kpiTotalPurchases.textContent = String(totalPurchases);
    kpiPendingQuoted.textContent = String(totalPending);
    kpiPendingPercent.textContent = toPercent(pendingPct);
    kpiProjectsWithPending.textContent = String(projectsWithPending);

    pendingPercentBar.style.width = `${boundedVisiblePct.toFixed(1)}%`;
    if (pendingPercentProgress) {
      pendingPercentProgress.setAttribute('aria-valuenow', boundedVisiblePct.toFixed(1));
    }
    pendingPercentCaption.textContent = `${toPercent(visiblePct)} de las ${config.pendingLabel} visibles con el filtro.`;
  }

  function updateStatusChart() {
    if (!pendingStatusChartEl || typeof Chart === 'undefined') {
      return;
    }

    const theme = getActiveTheme();

    const labels = ['Quoted', 'PR', 'Shopping cart', 'PO', 'Delivered', 'Otros'];
    const counts = labels.reduce((acc, label) => {
      acc[label] = 0;
      return acc;
    }, {});

    allPurchases.forEach((row) => {
      const stage = normalizeStage(row.status);
      counts[stage] = (counts[stage] || 0) + 1;
    });

    if (statusChart) {
      statusChart.destroy();
    }

    statusChart = new Chart(pendingStatusChartEl, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: labels.map((label) => counts[label]),
          backgroundColor: [
            theme.chart.quoted,
            theme.chart.pr,
            theme.chart.shopping,
            theme.chart.po,
            theme.chart.delivered,
            theme.chart.other
          ],
          borderWidth: 0
        }]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: theme.chart.legendText,
              boxWidth: 14,
              boxHeight: 14
            }
          }
        }
      }
    });
  }

  function updateProjectsChart(filteredRows) {
    if (!pendingProjectsChartEl || typeof Chart === 'undefined') {
      return;
    }

    const config = getActiveReportConfig();
    const theme = getActiveTheme();
    const spendingMode = isSpendingMode();

    const projectTotals = new Map();

    filteredRows.forEach((row) => {
      const noProject = String(row.no_project || '').trim();
      const projectName = String(row.project_name || '').trim();
      const label = noProject ? `${noProject}${projectName ? ` - ${projectName}` : ''}` : 'Sin proyecto';
      const increment = spendingMode ? parseAmount(row.total_amount) : 1;
      projectTotals.set(label, (projectTotals.get(label) || 0) + increment);
    });

    const ordered = Array.from(projectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = ordered.map((item) => item[0]);
    const values = ordered.map((item) => item[1]);

    if (projectsChart) {
      projectsChart.destroy();
    }

    projectsChart = new Chart(pendingProjectsChartEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: config.projectsDatasetLabel,
          data: values,
          backgroundColor: theme.chart.projectsBar,
          borderRadius: 6,
          maxBarThickness: 32
        }]
      },
      options: {
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              color: theme.chart.ticks,
              precision: spendingMode ? 2 : 0,
              callback: (value) => spendingMode ? `$${Number(value).toFixed(0)}` : value
            },
            grid: { color: theme.chart.gridMajor }
          },
          y: {
            ticks: { color: theme.chart.ticks },
            grid: { color: theme.chart.gridMinor }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  function applyProjectFilter() {
    const searchTerm = normalizeText(projectSearchInput.value.trim());
    const selectedNoProject = normalizeText(projectSearchInput.dataset.noProject || '');
    const columnFilters = getColumnFilters();
    const spendingMode = isSpendingMode();

    const filteredRows = pendingPurchases.filter((row) => {
      const noProject = normalizeText(row.no_project);
      const projectName = normalizeText(row.project_name);
      const network = normalizeText(row.network);

      const matchesProject = selectedNoProject
        ? noProject === selectedNoProject
        : (!searchTerm || noProject.includes(searchTerm) || projectName.includes(searchTerm) || (spendingMode && network.includes(searchTerm)));
      const matchesColumns = rowMatchesColumnFilters(row, columnFilters);

      return matchesProject && matchesColumns;
    });

    renderPendingRows(filteredRows);
    updateMeta(pendingPurchases.length, filteredRows.length, searchTerm);
    updateKpiCards(filteredRows);
    updateProjectsChart(filteredRows);
  }

  async function loadPendingPurchasesReport() {
    const config = getActiveReportConfig();
    const showPoColumn = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';
    const colspan = showPoColumn ? 8 : 7;

    pendingMeta.textContent = config.loadingMessage;
    pendingTableBody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center">Cargando datos...</td>
      </tr>
    `;

    try {
      if (!Array.isArray(allProjects) || allProjects.length === 0) {
        await loadAllProjects();
      }

      const response = await fetch(`${BASE}/purchases`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Error al consultar compras');
      }

      const rows = Array.isArray(data) ? data : [];
      const activeProjectKeys = buildActiveProjectKeySet(allProjects);
      const activePurchases = rows.filter((row) => isPurchaseFromActiveProject(row, activeProjectKeys));
      allPurchases = activePurchases;
      
      if (activeReportType === 'po-closed') {
        pendingPurchases = filterClosedPOs(activePurchases);
      } else {
        pendingPurchases = activePurchases.filter((row) => config.statusFilter(row.status));
      }
      
      clearColumnFilters();

      applyProjectFilter();
      updateStatusChart();
    } catch (error) {
      const showPoColumn = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';
      const colspan = showPoColumn ? 8 : 7;
      allPurchases = [];
      pendingPurchases = [];
      pendingMeta.textContent = config.errorMeta;
      pendingTableBody.innerHTML = `
        <tr>
          <td colspan="${colspan}" class="text-center text-danger">${config.errorTable}</td>
        </tr>
      `;

      updateKpiCards([]);
      updateProjectsChart([]);
      updateStatusChart();
    }
  }

  let allDeadInventory = [];
  let totalItemsInStock = 0;
  let totalQuantityInStock = 0;
  let deadInventoryAgeChart = null;
  let deadInventoryTopChart = null;

  async function loadDeadInventoryReport() {
    deadInventoryMeta.textContent = 'Cargando inventario muerto...';
    deadInventoryTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">Cargando datos...</td>
      </tr>
    `;

    try {
      const response = await fetch(`${BASE}/dead-inventory`);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error('Error al cargar inventario muerto');
      }

      allDeadInventory = Array.isArray(responseData.deadInventory) ? responseData.deadInventory : [];
      totalItemsInStock = responseData.totalItems || 0;
      totalQuantityInStock = responseData.totalQuantity || 0;

      if (allDeadInventory.length === 0) {
        deadInventoryMeta.textContent = 'No se encontraron items con inventario muerto.';
        document.getElementById('deadInventoryKpiTotal').textContent = totalItemsInStock.toLocaleString('es-ES') || '0';
        document.getElementById('deadInventoryKpiDead').textContent = '0';
        document.getElementById('deadInventoryKpiPercent').textContent = '0.0%';
        document.getElementById('deadInventoryKpiQuantity').textContent = '0';
        document.getElementById('deadInventoryPercentBar').style.width = '0%';
        document.getElementById('deadInventoryPercentProgress').setAttribute('aria-valuenow', '0');
        document.getElementById('deadInventoryPercentCaption').textContent = '0% del inventario sin movimiento en 3 meses.';
        deadInventoryTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center">No hay inventario muerto en estos momentos.</td>
          </tr>
        `;
        destroyDeadInventoryCharts();
        return;
      }

      updateDeadInventoryDisplay();
      setupDeadInventorySearch();
      renderDeadInventoryCharts();
    } catch (error) {
      console.error('Error:', error);
      deadInventoryMeta.textContent = 'No fue posible cargar el reporte de inventario muerto.';
      deadInventoryTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger">Error al cargar datos</td>
        </tr>
      `;
    }
  }

  function updateDeadInventoryDisplay(filteredRows = null) {
    const rowsToDisplay = filteredRows || allDeadInventory;
    const deadCount = allDeadInventory.length;
    const deadPercent = totalItemsInStock > 0 ? ((deadCount / totalItemsInStock) * 100).toFixed(1) : 0;
    const deadQuantity = allDeadInventory.reduce((sum, row) => sum + (parseInt(row.available) || 0), 0);

    deadInventoryMeta.textContent = `Total de items sin movimiento en 3 meses: ${deadCount}`;
    document.getElementById('deadInventoryKpiTotal').textContent = totalItemsInStock.toLocaleString('es-ES');
    document.getElementById('deadInventoryKpiDead').textContent = deadCount.toLocaleString('es-ES');
    document.getElementById('deadInventoryKpiPercent').textContent = `${deadPercent}%`;
    document.getElementById('deadInventoryKpiQuantity').textContent = deadQuantity.toLocaleString('es-ES');

    const percentBar = document.getElementById('deadInventoryPercentBar');
    percentBar.style.width = `${deadPercent}%`;
    document.getElementById('deadInventoryPercentProgress').setAttribute('aria-valuenow', deadPercent);
    document.getElementById('deadInventoryPercentCaption').textContent = `${deadPercent}% del inventario (${deadCount} de ${totalItemsInStock} items) sin movimiento en 3 meses.`;

    deadInventoryTableBody.innerHTML = rowsToDisplay
      .map((row) => {
        const partValue = escapeHtml(row.no_part || '-');
        const descriptionValue = escapeHtml(row.description || '-');
        const quantityValue = escapeHtml(row.available ?? '-');
        const lastMovementValue = row.last_movement_date 
          ? new Date(row.last_movement_date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';

        return `
          <tr>
            <td>${partValue}</td>
            <td>${descriptionValue}</td>
            <td class="text-end">${quantityValue}</td>
            <td>${lastMovementValue}</td>
          </tr>
        `;
      })
      .join('');
  }

  function setupDeadInventorySearch() {
    const searchInput = document.getElementById('deadInventorySearch');
    if (!searchInput) return;

    searchInput.removeEventListener('input', handleDeadInventorySearch);
    searchInput.addEventListener('input', handleDeadInventorySearch);
  }

  function handleDeadInventorySearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    let filtered = allDeadInventory;

    if (searchTerm) {
      filtered = allDeadInventory.filter((row) =>
        (row.no_part || '').toLowerCase().includes(searchTerm) ||
        (row.description || '').toLowerCase().includes(searchTerm)
      );
    }

    updateDeadInventoryDisplay(filtered);
  }

  function renderDeadInventoryCharts() {
    destroyDeadInventoryCharts();

    // Age distribution chart
    const ageData = analyzeDeadInventoryAge();
    const ageCanvasEl = document.getElementById('deadInventoryAgeChart');
    if (ageCanvasEl) {
      const ageCtx = ageCanvasEl.getContext('2d');
      deadInventoryAgeChart = new Chart(ageCtx, {
        type: 'doughnut',
        data: {
          labels: ageData.labels,
          datasets: [{
            label: 'Items por antigüedad',
            data: ageData.data,
            backgroundColor: ['#4285F4', '#34A853', '#FBBC04', '#EA4335'],
            borderColor: '#fff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 12 }, usePointStyle: true, padding: 15 } }
          }
        }
      });
    }

    // Top 10 items chart
    const topData = getTopDeadInventoryItems();
    const topCanvasEl = document.getElementById('deadInventoryTopChart');
    if (topCanvasEl) {
      const topCtx = topCanvasEl.getContext('2d');
      deadInventoryTopChart = new Chart(topCtx, {
        type: 'bar',
        data: {
          labels: topData.labels,
          datasets: [{
            label: 'Cantidad en stock',
            data: topData.data,
            backgroundColor: '#4285F4',
            borderColor: '#1e40af',
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true } }
        }
      });
    }
  }

  function analyzeDeadInventoryAge() {
    const now = new Date();
    const ranges = {
      '3-6 meses': { min: 90, max: 180, count: 0 },
      '6-12 meses': { min: 180, max: 365, count: 0 },
      '1-2 años': { min: 365, max: 730, count: 0 },
      '2+ años': { min: 730, max: Infinity, count: 0 }
    };

    allDeadInventory.forEach((row) => {
      if (!row.last_movement_date) return;
      const lastMove = new Date(row.last_movement_date);
      const days = Math.floor((now - lastMove) / (1000 * 60 * 60 * 24));

      for (const [range, bounds] of Object.entries(ranges)) {
        if (days >= bounds.min && days < bounds.max) {
          bounds.count++;
          break;
        }
      }
    });

    return {
      labels: Object.keys(ranges),
      data: Object.values(ranges).map(r => r.count)
    };
  }

  function getTopDeadInventoryItems() {
    const sorted = [...allDeadInventory]
      .sort((a, b) => (b.available || 0) - (a.available || 0))
      .slice(0, 10);

    return {
      labels: sorted.map(row => row.no_part || 'N/A'),
      data: sorted.map(row => row.available || 0)
    };
  }

  function destroyDeadInventoryCharts() {
    if (deadInventoryAgeChart) {
      deadInventoryAgeChart.destroy();
      deadInventoryAgeChart = null;
    }
    if (deadInventoryTopChart) {
      deadInventoryTopChart.destroy();
      deadInventoryTopChart = null;
    }
  }

  function updateReportView() {
    const selectedReport = reportTypeMenu.value;

    if (selectedReport === 'spending' || selectedReport === 'pending-purchases' || selectedReport === 'po-pending-delivery' || selectedReport === 'po-closed') {
      activeReportType = selectedReport;
      applyReportModeUI();
      pendingPanel.hidden = false;
      deadInventoryPanel.hidden = true;
      genericPanel.hidden = true;
      loadPendingPurchasesReport();
      return;
    }

    if (selectedReport === 'dead-inventory') {
      pendingPanel.hidden = true;
      deadInventoryPanel.hidden = false;
      genericPanel.hidden = true;
      loadDeadInventoryReport();
      return;
    }

    pendingPanel.hidden = true;
    deadInventoryPanel.hidden = true;
    genericPanel.hidden = false;
    genericMessage.textContent = 'Este tipo de reporte se encuentra en desarrollo.';
  }

  reportTypeMenu.addEventListener('change', updateReportView);

  projectSearchInput.addEventListener('input', () => {
    delete projectSearchInput.dataset.noProject;
    renderProjectSuggestions(projectSearchInput.value.trim());
    applyProjectFilter();
  });

  [
    filterQisInput,
    filterPartInput,
    filterDescriptionInput,
    filterVendorInput,
    filterQuantityInput
  ].forEach((input) => {
    if (!input) {
      return;
    }

    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, applyProjectFilter);
  });

  filterTriggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const popoverId = trigger.getAttribute('data-filter-target');
      toggleFilterPopover(popoverId);
    });
  });

  filterPopovers.forEach((popover) => {
    popover.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  });

  document.addEventListener('click', () => {
    closeAllFilterPopovers();
    if (projectSuggestions) {
      projectSuggestions.style.display = 'none';
    }
  });

  if (projectSuggestions) {
    projectSuggestions.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }

  if (projectSearchInput) {
    projectSearchInput.addEventListener('click', (event) => {
      event.stopPropagation();
      renderProjectSuggestions(projectSearchInput.value.trim());
    });
  }

  if (reportThemeSelect) {
    reportThemeSelect.addEventListener('change', () => {
      applyReportTheme(reportThemeSelect.value);
    });
  }

  const deadInventoryThemeSelect = document.getElementById('deadInventoryThemeSelect');
  if (deadInventoryThemeSelect) {
    deadInventoryThemeSelect.addEventListener('change', () => {
      applyReportTheme(deadInventoryThemeSelect.value);
    });
  }

  printButton.addEventListener('click', async () => {
    if (reportTypeMenu.value === 'spending' || reportTypeMenu.value === 'pending-purchases' || reportTypeMenu.value === 'po-pending-delivery' || reportTypeMenu.value === 'po-closed') {
      await exportPendingPurchasesToExcel();
      return;
    }

    if (reportTypeMenu.value === 'dead-inventory') {
      await exportDeadInventoryToExcel();
      return;
    }

    window.print();
  });

  applyReportTheme(reportThemeSelect?.value || 'silver');
  loadAllProjects().finally(updateReportView);
});
