document.addEventListener('DOMContentLoaded', () => {
  const BASE = 'http://localhost:3000/api';

  const reportTypeMenu = document.getElementById('reportTypeMenu');
  const printButton = document.querySelector('.reports-print-btn');

  const pendingPanel = document.getElementById('pendingPurchasesPanel');
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

  let allPurchases = [];
  let allProjects = [];
  let pendingPurchases = [];
  let currentFilteredRows = [];
  let statusChart = null;
  let projectsChart = null;

  const REPORT_THEMES = Object.freeze({
    silver: {
      cssVars: {
        '--report-header-from': '#797564',
        '--report-header-to': '#4f5663',
        '--report-header-text': '#f2f4f7',
        '--report-card-from': '#c47b0d',
        '--report-card-to': '#7f498a',
        '--report-card-accent': '#a8c1ea',
        '--report-chart-card': 'rgba(13, 13, 16, 0.9)',
        '--report-progress-from': '#7a848f',
        '--report-progress-to': '#4f5866',
        '--report-filter-btn-from': '#707886',
        '--report-filter-btn-to': '#59616e',
        '--report-filter-btn-hover-from': '#7e8796',
        '--report-filter-btn-hover-to': '#656e7d'
      },
      excel: {
        headerBg: '3F4550',
        tableHeaderBg: '5A6270',
        sectionTitle: '2F343C',
        textLight: 'FFFFFF',
        zebraRow: 'F6F8FB',
        kpiLabelBg: 'E6E9EE',
        border: 'D2D8E2'
      },
      chart: {
        quoted: '#6E7683',
        pr: '#4E596A',
        shopping: '#8A94A3',
        po: '#2F3744',
        delivered: '#A8B0BD',
        other: '#C5CBD5',
        projectsBar: '#596272',
        legendText: '#f2f2f2',
        ticks: '#e9e9e9',
        gridMajor: 'rgba(255,255,255,0.08)',
        gridMinor: 'rgba(255,255,255,0.05)'
      }
    },
    ocean: {
      cssVars: {
        '--report-header-from': '#0f4c66',
        '--report-header-to': '#07384d',
        '--report-header-text': '#e7f7ff',
        '--report-card-from': '#0f6f98',
        '--report-card-to': '#0b5272',
        '--report-card-accent': '#6ad8ff',
        '--report-chart-card': 'rgba(6, 34, 48, 0.9)',
        '--report-progress-from': '#2fb0d9',
        '--report-progress-to': '#0e7ea6',
        '--report-filter-btn-from': '#1f89ad',
        '--report-filter-btn-to': '#146d8c',
        '--report-filter-btn-hover-from': '#25a1cb',
        '--report-filter-btn-hover-to': '#1a84a9'
      },
      excel: {
        headerBg: '0C4A63',
        tableHeaderBg: '0F5D7C',
        sectionTitle: '0A3B52',
        textLight: 'FFFFFF',
        zebraRow: 'EDF8FD',
        kpiLabelBg: 'DDF0FA',
        border: 'B7D9E8'
      },
      chart: {
        quoted: '#2B8FC2',
        pr: '#1F6E9A',
        shopping: '#5CB8E4',
        po: '#0E4D73',
        delivered: '#8ED4F1',
        other: '#B9E5F8',
        projectsBar: '#16739D',
        legendText: '#e8f7ff',
        ticks: '#e6f5ff',
        gridMajor: 'rgba(184,227,248,0.25)',
        gridMinor: 'rgba(184,227,248,0.14)'
      }
    },
    carbon: {
      cssVars: {
        '--report-header-from': '#4a4a4a',
        '--report-header-to': '#303030',
        '--report-header-text': '#f2f2f2',
        '--report-card-from': '#585e69',
        '--report-card-to': '#3c424d',
        '--report-card-accent': '#d5deee',
        '--report-chart-card': 'rgba(26, 26, 26, 0.9)',
        '--report-progress-from': '#9a9a9a',
        '--report-progress-to': '#6f6f6f',
        '--report-filter-btn-from': '#7f7f7f',
        '--report-filter-btn-to': '#646464',
        '--report-filter-btn-hover-from': '#8f8f8f',
        '--report-filter-btn-hover-to': '#747474'
      },
      excel: {
        headerBg: '404040',
        tableHeaderBg: '5A5A5A',
        sectionTitle: '333333',
        textLight: 'FFFFFF',
        zebraRow: 'F2F2F2',
        kpiLabelBg: 'E5E5E5',
        border: 'CDCDCD'
      },
      chart: {
        quoted: '#7A7A7A',
        pr: '#5D5D5D',
        shopping: '#939393',
        po: '#424242',
        delivered: '#B0B0B0',
        other: '#C9C9C9',
        projectsBar: '#686868',
        legendText: '#f0f0f0',
        ticks: '#ebebeb',
        gridMajor: 'rgba(255,255,255,0.12)',
        gridMinor: 'rgba(255,255,255,0.07)'
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

  function applyHeaderCellStyle(cell, theme) {
    cell.font = { bold: true, color: { argb: argb(theme.excel.textLight) } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.tableHeaderBg) }
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: argb(theme.excel.border) } },
      bottom: { style: 'thin', color: { argb: argb(theme.excel.border) } },
      left: { style: 'thin', color: { argb: argb(theme.excel.border) } },
      right: { style: 'thin', color: { argb: argb(theme.excel.border) } }
    };
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
    if (!searchTerm) {
      pendingMeta.textContent = `Total compras pendientes (Quoted): ${total}`;
      return;
    }

    pendingMeta.textContent = `Mostrando ${filteredCount} de ${total} compras pendientes (Quoted)`;
  }

  function renderPendingRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      currentFilteredRows = [];
      pendingTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center">No se encontraron compras pendientes para el proyecto buscado.</td>
        </tr>
      `;
      return;
    }

    currentFilteredRows = rows;

    pendingTableBody.innerHTML = rows
      .map((row) => {
        const projectValue = escapeHtml(formatProjectCell(row));
        const noProjectValue = escapeHtml(row.no_project || '-');
        const qisValue = escapeHtml(row.no_qis || '-');
        const partValue = escapeHtml(row.no_part || '-');
        const descriptionValue = escapeHtml(row.description || '-');
        const vendorValue = escapeHtml(row.vendor_name || '-');
        const quantityValue = escapeHtml(row.quantity ?? '-');

        return `
          <tr>
            <td>${projectValue}</td>
            <td>${noProjectValue}</td>
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

    rows.forEach((row) => {
      const noProject = String(row.no_project || '').trim();
      const projectName = String(row.project_name || '').trim();
      const label = noProject ? `${noProject}${projectName ? ` - ${projectName}` : ''}` : 'Sin proyecto';
      projectTotals.set(label, (projectTotals.get(label) || 0) + 1);
    });

    return Array.from(projectTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([project, pendingCount]) => [project, pendingCount]);
  }

  function buildSummarySheetData() {
    const totalPurchases = allPurchases.length;
    const totalPending = pendingPurchases.length;
    const visiblePending = currentFilteredRows.length;
    const pendingPercent = totalPurchases > 0 ? (totalPending / totalPurchases) * 100 : 0;
    const visiblePercent = totalPending > 0 ? (visiblePending / totalPending) * 100 : 0;
    const selectedProjectLabel = projectSearchInput?.value?.trim() || 'Todos los proyectos';

    const statusDistributionRows = getStatusDistributionRows();
    const topProjectsRows = getTopProjectsRows(currentFilteredRows);

    const rows = [
      ['Reporte de Compras Pendientes'],
      [`Generado: ${new Date().toLocaleString()}`],
      [`Filtro de proyecto: ${selectedProjectLabel}`],
      [],
      ['Resumen Ejecutivo'],
      ['Indicador', 'Valor'],
      ['Total compras (proyectos activos)', totalPurchases],
      ['Compras pendientes (Quoted)', totalPending],
      ['Pendiente % (proyectos activos)', `${pendingPercent.toFixed(1)}%`],
      ['Pendientes visibles (filtro actual)', visiblePending],
      ['Cobertura del filtro', `${visiblePercent.toFixed(1)}%`],
      [],
      ['Distribucion de estatus (general)'],
      ['Estatus', 'Cantidad', 'Porcentaje'],
      ...statusDistributionRows,
      [],
      ['Top proyectos con compras pendientes (filtro actual)'],
      ['Proyecto', 'Pendientes'],
      ...(topProjectsRows.length ? topProjectsRows : [['Sin datos para el filtro actual', 0]])
    ];

    return rows;
  }

  async function exportPendingPurchasesToExcel() {
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
    titleCell.value = 'Reporte de Compras Pendientes';
    titleCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
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
    const pendingPercent = totalPurchases > 0 ? (totalPending / totalPurchases) * 100 : 0;
    const visiblePercent = totalPending > 0 ? (visiblePending / totalPending) * 100 : 0;

    summarySheet.getCell('A5').value = 'Resumen Ejecutivo';
    summarySheet.getCell('A5').font = { bold: true, size: 13, color: { argb: argb(theme.excel.sectionTitle) } };

    const kpiRows = [
      ['Total compras (proyectos activos)', totalPurchases],
      ['Compras pendientes (Quoted)', totalPending],
      ['Pendiente % (proyectos activos)', `${pendingPercent.toFixed(1)}%`],
      ['Pendientes visibles (filtro actual)', visiblePending],
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
      summarySheet.getCell(`A${rowNumber}`).border = {
        top: { style: 'thin', color: { argb: argb(theme.excel.border) } },
        bottom: { style: 'thin', color: { argb: argb(theme.excel.border) } },
        left: { style: 'thin', color: { argb: argb(theme.excel.border) } },
        right: { style: 'thin', color: { argb: argb(theme.excel.border) } }
      };
      summarySheet.getCell(`B${rowNumber}`).border = {
        top: { style: 'thin', color: { argb: argb(theme.excel.border) } },
        bottom: { style: 'thin', color: { argb: argb(theme.excel.border) } },
        left: { style: 'thin', color: { argb: argb(theme.excel.border) } },
        right: { style: 'thin', color: { argb: argb(theme.excel.border) } }
      };
    });

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
      ['A', 'B', 'C'].forEach((col) => {
        summarySheet.getCell(`${col}${rowNumber}`).border = {
          top: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          bottom: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          left: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          right: { style: 'thin', color: { argb: argb(theme.excel.border) } }
        };
      });
    });

    const topProjectsRows = getTopProjectsRows(currentFilteredRows);
    const topStart = statusStart + 10;
    summarySheet.getCell(`A${topStart}`).value = 'Top proyectos con compras pendientes (filtro actual)';
    summarySheet.getCell(`A${topStart}`).font = { bold: true, size: 12, color: { argb: argb(theme.excel.sectionTitle) } };
    summarySheet.getCell(`A${topStart + 1}`).value = 'Proyecto';
    summarySheet.getCell(`B${topStart + 1}`).value = 'Pendientes';

    ['A', 'B'].forEach((col) => {
      applyHeaderCellStyle(summarySheet.getCell(`${col}${topStart + 1}`), theme);
    });

    (topProjectsRows.length ? topProjectsRows : [['Sin datos para el filtro actual', 0]]).forEach((item, index) => {
      const rowNumber = topStart + 2 + index;
      summarySheet.getCell(`A${rowNumber}`).value = item[0];
      summarySheet.getCell(`B${rowNumber}`).value = item[1];
      summarySheet.getCell(`B${rowNumber}`).alignment = { horizontal: 'right' };
      ['A', 'B'].forEach((col) => {
        summarySheet.getCell(`${col}${rowNumber}`).border = {
          top: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          bottom: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          left: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          right: { style: 'thin', color: { argb: argb(theme.excel.border) } }
        };
      });
    });

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

    detailSheet.columns = [
      { header: 'Proyecto', key: 'project_name', width: 32 },
      { header: 'No. Proyecto', key: 'no_project', width: 16 },
      { header: 'No. QIS', key: 'no_qis', width: 14 },
      { header: 'No. Parte', key: 'no_part', width: 18 },
      { header: 'Descripcion', key: 'description', width: 42 },
      { header: 'Proveedor', key: 'vendor_name', width: 26 },
      { header: 'Cantidad', key: 'quantity', width: 12 }
    ];

    detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    detailSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: argb(theme.excel.tableHeaderBg) }
    };
    detailSheet.getRow(1).height = 22;
    detailSheet.getRow(1).eachCell((cell) => applyHeaderCellStyle(cell, theme));

    currentFilteredRows.forEach((row) => {
      detailSheet.addRow({
        project_name: String(row.project_name || '').trim() || '-',
        no_project: String(row.no_project || '').trim() || '-',
        no_qis: String(row.no_qis || '').trim() || '-',
        no_part: String(row.no_part || '').trim() || '-',
        description: String(row.description || '').trim() || '-',
        vendor_name: String(row.vendor_name || '').trim() || '-',
        quantity: Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : String(row.quantity ?? '-')
      });
    });

    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
    detailSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 7 }
    };

    detailSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.getCell(7).alignment = { horizontal: 'right' };
      if (rowNumber % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: argb(theme.excel.zebraRow) }
          };
        });
      }
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          bottom: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          left: { style: 'thin', color: { argb: argb(theme.excel.border) } },
          right: { style: 'thin', color: { argb: argb(theme.excel.border) } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fileName = `reporte_compras_pendientes_${getExcelTimestamp()}.xlsx`;
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
    const quantity = normalizeText(row.quantity ?? '');

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
    pendingPercentCaption.textContent = `${toPercent(visiblePct)} de las compras pendientes visibles con el filtro.`;
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

    const theme = getActiveTheme();

    const projectTotals = new Map();

    filteredRows.forEach((row) => {
      const noProject = String(row.no_project || '').trim();
      const projectName = String(row.project_name || '').trim();
      const label = noProject ? `${noProject}${projectName ? ` - ${projectName}` : ''}` : 'Sin proyecto';
      projectTotals.set(label, (projectTotals.get(label) || 0) + 1);
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
          label: 'Compras pendientes',
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
            ticks: { color: theme.chart.ticks, precision: 0 },
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

    const filteredRows = pendingPurchases.filter((row) => {
      const noProject = normalizeText(row.no_project);
      const projectName = normalizeText(row.project_name);

      const matchesProject = selectedNoProject
        ? noProject === selectedNoProject
        : (!searchTerm || noProject.includes(searchTerm) || projectName.includes(searchTerm));
      const matchesColumns = rowMatchesColumnFilters(row, columnFilters);

      return matchesProject && matchesColumns;
    });

    renderPendingRows(filteredRows);
    updateMeta(pendingPurchases.length, filteredRows.length, searchTerm);
    updateKpiCards(filteredRows);
    updateProjectsChart(filteredRows);
  }

  async function loadPendingPurchasesReport() {
    pendingMeta.textContent = 'Cargando compras pendientes...';
    pendingTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center">Cargando datos...</td>
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
      pendingPurchases = activePurchases.filter((row) => isQuotedStatus(row.status));
      clearColumnFilters();

      applyProjectFilter();
      updateStatusChart();
    } catch (error) {
      allPurchases = [];
      pendingPurchases = [];
      pendingMeta.textContent = 'No fue posible cargar el reporte de compras pendientes.';
      pendingTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-danger">Error al cargar datos de compras pendientes.</td>
        </tr>
      `;

      updateKpiCards([]);
      updateProjectsChart([]);
      updateStatusChart();
    }
  }

  function updateReportView() {
    const selectedReport = reportTypeMenu.value;

    if (selectedReport === 'pending-purchases') {
      pendingPanel.hidden = false;
      genericPanel.hidden = true;
      loadPendingPurchasesReport();
      return;
    }

    pendingPanel.hidden = true;
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

  printButton.addEventListener('click', async () => {
    if (reportTypeMenu.value === 'pending-purchases') {
      await exportPendingPurchasesToExcel();
      return;
    }

    window.print();
  });

  applyReportTheme(reportThemeSelect?.value || 'silver');
  loadAllProjects().finally(updateReportView);
});
