document.addEventListener('DOMContentLoaded', () => {
  const projectSearchInput = document.getElementById('projectSearch');
  const projectSuggestions = document.getElementById('projectSuggestions');
  const projectSelectHidden = document.getElementById('projectSelect');
  const resultEl = document.getElementById('result');

  // URL explícita al backend
  const BASE = 'http://localhost:3000/api';

  // Función para normalizar acentos y convertir a minúsculas
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // Elimina marcas diacríticas
  }

  // Buscador de proyectos activos
  projectSearchInput.addEventListener('input', async () => {
    const term = normalizeText(projectSearchInput.value.trim());

    if (!term) {
      projectSuggestions.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`${BASE}/projects/active`);
      const allProjects = await res.json();
      console.log('projects/active returned:', Array.isArray(allProjects) ? allProjects.length : typeof allProjects);

      // Filtrar proyectos: excluir "Sin asignar" y buscar por término (nombre o no_project)
      const filtered = allProjects.filter(p => {
        const pname = normalizeText(p.name_project || '');
        const pid = normalizeText((p.no_project || '').toString());
        // Excluir "Sin asignar"
        if (pname.includes('sin asignar')) return false;
        // Incluir si contiene el término en nombre o en no_project (normalizado)
        return pname.includes(term) || pid.includes(term);
      });

      // Jerarquizar: primero los que empiezan con el término, luego los que lo contienen en otro lado
      const filteredProjects = filtered.sort((a, b) => {
        const aname = normalizeText(a.name_project || '');
        const aid = normalizeText((a.no_project || '').toString());
        const bname = normalizeText(b.name_project || '');
        const bid = normalizeText((b.no_project || '').toString());
        
        const aStartsWith = aname.startsWith(term) || aid.startsWith(term);
        const bStartsWith = bname.startsWith(term) || bid.startsWith(term);
        
        // Si uno empieza y el otro no, poner primero al que empieza
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
        // Si ambos empiezan (o ninguno), mantener orden alfabético
        return aname.localeCompare(bname);
      });

      projectSuggestions.innerHTML = '';
      filteredProjects.forEach(project => {
        const div = document.createElement('div');
        const displayName = project.name_project || '';
        div.textContent = `${project.no_project} - ${displayName}`;
        div.style.padding = '8px';
        div.style.cursor = 'pointer';
        div.style.borderBottom = '1px solid #eee';
        div.addEventListener('click', () => {
          projectSearchInput.value = `${project.no_project} - ${displayName}`;
          projectSelectHidden.value = project.no_project;
          projectSuggestions.style.display = 'none';
        });
        div.addEventListener('mouseover', () => {
          div.style.backgroundColor = '#f0f0f0';
        });
        div.addEventListener('mouseout', () => {
          div.style.backgroundColor = 'transparent';
        });
        projectSuggestions.appendChild(div);
      });

      projectSuggestions.style.display = filteredProjects.length ? 'block' : 'none';
    } catch (err) {
      console.error(err);
    }
  });

  // Ocultar sugerencias al hacer click fuera
  document.addEventListener('click', (e) => {
    if (e.target !== projectSearchInput && e.target !== projectSuggestions) {
      projectSuggestions.style.display = 'none';
    }
  });

  // Verificación de la subida de datos
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    resultEl.textContent = '';
    const fileInputEl = document.getElementById('fileinput');
    const file = fileInputEl.files[0];
    const no_project = projectSelectHidden.value;

    if (!no_project) {
      resultEl.textContent = 'Select a project.';
      return;
    }
    if (!file) {
      resultEl.textContent = 'Select file .xlsx.';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('no_project', no_project);

    resultEl.textContent = 'Loading...';

    try {
      const res = await fetch(`${BASE}/bom`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!res.ok) {
        resultEl.textContent = 'Server responded with error: ' + (data.message || res.status);
        return;
      }
      resultEl.textContent = data.message || 'Subida completada correctamente.';
      //Limpia el input para que no se mande el archivo multiples veces
      fileInputEl.value = '';
      projectSearchInput.value = '';
      projectSelectHidden.value = '';
    } catch (err) {
      resultEl.textContent = 'Error loading file: ' + err.message;
    }
  });
});