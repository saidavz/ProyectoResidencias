document.addEventListener('DOMContentLoaded', () => {
  const projectSearchInput = document.getElementById('projectSearch');
  const projectSuggestions = document.getElementById('projectSuggestions');
  const projectSelectHidden = document.getElementById('projectSelect');
  const resultEl = document.getElementById('result');

  // URL del backend
  const BASE = 'http://localhost:3000/api';

  // Normalizar texto (para búsquedas)
  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // ======== REGISTRO DE PROYECTOS ===========
  const projectForm = document.getElementById('projectForm');
  const projectMessage = document.getElementById('projectMessage');

  projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const no_project = document.getElementById('no_project').value.trim();
    const name_project = document.getElementById('name_project').value.trim();
    const status = document.getElementById('status').value.trim();

    projectMessage.innerHTML = "";

    if (!no_project || !name_project || !status) {
      projectMessage.innerHTML = `
        <div class="alert alert-warning py-1">Fill all fields</div>
      `;
      return;
    }

    try {
      const res = await fetch(`${BASE}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ no_project, name_project, status })
      });

      const data = await res.json();

      if (!res.ok) {
        projectMessage.innerHTML = `
          <div class="alert alert-danger py-1">${data.message || "Error saving project"}</div>
        `;
        return;
      }

      projectMessage.innerHTML = `
        <div class="alert alert-success py-1">Project registered successfully</div>
      `;

      document.getElementById('no_project').value = "";
      document.getElementById('name_project').value = "";
      document.getElementById('status').value = "";

    } catch (err) {
      projectMessage.innerHTML = `
        <div class="alert alert-danger py-1">${err.message}</div>
      `;
    }
  });

  // ======== BUSCADOR DE PROYECTOS ACTIVOS ===========
  projectSearchInput.addEventListener('input', async () => {
    const term = normalizeText(projectSearchInput.value.trim());

    if (!term) {
      projectSuggestions.style.display = 'none';
      return;
    }

    try {
      const res = await fetch(`${BASE}/projects/active`);
      const allProjects = await res.json();

      const filtered = allProjects.filter(p => {
        const pname = normalizeText(p.name_project || '');
        const pid = normalizeText((p.no_project || '').toString());
        if (pname.includes('sin asignar')) return false;
        return pname.includes(term) || pid.includes(term);
      });

      const filteredProjects = filtered.sort((a, b) => {
        const aname = normalizeText(a.name_project || '');
        const aid = normalizeText((a.no_project || '').toString());
        const bname = normalizeText(b.name_project || '');
        const bid = normalizeText((b.no_project || '').toString());

        const aStarts = aname.startsWith(term) || aid.startsWith(term);
        const bStarts = bname.startsWith(term) || bid.startsWith(term);

        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

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

  // Ocultar sugerencias si se hace click fuera
  document.addEventListener('click', (e) => {
    if (e.target !== projectSearchInput && e.target !== projectSuggestions) {
      projectSuggestions.style.display = 'none';
    }
  });

  // ========= SUBIR BOM ==========
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    resultEl.innerHTML = '';

    const fileInputEl = document.getElementById('fileinput');
    const file = fileInputEl.files[0];
    const no_project = projectSelectHidden.value;

    if (!no_project) {
      resultEl.innerHTML = `
        <div class="alert alert-warning py-1">Select project</div>`;
      return;
    }

    if (!file) {
      resultEl.innerHTML = `
        <div class="alert alert-warning py-1">Select file</div>`;
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('no_project', no_project);

    try {
      const res = await fetch(`${BASE}/bom`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (!res.ok) {
        resultEl.innerHTML = `
          <div class="alert alert-danger py-1">Error: ${data.message}</div>`;
        return;
      }

      resultEl.innerHTML = `
        <div class="alert alert-success py-1">Successfully uploaded</div>`;

      setTimeout(() => {
        fileInputEl.value = '';
        projectSearchInput.value = '';
        projectSelectHidden.value = '';
      }, 4000);

    } catch (err) {
      resultEl.innerHTML = `
        <div class="alert alert-danger py-1">Error: ${err.message}</div>`;
    }
  });
});
