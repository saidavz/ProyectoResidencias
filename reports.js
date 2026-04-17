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
      pendingLabel: 'expense records',
      kpiPendingLabel: 'Total Expense',
      kpiPercentLabel: 'Average Ticket',
      kpiProjectsLabel: 'Networks with Expense',
      topProjectsTitle: 'Top Projects by Expense',
      projectsDatasetLabel: 'Spent Amount',
      loadingMessage: 'Loading expense report...',
      emptyMessage: 'No expense records were found for the applied filter.',
      errorMeta: 'Unable to load the expense report.',
      errorTable: 'Error loading expense report data.',
      excelTitle: 'Expense Report',
      excelPendingKpiLabel: 'Total Expense',
      excelTopSectionTitle: 'Top projects by expense (current filter)',
      excelFilePrefix: 'expense_report',
      statusFilter: () => true
    },
    'pending-purchases': {
      pendingLabel: 'pending purchases (Quoted)',
      kpiPendingLabel: 'Pending Quotes',
      kpiPercentLabel: '% Pending (Quoted)',
      kpiProjectsLabel: 'Projects with Pending Purchases',
      topProjectsTitle: 'Top Projects with Pending Purchases',
      projectsDatasetLabel: 'Pending Purchases',
      loadingMessage: 'Loading pending purchases...',
      emptyMessage: 'No pending purchases were found for the searched project.',
      errorMeta: 'Unable to load the pending purchases report.',
      errorTable: 'Error loading pending purchases data.',
      excelTitle: 'Pending Purchases Report',
      excelPendingKpiLabel: 'Pending Purchases (Quoted)',
      excelTopSectionTitle: 'Top projects with pending purchases (current filter)',
      excelFilePrefix: 'pending_purchases_report',
      statusFilter: (status) => isQuotedStatus(status)
    },
    'po-pending-delivery': {
      pendingLabel: 'pending purchase orders (Pending Delivery)',
      kpiPendingLabel: 'Pending Delivery',
      kpiPercentLabel: '% Pending (Delivery)',
      kpiProjectsLabel: 'Projects with Pending Delivery',
      topProjectsTitle: 'Top Projects with Pending Delivery',
      projectsDatasetLabel: 'Pending Delivery',
      loadingMessage: 'Loading pending delivery purchase orders...',
      emptyMessage: 'No pending delivery orders were found for the searched project.',
      errorMeta: 'Unable to load the pending delivery report.',
      errorTable: 'Error loading pending delivery data.',
      excelTitle: 'Pending Delivery POs Report',
      excelPendingKpiLabel: 'Pending Delivery Purchase Orders',
      excelTopSectionTitle: 'Top projects with pending delivery (current filter)',
      excelFilePrefix: 'pending_delivery_pos_report',
      statusFilter: (status) => isPendingDeliveryStatus(status)
    },
    'po-closed': {
      pendingLabel: 'closed POs (Delivered)',
      kpiPendingLabel: 'Closed POs',
      kpiPercentLabel: '% Closed',
      kpiProjectsLabel: 'Projects with Closed POs',
      topProjectsTitle: 'Top Projects with Closed POs',
      projectsDatasetLabel: 'Closed POs',
      loadingMessage: 'Loading closed POs...',
      emptyMessage: 'No closed POs were found for the searched project.',
      errorMeta: 'Unable to load the closed POs report.',
      errorTable: 'Error loading closed POs data.',
      excelTitle: 'Closed POs Report',
      excelPendingKpiLabel: 'Closed POs (Delivered)',
      excelTopSectionTitle: 'Top projects with closed POs (current filter)',
      excelFilePrefix: 'closed_pos_report',
      statusFilter: (status) => isDeliveredStatus(status)
    }
  });

  const REPORT_THEMES = Object.freeze({
    silver: {
      cssVars: {
        '--report-header-from': '#123A67',
        '--report-header-to': '#1F6DB5',
        '--report-header-text': '#FFFFFF',
        '--report-card-from': '#B6D8FF',
        '--report-card-to': '#82B8F5',
        '--report-card-accent': '#006FD6',
        '--report-chart-card': '#FFFFFF',
        '--report-progress-from': '#0E74C8',
        '--report-progress-to': '#FF9F1C',
        '--report-filter-btn-from': '#FF9F1C',
        '--report-filter-btn-to': '#E07A00',
        '--report-filter-btn-hover-from': '#FFB347',
        '--report-filter-btn-hover-to': '#FF9F1C',
        '--report-toolbar-from': '#EEF5FF',
        '--report-toolbar-to': '#DDEBFF',
        '--report-toolbar-border': '#4F8AC5',
        '--report-label-color': '#1F2937',
        '--report-field-bg': '#FFFFFF',
        '--report-field-text': '#2F3E4D',
        '--report-field-border': '#B9CCE4',
        '--report-field-focus': '#0E74C8',
        '--report-field-focus-ring': 'rgba(14, 116, 200, 0.25)',
        '--report-print-text': '#111827',
        '--report-panel-from': '#F4F9FF',
        '--report-panel-to': '#EAF2FF',
        '--report-panel-border': '#6EA4D8',
        '--report-panel-shadow': 'rgba(14, 116, 200, 0.14)',
        '--report-meta-text': '#5F6E7D',
        '--report-kpi-label-text': '#334155',
        '--report-kpi-value-text': '#0F172A',
        '--report-kpi-emphasis-glow': 'rgba(0, 111, 214, 0.46)',
        '--report-percent-strip-bg': '#FFFFFF',
        '--report-percent-strip-border': '#5E96CD',
        '--report-percent-title': '#2F3E4D',
        '--report-progress-bg': '#DFEBF8',
        '--report-percent-caption': '#6B7C8D',
        '--report-chart-title': '#2F3E4D',
        '--report-chart-border': '#6EA4D8',
        '--report-table-border': '#C3D7EF',
        '--report-table-text': '#2F3E4D',
        '--report-row-hover': 'rgba(14, 116, 200, 0.12)',
        '--report-popover-bg': '#FFFFFF',
        '--report-popover-border': '#BFD3EB',
        '--report-popover-input-bg': '#F4F9FF',
        '--report-popover-input-border': '#BDD1E9',
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
        quoted: '#0E74C8',
        pr: '#123A67',
        shopping: '#FF9F1C',
        po: '#FFB347',
        delivered: '#2BB673',
        other: '#7C8FA1',
        projectsBar: '#0E74C8',
        legendText: '#2F3E4D',
        ticks: '#2F3E4D',
        gridMajor: 'rgba(14, 116, 200, 0.22)',
        gridMinor: 'rgba(14, 116, 200, 0.12)'
      }
    },
    ocean: {
      cssVars: {
        '--report-header-from': '#111111',
        '--report-header-to': '#3A3A3A',
        '--report-header-text': '#FFFFFF',
        '--report-card-from': '#5C5C5C',
        '--report-card-to': '#232323',
        '--report-card-accent': '#D32F2F',
        '--report-chart-card': '#FFFFFF',
        '--report-progress-from': '#2F2F2F',
        '--report-progress-to': '#D32F2F',
        '--report-filter-btn-from': '#4A4A4A',
        '--report-filter-btn-to': '#1F1F1F',
        '--report-filter-btn-hover-from': '#616161',
        '--report-filter-btn-hover-to': '#333333',
        '--report-toolbar-from': '#F5F5F5',
        '--report-toolbar-to': '#E4E4E4',
        '--report-toolbar-border': '#8A8A8A',
        '--report-label-color': '#1A1A1A',
        '--report-field-bg': '#FFFFFF',
        '--report-field-text': '#1F1F1F',
        '--report-field-border': '#8D8D8D',
        '--report-field-focus': '#D32F2F',
        '--report-field-focus-ring': 'rgba(211, 47, 47, 0.24)',
        '--report-print-text': '#111827',
        '--report-panel-from': '#F8F8F8',
        '--report-panel-to': '#ECECEC',
        '--report-panel-border': '#8D8D8D',
        '--report-panel-shadow': 'rgba(0, 0, 0, 0.2)',
        '--report-meta-text': '#4E4E4E',
        '--report-kpi-label-text': '#F2F2F2',
        '--report-kpi-value-text': '#FFFFFF',
        '--report-kpi-emphasis-glow': 'rgba(211, 47, 47, 0.4)',
        '--report-percent-strip-bg': '#FFFFFF',
        '--report-percent-strip-border': '#8D8D8D',
        '--report-percent-title': '#1F1F1F',
        '--report-progress-bg': '#DADADA',
        '--report-percent-caption': '#4E4E4E',
        '--report-chart-title': '#1F1F1F',
        '--report-chart-border': '#8D8D8D',
        '--report-table-border': '#8D8D8D',
        '--report-table-text': '#1F1F1F',
        '--report-row-hover': 'rgba(211, 47, 47, 0.12)',
        '--report-popover-bg': '#FFFFFF',
        '--report-popover-border': '#8D8D8D',
        '--report-popover-input-bg': '#F8F8F8',
        '--report-popover-input-border': '#8D8D8D',
        '--report-popover-input-text': '#1F1F1F',
        '--report-popover-input-placeholder': '#666666',
        '--report-placeholder-text': '#555555'
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
        quoted: '#D32F2F',
        pr: '#111111',
        shopping: '#4A4A4A',
        po: '#8D8D8D',
        delivered: '#F3F3F3',
        other: '#6E6E6E',
        projectsBar: '#D32F2F',
        legendText: '#1F1F1F',
        ticks: '#1F1F1F',
        gridMajor: 'rgba(31, 31, 31, 0.22)',
        gridMinor: 'rgba(211, 47, 47, 0.12)'
      }
    },
    carbon: {
      cssVars: {
        '--report-header-from': '#0F172A',
        '--report-header-to': '#312E81',
        '--report-header-text': '#E5E7EB',
        '--report-card-from': '#2B3550',
        '--report-card-to': '#161D2F',
        '--report-card-accent': '#7B61FF',
        '--report-chart-card': '#FFFFFF',
        '--report-progress-from': '#4338CA',
        '--report-progress-to': '#06B6D4',
        '--report-filter-btn-from': '#4F46E5',
        '--report-filter-btn-to': '#7C3AED',
        '--report-filter-btn-hover-from': '#22D3EE',
        '--report-filter-btn-hover-to': '#4F46E5',
        '--report-toolbar-from': '#EEF2FF',
        '--report-toolbar-to': '#E2E8F8',
        '--report-toolbar-border': '#BAC7E8',
        '--report-label-color': '#111827',
        '--report-field-bg': '#FFFFFF',
        '--report-field-text': '#111827',
        '--report-field-border': '#9FB0D6',
        '--report-field-focus': '#4F46E5',
        '--report-field-focus-ring': 'rgba(79, 70, 229, 0.24)',
        '--report-print-text': '#111827',
        '--report-panel-from': '#EEF2FF',
        '--report-panel-to': '#E3E8FA',
        '--report-panel-border': '#B9C6E6',
        '--report-panel-shadow': 'rgba(79, 70, 229, 0.16)',
        '--report-meta-text': '#475569',
        '--report-kpi-label-text': '#C9D7F5',
        '--report-kpi-value-text': '#F8FAFC',
        '--report-kpi-emphasis-glow': 'rgba(123, 97, 255, 0.45)',
        '--report-percent-strip-bg': '#FFFFFF',
        '--report-percent-strip-border': '#B8C6E6',
        '--report-percent-title': '#0F172A',
        '--report-progress-bg': '#DBE3F8',
        '--report-percent-caption': '#475569',
        '--report-chart-title': '#0F172A',
        '--report-chart-border': '#B8C6E6',
        '--report-table-border': '#B8C6E6',
        '--report-table-text': '#111827',
        '--report-row-hover': 'rgba(79, 70, 229, 0.12)',
        '--report-popover-bg': '#FFFFFF',
        '--report-popover-border': '#B8C6E6',
        '--report-popover-input-bg': '#FFFFFF',
        '--report-popover-input-border': '#B8C6E6',
        '--report-popover-input-text': '#111827',
        '--report-popover-input-placeholder': '#64748B',
        '--report-placeholder-text': '#475569'
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
        quoted: '#4F46E5',
        pr: '#7C3AED',
        shopping: '#06B6D4',
        po: '#F59E0B',
        delivered: '#10B981',
        other: '#8B5CF6',
        projectsBar: '#4338CA',
        legendText: '#1F2937',
        ticks: '#334155',
        gridMajor: 'rgba(79, 70, 229, 0.2)',
        gridMinor: 'rgba(6, 182, 212, 0.16)'
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
    if (value === null || value === undefined) {
      return 0;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }

    const normalized = String(value)
      .trim()
      .replace(/\$/g, '')
      .replace(/,/g, '');

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function formatCurrency(value) {
    const amount = parseAmount(value);
    return `$${amount.toFixed(2)}`;
  }

  function filterClosedPOs(rows) {
    // Group by PO number
    const poMap = new Map();
    
    rows.forEach((row) => {
      const poNumber = row.po || '';
      if (!poNumber) return; // Ignore items without a PO
      
      if (!poMap.has(poNumber)) {
        poMap.set(poNumber, []);
      }
      poMap.get(poNumber).push(row);
    });

    // Return only one representative item per PO where ALL items are delivered
    const closedPOs = [];
    poMap.forEach((items, poNumber) => {
      const allDelivered = items.every((item) => isDeliveredStatus(item.status));
      
      if (allDelivered) {
        // Use the first item as the PO representative
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
      searchLabel.textContent = isSpending ? 'Search project or network' : 'Search project';
    }

    const quantityHeader = filterQuantityInput?.closest('th')?.querySelector('span');
    if (quantityHeader) {
      quantityHeader.textContent = isSpending ? 'Amount' : 'Quantity';
    }
    if (filterQuantityInput) {
      filterQuantityInput.placeholder = isSpending ? 'Search amount' : 'Search quantity';
    }
    
    // Show/hide PO column
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

    const spendingMode = isSpendingMode();
    
    // Filter projects
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

    // Add projects to suggestions
    filtered.forEach((project) => {
      const item = document.createElement('div');
      item.className = 'reports-project-suggestion-item';
      item.textContent = `${project.no_project} - ${project.name_project || ''}`;
      item.addEventListener('click', () => {
        projectSearchInput.value = `${project.no_project} - ${project.name_project || ''}`;
        projectSearchInput.dataset.noProject = String(project.no_project || '').trim();
        projectSearchInput.dataset.network = '';
        projectSuggestions.style.display = 'none';
        applyProjectFilter();
      });
      projectSuggestions.appendChild(item);
    });

    // For spending mode, also search by network
    let networks = new Set();
    if (spendingMode) {
      networks = new Set(
        pendingPurchases
          .map(row => normalizeText(row.network || ''))
          .filter(net => net && net.includes(term) && net !== 'sin asignar')
      );

      // Add network suggestions
      networks.forEach((network) => {
        const item = document.createElement('div');
        item.className = 'reports-project-suggestion-item';
        item.textContent = `Network: ${network}`;
        item.addEventListener('click', () => {
          projectSearchInput.value = `Network: ${network}`;
          projectSearchInput.dataset.noProject = '';
          projectSearchInput.dataset.network = network;
          projectSuggestions.style.display = 'none';
          applyProjectFilter();
        });
        projectSuggestions.appendChild(item);
      });
    }

    projectSuggestions.style.display = (filtered.length > 0 || networks.size > 0) ? 'block' : 'none';
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
      const label = noProject ? `${noProject}${projectName ? ` - ${projectName}` : ''}` : 'No project';
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
    const selectedProjectLabel = projectSearchInput?.value?.trim() || 'All projects';
    const pendingLabel = getPendingItemLabel();
    const spendingMode = isSpendingMode();

    const statusDistributionRows = getStatusDistributionRows();
    const topProjectsRows = getTopProjectsRows(currentFilteredRows);

    const kpiRows = spendingMode
      ? [
          ['Total expense records (active projects)', totalPurchases],
          ['Total expense', formatCurrency(totalSpent)],
          ['Average ticket', formatCurrency(totalPending > 0 ? (totalSpent / totalPending) : 0)],
          ['Visible expense (current filter)', formatCurrency(visibleSpent)],
          ['Filter coverage', `${(totalSpent > 0 ? (visibleSpent / totalSpent) * 100 : 0).toFixed(1)}%`]
        ]
      : [
          ['Total purchases (active projects)', totalPurchases],
          [config.excelPendingKpiLabel, totalPending],
          [`${pendingLabel} % (active projects)`, `${pendingPercent.toFixed(1)}%`],
          [`Visible ${pendingLabel}`, visiblePending],
          ['Filter coverage', `${visiblePercent.toFixed(1)}%`]
        ];

    const rows = [
      [config.excelTitle],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Filter: ${selectedProjectLabel}`],
      [],
      ['Executive Summary'],
      ['Metric', 'Value'],
      ...kpiRows,
      [],
      ['Status Distribution (overall)'],
      ['Status', 'Count', 'Percentage'],
      ...statusDistributionRows,
      [],
      [config.excelTopSectionTitle],
      ['Project', spendingMode ? 'Amount' : pendingLabel],
      ...(topProjectsRows.length ? topProjectsRows : [['No data for the current filter', 0]])
    ];

    return rows;
  }

  async function exportPendingPurchasesToExcel() {
    const config = getActiveReportConfig();

    if (typeof ExcelJS === 'undefined') {
      alert('Could not load the ExcelJS engine. Refresh the page and try again.');
      return;
    }

    if (!Array.isArray(currentFilteredRows) || currentFilteredRows.length === 0) {
      alert('No visible data to export to Excel.');
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
    const selectedProjectLabel = projectSearchInput?.value?.trim() || 'All projects';

    summarySheet.getCell('A2').value = `Generated: ${generatedAt}`;
    summarySheet.getCell('A3').value = `Filter: ${selectedProjectLabel}`;
    summarySheet.getCell('A2').font = { name: 'Calibri', size: 11 };
    summarySheet.getCell('A3').font = { name: 'Calibri', size: 11 };

    const totalPurchases = allPurchases.length;
    const totalPending = pendingPurchases.length;
    const visiblePending = currentFilteredRows.length;
    const totalSpent = pendingPurchases.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
    const visibleSpent = currentFilteredRows.reduce((sum, row) => sum + parseAmount(row.total_amount), 0);
    const pendingPercent = totalPurchases > 0 ? (totalPending / totalPurchases) * 100 : 0;
    const visiblePercent = totalPending > 0 ? (visiblePending / totalPending) * 100 : 0;

    summarySheet.getCell('A5').value = 'Executive Summary';
    summarySheet.getCell('A5').font = { bold: true, size: 13, color: { argb: argb(theme.excel.sectionTitle) } };

    const pendingLabel = getPendingItemLabel();
    const spendingMode = isSpendingMode();
    const kpiRows = spendingMode
      ? [
          ['Total expense records (active projects)', totalPurchases],
          ['Total expense', formatCurrency(totalSpent)],
          ['Average ticket', formatCurrency(totalPending > 0 ? (totalSpent / totalPending) : 0)],
          ['Visible expense (current filter)', formatCurrency(visibleSpent)],
          ['Filter coverage', `${(totalSpent > 0 ? (visibleSpent / totalSpent) * 100 : 0).toFixed(1)}%`]
        ]
      : [
          ['Total purchases (active projects)', totalPurchases],
          [config.excelPendingKpiLabel, totalPending],
          [`${pendingLabel} % (active projects)`, `${pendingPercent.toFixed(1)}%`],
          [`Visible ${pendingLabel}`, visiblePending],
          ['Filter coverage', `${visiblePercent.toFixed(1)}%`]
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
    summarySheet.getCell(`A${statusStart}`).value = 'Status Distribution (overall)';
    summarySheet.getCell(`A${statusStart}`).font = { bold: true, size: 12, color: { argb: argb(theme.excel.sectionTitle) } };
    summarySheet.getCell(`A${statusStart + 1}`).value = 'Status';
    summarySheet.getCell(`B${statusStart + 1}`).value = 'Count';
    summarySheet.getCell(`C${statusStart + 1}`).value = 'Percentage';

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
    summarySheet.getCell(`A${topStart + 1}`).value = 'Project';
    summarySheet.getCell(`B${topStart + 1}`).value = spendingMode ? 'Amount' : pendingLabel;

    ['A', 'B'].forEach((col) => {
      applyHeaderCellStyle(summarySheet.getCell(`${col}${topStart + 1}`), theme);
    });

    (topProjectsRows.length ? topProjectsRows : [['No data for the current filter', 0]]).forEach((item, index) => {
      const rowNumber = topStart + 2 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
    });

    const topRowsCount = (topProjectsRows.length ? topProjectsRows : [['No data for the current filter', 0]]).length;
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
      { header: 'Project', key: 'project_name', width: 32 },
      { header: 'Project No.', key: 'no_project', width: 16 }
    ];
    
    const showPoColumnInExcel = activeReportType === 'po-closed' || activeReportType === 'po-pending-delivery';
    if (showPoColumnInExcel) {
      detailColumns.push({ header: 'PO No.', key: 'po', width: 14 });
    }
    
    detailColumns.push(
      { header: 'QIS No.', key: 'no_qis', width: 14 },
      { header: 'Part No.', key: 'no_part', width: 18 },
      { header: 'Description', key: 'description', width: 42 },
      { header: 'Vendor', key: 'vendor_name', width: 26 },
      { header: spendingMode ? 'Amount' : 'Quantity', key: 'quantity', width: 12 }
    );
    
    detailSheet.columns = detailColumns;

    detailSheet.getRow(1).font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
    detailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.tableHeaderBg) }
    };
    detailSheet.getRow(1).height = 22;
    
    // Apply header styles only to the first 8 columns
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
    
    const quantityColumnIndex = detailColumns.length; // Quantity is always the last column
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
      alert('Could not load the ExcelJS engine. Refresh the page and try again.');
      return;
    }

    if (!Array.isArray(allDeadInventory) || allDeadInventory.length === 0) {
      alert('No data available to export to Excel.');
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
    titleCell.value = 'Dead Inventory Report';
    titleCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: argb(theme.excel.textLight) } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.headerBg) }
    };

    const generatedAt = new Date().toLocaleString();
    summarySheet.getCell('A2').value = `Generated: ${generatedAt}`;
    summarySheet.getCell('A2').font = { name: 'Calibri', size: 11 };

    const deadCount = allDeadInventory.length;
    const deadQuantity = allDeadInventory.reduce((sum, row) => sum + (parseInt(row.available) || 0), 0);
    const deadPercent = totalItemsInStock > 0 ? ((deadCount / totalItemsInStock) * 100).toFixed(1) : 0;
    const moneyLockedInDeadStock = allDeadInventory.reduce((sum, row) => {
      const quantity = parseInt(row.available) || 0;
      const unitCost = parseAmount(row.unit_cost || row.cost || row.price_unit || 0);
      return sum + (quantity * unitCost);
    }, 0);

    summarySheet.getCell('A4').value = 'Executive Summary';
    summarySheet.getCell('A4').font = { bold: true, size: 13, color: { argb: argb(theme.excel.sectionTitle) } };

    const kpiRows = [
      ['Total items in stock (unique part numbers)', totalItemsInStock],
      ['Total quantity in stock', totalQuantityInStock],
      ['Items without movement in 3 months', deadCount],
      ['Dead stock quantity', deadQuantity],
      ['% Dead items', `${deadPercent}%`],
      ['Money locked in dead stock', moneyLockedInDeadStock]
    ];

    kpiRows.forEach((item, index) => {
      const rowNumber = 5 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      
      // Format currency values for money-related KPIs
      if (item[0].toLowerCase().includes('cost') || item[0].toLowerCase().includes('value') || item[0].toLowerCase().includes('money')) {
        summarySheet.getCell(`B${rowNumber}`).value = item[1];
        summarySheet.getCell(`B${rowNumber}`).numFmt = '"$"#,##0.00';
      } else {
        summarySheet.getCell(`B${rowNumber}`).value = item[1];
      }
      
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
    summarySheet.getCell(`A${ageStart}`).value = 'Age Distribution';
    summarySheet.getCell(`A${ageStart}`).font = { bold: true, size: 12, color: { argb: argb(theme.excel.sectionTitle) } };

    const ageData = analyzeDeadInventoryAge();
    const ageRows = [
      ['Age range', 'Item count']
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

    // Add charts as images
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
        console.warn('Could not add age chart:', err);
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
        console.warn('Could not add top items chart:', err);
      }
    }

    // Data sheet
    const sheet = workbook.addWorksheet('Dead Inventory', {
      properties: { defaultRowHeight: 18 }
    });

    sheet.columns = [
      { header: 'No. Parte', key: 'no_part', width: 18 },
      { header: 'Description', key: 'description', width: 42 },
      { header: 'Unit Cost', key: 'unit_cost', width: 15 },
      { header: 'Stock Quantity', key: 'available', width: 18 },
      { header: 'Total Value', key: 'total_value', width: 15 },
      { header: 'Last Movement', key: 'last_movement_date', width: 20 }
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
      const quantity = parseInt(row.available) || 0;
      const unitCost = parseAmount(row.unit_cost || row.cost || row.price_unit || 0);
      const totalValue = quantity * unitCost;
      
      sheet.addRow({
        no_part: row.no_part || '-',
        description: row.description || '-',
        unit_cost: unitCost,
        available: quantity,
        total_value: totalValue,
        last_movement_date: row.last_movement_date 
          ? new Date(row.last_movement_date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-'
      });
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 6 }
    };

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (rowNumber % 2 === 0) {
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argb(theme.excel.zebraRow) }
          };
          // Apply currency format to Unit Cost and Total Value columns
          if (colNumber === 3 || colNumber === 5) {
            cell.numFmt = '"$"#,##0.00';
          }
        });
      }
    });

    // Apply currency format to header row cells and data cells
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (rowNumber > 1 && (colNumber === 3 || colNumber === 5)) {
          cell.numFmt = '"$"#,##0.00';
        }
      });
    });

    const lastRow = sheet.rowCount;
    if (lastRow >= 1) {
      applyExcelTableBorders(sheet, 1, lastRow, 1, 6, theme);
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
      pendingPercentCaption.textContent = `${toPercent(visiblePct)} of the visible expense with the filter.`;
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
    pendingPercentCaption.textContent = `${toPercent(visiblePct)} of the visible ${config.pendingLabel} with the filter.`;
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
          },
          tooltip: {
            callbacks: {
              label(context) {
                const dataset = context.dataset || {};
                const data = Array.isArray(dataset.data) ? dataset.data : [];
                const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
                const value = Number(context.raw) || 0;
                const pct = total > 0 ? (value / total) * 100 : 0;
                const label = context.label || 'Sin etiqueta';
                return `${label}: ${value} (${toPercent(pct)})`;
              }
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
    const projectNameById = new Map();

    filteredRows.forEach((row) => {
      const noProject = String(row.no_project || '').trim();
      const projectName = String(row.project_name || '').trim();
      const label = noProject || 'No project';
      const increment = spendingMode ? parseAmount(row.total_amount) : 1;
      projectTotals.set(label, (projectTotals.get(label) || 0) + increment);

      if (label !== 'No project' && projectName && !projectNameById.has(label)) {
        projectNameById.set(label, projectName);
      }
    });

    const ordered = Array.from(projectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);

    const labels = ordered.map((item) => item[0]);
    const values = ordered.map((item) => item[1]);
    const labelProjectNames = labels.map((label) => projectNameById.get(label) || '-');

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
          borderColor: theme.chart.projectsBar,
          borderWidth: 1,
          minBarLength: 6,
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
          legend: { display: false },
          tooltip: {
            callbacks: {
              title(items) {
                if (!items || items.length === 0) return 'No project';
                return labels[items[0].dataIndex] || 'No project';
              },
              label(context) {
                const value = Number(context.raw) || 0;
                return spendingMode
                  ? `${config.projectsDatasetLabel}: $${value.toFixed(2)}`
                  : `${config.projectsDatasetLabel}: ${value}`;
              },
              afterLabel(context) {
                const projectName = labelProjectNames[context.dataIndex] || '-';
                return `Project name: ${projectName}`;
              }
            }
          }
        }
      }
    });
  }

  function applyProjectFilter() {
    const searchTerm = normalizeText(projectSearchInput.value.trim());
    const selectedNoProject = normalizeText(projectSearchInput.dataset.noProject || '');
    const selectedNetwork = normalizeText(projectSearchInput.dataset.network || '');
    const columnFilters = getColumnFilters();
    const spendingMode = isSpendingMode();

    const filteredRows = pendingPurchases.filter((row) => {
      const noProject = normalizeText(row.no_project);
      const projectName = normalizeText(row.project_name);
      const network = normalizeText(row.network);

      let matchesProject;
      
      if (selectedNetwork) {
        // If a network is selected, only match that network
        matchesProject = network === selectedNetwork;
      } else if (selectedNoProject) {
        // If a project is selected, only match that project
        matchesProject = noProject === selectedNoProject;
      } else {
        // Otherwise, search by term or show all
        matchesProject = !searchTerm || noProject.includes(searchTerm) || projectName.includes(searchTerm) || (spendingMode && network.includes(searchTerm));
      }
      
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
        <td colspan="${colspan}" class="text-center">Loading data...</td>
      </tr>
    `;

    try {
      if (!Array.isArray(allProjects) || allProjects.length === 0) {
        await loadAllProjects();
      }

      const response = await fetch(`${BASE}/purchases`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error('Error querying purchases');
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
    deadInventoryMeta.textContent = 'Loading dead inventory...';
    deadInventoryTableBody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center">Loading data...</td>
      </tr>
    `;

    try {
      const response = await fetch(`${BASE}/dead-inventory`);
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error('Error loading dead inventory');
      }

      allDeadInventory = Array.isArray(responseData.deadInventory) ? responseData.deadInventory : [];
      totalItemsInStock = responseData.totalItems || 0;
      totalQuantityInStock = responseData.totalQuantity || 0;

      if (allDeadInventory.length === 0) {
        deadInventoryMeta.textContent = 'No items with dead inventory were found.';
        document.getElementById('deadInventoryKpiTotal').textContent = totalItemsInStock.toLocaleString('es-ES') || '0';
        document.getElementById('deadInventoryKpiDead').textContent = '0';
        document.getElementById('deadInventoryKpiPercent').textContent = '0.0%';
        document.getElementById('deadInventoryKpiQuantity').textContent = '0';
        document.getElementById('deadInventoryPercentBar').style.width = '0%';
        document.getElementById('deadInventoryPercentProgress').setAttribute('aria-valuenow', '0');
        document.getElementById('deadInventoryPercentCaption').textContent = '0% of inventory has not moved in 3 months.';
        deadInventoryTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center">There is no dead inventory at the moment.</td>
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
      deadInventoryMeta.textContent = 'Unable to load the dead inventory report.';
      deadInventoryTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-danger">Error loading data</td>
        </tr>
      `;
    }
  }

  function updateDeadInventoryDisplay(filteredRows = null) {
    const rowsToDisplay = filteredRows || allDeadInventory;
    const deadCount = allDeadInventory.length;
    const deadPercent = totalItemsInStock > 0 ? ((deadCount / totalItemsInStock) * 100).toFixed(1) : 0;
    const deadQuantity = allDeadInventory.reduce((sum, row) => sum + (parseInt(row.available) || 0), 0);
    
    // Calculate the money locked in dead inventory
    const moneyLocked = allDeadInventory.reduce((sum, row) => {
      const quantity = parseInt(row.available) || 0;
      const unitCost = parseAmount(row.unit_cost || row.cost || row.price_unit || 0);
      return sum + (quantity * unitCost);
    }, 0);

    deadInventoryMeta.textContent = `Total items without movement in 3 months: ${deadCount}`;
    document.getElementById('deadInventoryKpiTotal').textContent = totalItemsInStock.toLocaleString('es-ES');
    document.getElementById('deadInventoryKpiDead').textContent = deadCount.toLocaleString('es-ES');
    document.getElementById('deadInventoryKpiPercent').textContent = `${deadPercent}%`;
    document.getElementById('deadInventoryKpiQuantity').textContent = deadQuantity.toLocaleString('es-ES');
    document.getElementById('deadInventoryKpiMoneyLocked').textContent = formatCurrency(moneyLocked);

    const percentBar = document.getElementById('deadInventoryPercentBar');
    percentBar.style.width = `${deadPercent}%`;
    document.getElementById('deadInventoryPercentProgress').setAttribute('aria-valuenow', deadPercent);
    document.getElementById('deadInventoryPercentCaption').textContent = `${deadPercent}% of inventory (${deadCount} of ${totalItemsInStock} items) has not moved in 3 months.`;

    deadInventoryTableBody.innerHTML = rowsToDisplay
      .map((row) => {
        const partValue = escapeHtml(row.no_part || '-');
        const descriptionValue = escapeHtml(row.description || '-');
        const quantityValue = parseInt(row.available) || 0;
        const unitCost = parseAmount(row.unit_cost || row.cost || row.price_unit || 0);
        const totalValue = quantityValue * unitCost;
        const lastMovementValue = row.last_movement_date 
          ? new Date(row.last_movement_date).toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';

        return `
          <tr>
            <td>${partValue}</td>
            <td>${descriptionValue}</td>
            <td class="text-end">${formatCurrency(unitCost)}</td>
            <td class="text-end">${quantityValue.toLocaleString('es-ES')}</td>
            <td class="text-end">${formatCurrency(totalValue)}</td>
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
    const theme = getActiveTheme();

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
            backgroundColor: [theme.chart.quoted, theme.chart.pr, theme.chart.shopping, theme.chart.po],
            borderColor: '#fff',
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: theme.chart.legendText,
                font: { size: 12 },
                usePointStyle: true,
                padding: 15
              }
            },
            tooltip: {
              callbacks: {
                label(context) {
                  const dataset = context.dataset || {};
                  const data = Array.isArray(dataset.data) ? dataset.data : [];
                  const total = data.reduce((sum, value) => sum + (Number(value) || 0), 0);
                  const value = Number(context.raw) || 0;
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  const label = context.label || 'Sin etiqueta';
                  return `${label}: ${value} (${toPercent(pct)})`;
                }
              }
            }
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
            label: 'Stock quantity',
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
      '3-6 months': { min: 90, max: 180, count: 0 },
      '6-12 months': { min: 180, max: 365, count: 0 },
      '1-2 years': { min: 365, max: 730, count: 0 },
      '2+ years': { min: 730, max: Infinity, count: 0 }
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
    genericMessage.textContent = 'This report type is under development.';
  }

  reportTypeMenu.addEventListener('change', updateReportView);

  projectSearchInput.addEventListener('input', () => {
    delete projectSearchInput.dataset.noProject;
    delete projectSearchInput.dataset.network;
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
