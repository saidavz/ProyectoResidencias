document.addEventListener("DOMContentLoaded", async () => {
  const tabla = document.querySelector("#tablaInventario tbody");
  const projectSearch = document.querySelector("#projectSearchStock");
  const projectSuggestions = document.querySelector("#projectSuggestionsStock");
  let allData = [];
  let allProjects = [];
  let allVendors = [];
  let allParts = [];
  let allBrands = [];
  let currentMode = 'general'; // 'general' o 'project'
  let searchActive = false;

  // NOTE: projects are loaded from stock via loadDistinctStockFilters()

  // cargar valores únicos desde stock (projects, vendors, parts, brands)
  async function loadDistinctStockFilters() {
    try {
      const res = await fetch('http://localhost:3000/api/stock/distinct-filters');
      const data = await res.json();
      allProjects = data.projects || [];
      allVendors = (data.vendors || []).map(v => ({ name_vendor: v }));
      allParts = data.parts || [];
      allBrands = data.brands || [];
    } catch (err) {
      console.error('Error loading distinct stock filters:', err);
    }
  }

  async function loadGeneralData() {
    try {
      const response = await fetch("http://localhost:3000/api/stock/summary");
      allData = await response.json();
      currentMode = 'general';
      renderTabla(allData);
      // extraer partes y marcas únicas para sugerencias
      const partsSet = new Set();
      const brandsSet = new Set();
      allData.forEach(item => {
        if (item.no_part) partsSet.add(item.no_part);
        if (item.brand) brandsSet.add(item.brand);
      });
      allParts = Array.from(partsSet);
      allBrands = Array.from(brandsSet);
    } catch (err) {
      console.error("Error loading general data:", err);
    }
  }

  async function loadProjectData(noProject) {
    try {
      const response = await fetch(`http://localhost:3000/api/stock/by-project?no_project=${encodeURIComponent(noProject)}`);
      allData = await response.json();
      currentMode = 'project';
      renderTabla(allData);
    } catch (err) {
      console.error("Error loading project data:", err);
    }
  }

  function safeValue(value) {
    return value !== undefined && value !== null ? value : '';
  }

  function renderTabla(filas) {
    tabla.innerHTML = "";
    // Si estamos en vista general y no hay búsqueda activa, ocultar solo filas totalmente vacías
    let rowsToRender = filas;
    if (currentMode === 'general' && !searchActive) {
      rowsToRender = filas.filter(item => {
        const isEmpty = v => v === undefined || v === null || String(v).trim() === '';
        // campos principales que deben existir para mostrar la fila
        const allEmpty = isEmpty(item.description) && isEmpty(item.no_part) && isEmpty(item.brand) && isEmpty(item.product_quantity) && (item.cantidad_disponible === null || item.cantidad_disponible === undefined || String(item.cantidad_disponible).trim() === '');
        return !allEmpty;
      });
    }

    // decidir si mostrar columnas de compra (Proveedor, PR, Shopping, PO)
    const showPurchaseCols = !(currentMode === 'general' && !searchActive);
    updateTableHeaders(showPurchaseCols);

    rowsToRender.forEach(item => {
      const tr = document.createElement("tr");
      // Resaltar cantidad_disponible <= 10
      const cantidad = Number(item.cantidad_disponible);
      const highlight = !isNaN(cantidad) && cantidad <= 10 ? ' style="background:rgba(255,0,0,0.18);color:#b30000;font-weight:bold;position:relative;"' : '';
      const alertIcon = !isNaN(cantidad) && cantidad <= 10 ? '<span style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:1.3em; pointer-events:none;">⚠️</span>' : '';
      tr.innerHTML = `
            <td>${safeValue(item.description)}</td>
            <td>${safeValue(item.type_p)}</td>
            <td>${safeValue(item.no_part)}</td>
            <td>${safeValue(item.name_vendor)}</td>
            <td>${safeValue(item.brand)}</td>
            <td>${safeValue(item.pr)}</td>
            <td>${safeValue(item.shopping)}</td>
            <td>${safeValue(item.po)}</td>
            <td>${safeValue(item.rack)}</td>
            <td>${safeValue(item.product_quantity)}</td>
            <td>${safeValue(item.unit)}</td>
            <td${highlight}> <span style="position:relative; display:block; min-width:60px;">${safeValue(item.cantidad_disponible)}${alertIcon}</span></td>
          `;
      // ocultar tds individuales si corresponde (mantener columnas alineadas)
      if (!showPurchaseCols) {
        // indices: 0 desc,1 type,2 no_part,3 vendor,4 brand,5 pr,6 shopping,7 po,8 rack...
        const hideIndices = [3,5,6,7];
        hideIndices.forEach(i => { if (tr.children[i]) tr.children[i].style.display = 'none'; });
      }
      tabla.appendChild(tr);
    });
    // actualizar contador
    const totalEl = document.getElementById('totalMaterial');
    if (totalEl) totalEl.textContent = rowsToRender.length;
  }

  function normalizeText(text) {
    return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function updateTableHeaders(showPurchase) {
    const ths = document.querySelectorAll('#tablaInventario thead th');
    if (!ths || ths.length === 0) return;
    // indices to hide/show: 3 (Proveedor), 5 (PR), 6 (Shopping), 7 (PO)
    const indices = [3,5,6,7];
    indices.forEach(i => {
      if (ths[i]) ths[i].style.display = showPurchase ? '' : 'none';
    });
  }

  // Buscador tipo Purchase Tracking
  projectSearch.addEventListener('input', async (e) => {
    delete projectSearch.dataset.noProject;
    const termRaw = projectSearch.value.trim();
    const term = normalizeText(termRaw);

    searchActive = termRaw.length > 0;

    if (!term) {
      projectSuggestions.style.display = 'none';
      await loadGeneralData();
      return;
    }

    // Si el usuario escribe exactamente un no_project válido, cargar datos del proyecto
    const exactProject = allProjects.find(p => normalizeText(String(p.no_project)) === term);
    if (exactProject && (e.inputType === undefined || e.inputType === 'insertReplacementText')) {
      // inputType undefined: evento programático o Enter
      projectSuggestions.style.display = 'none';
      searchActive = true;
      await loadProjectData(exactProject.no_project);
      return;
    }

    // Construir sugerencias combinadas: proyectos, proveedores, partes, marcas (solo desde stock)
    const suggestions = [];

    // proyectos
    allProjects.forEach(p => {
      const pname = normalizeText(p.name_project || '');
      const pid = normalizeText((p.no_project || '').toString());
      if (pname.includes('sin asignar')) return;
      if (pname.includes(term) || pid.includes(term)) {
        suggestions.push({ type: 'project', label: `${p.no_project} - ${p.name_project || ''}`, value: p.no_project });
      }
    });

    // proveedores
    allVendors.forEach(v => {
      const vname = normalizeText(v.name_vendor || '');
      if (vname.includes(term)) suggestions.push({ type: 'vendor', label: `Proveedor: ${v.name_vendor}`, value: v.name_vendor });
    });

    // partes
    allParts.forEach(part => {
      if (normalizeText(part).includes(term)) suggestions.push({ type: 'part', label: `Parte: ${part}`, value: part });
    });

    // marcas
    allBrands.forEach(brand => {
      if (normalizeText(brand).includes(term)) suggestions.push({ type: 'brand', label: `Marca: ${brand}`, value: brand });
    });

    // ordenar: projects first, then parts, vendors, brands
    suggestions.sort((a, b) => {
      const order = { project: 0, part: 1, vendor: 2, brand: 3 };
      return order[a.type] - order[b.type];
    });

    projectSuggestions.innerHTML = '';
    suggestions.forEach(s => {
      const div = document.createElement('div');
      div.textContent = s.label;
      div.style.padding = '8px';
      div.style.cursor = 'pointer';
      div.style.borderBottom = '1px solid #eee';
      div.addEventListener('click', async () => {
        projectSearch.value = s.label;
        projectSearch.dataset.selectionType = s.type;
        projectSearch.dataset.selectionValue = s.value;
        projectSuggestions.style.display = 'none';
        searchActive = true;
        if (s.type === 'project') {
          // extraer solo el número de proyecto (antes del primer espacio o guion)
          let noProject = s.value;
          if (typeof noProject === 'string' && noProject.includes(' ')) {
            noProject = noProject.split(' ')[0];
          } else if (typeof noProject === 'string' && noProject.includes('-')) {
            noProject = noProject.split('-')[0].trim();
          }
          await loadProjectData(noProject);
        } else {
          // para vendor/part/brand: cargar datos generales y filtrar
          await loadGeneralData();
          let filtrado = [];
          if (s.type === 'vendor') filtrado = allData.filter(item => item.name_vendor && normalizeText(item.name_vendor) === normalizeText(s.value));
          if (s.type === 'part') filtrado = allData.filter(item => item.no_part && normalizeText(item.no_part) === normalizeText(s.value));
          if (s.type === 'brand') filtrado = allData.filter(item => item.brand && normalizeText(item.brand) === normalizeText(s.value));
          renderTabla(filtrado);
        }
      });
      div.addEventListener('mouseover', () => { div.style.backgroundColor = '#f0f0f0'; });
      div.addEventListener('mouseout', () => { div.style.backgroundColor = 'transparent'; });
      projectSuggestions.appendChild(div);
    });

    projectSuggestions.style.display = suggestions.length ? 'block' : 'none';
  });

  // Ocultar sugerencias al hacer click fuera
  document.addEventListener('click', (e) => {
    if (e.target !== projectSearch && !projectSuggestions.contains(e.target)) {
      projectSuggestions.style.display = 'none';
    }
  });
  
  window.filterTable = function (searchText) {
    const texto = normalizeText(searchText);
    const filas = document.querySelectorAll('#tablaInventario tbody tr');
    let contador = 0;

    filas.forEach(fila => {
      const textoFila = normalizeText(fila.textContent);
      if (textoFila.includes(texto)) {
        fila.style.display = '';
        contador++;
      } else {
        fila.style.display = 'none';
      }
    });

    document.getElementById('totalMaterial').textContent = contador;
  };

  await loadDistinctStockFilters();
  await loadGeneralData();
}); 
