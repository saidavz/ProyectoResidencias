document.addEventListener('DOMContentLoaded', () => {
  const uploadMessage = document.getElementById('uploadMessage');
  const resultEl = document.getElementById('result');

  // URL del backend
  const BASE = 'http://localhost:3000/api';

  // Cargar proyectos existentes para autocompletado
  let existingProjects = [];

  async function loadExistingProjects() {
    try {
      const response = await fetch(`${BASE}/projects/all`);
      if (response.ok) {
        existingProjects = await response.json();
        console.log('Proyectos cargados:', existingProjects.length);
      } else {
        console.error('Error al obtener proyectos, status:', response.status);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    }
  }

  // Actualizar sugerencias del datalist
  function updateProjectSuggestions(searchText) {
    const datalist = document.getElementById('projectNumberList');
    datalist.innerHTML = '';

    if (searchText.length > 0) {
      const filtered = existingProjects.filter(p => 
        p.no_project.toLowerCase().startsWith(searchText.toLowerCase())
      );

      console.log('Buscando:', searchText, 'Encontrados:', filtered.length);

      filtered.forEach(project => {
        const option = document.createElement('option');
        option.value = project.no_project;
        option.textContent = `${project.no_project} - ${project.name_project}`;
        datalist.appendChild(option);
      });
    }
  }

  // Event listener para el campo de número de proyecto
  const noProjectInput = document.getElementById('no_project');
  noProjectInput.addEventListener('input', (e) => {
    const value = e.target.value;
    updateProjectSuggestions(value);

    // Buscar proyecto coincidente y autocompletar nombre
    const matchedProject = existingProjects.find(p => p.no_project === value);
    if (matchedProject) {
      document.getElementById('name_project').value = matchedProject.name_project;
    }
  });

  // Cargar proyectos al iniciar
  loadExistingProjects();

  // Subir el BOM y registrar el proyecto
  document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadMessage.innerHTML = '';

    const no_project = document.getElementById('no_project').value.trim();
    const name_project = document.getElementById('name_project').value.trim();
    const status = 'Active'; //Status del proyecto por defecto
    const fileInputEl = document.getElementById('fileinput');
    const file = fileInputEl.files[0];

    // Validar campos obligatorios
    if (!no_project || !name_project) {
      uploadMessage.innerHTML = `
        <div class="alert alert-warning py-1">All fields are required.</div>`;
      return;
    }
    if (!file) {
      uploadMessage.innerHTML = `
        <div class="alert alert-warning py-1">Select a file.</div>`;
      return;
    }
    try {
      //Verificar si el proyecto ya existe
      const checkRes = await fetch(`${BASE}/projects/check/${encodeURIComponent(no_project)}`);
      const checkData = await checkRes.json();
      if (checkData.exists) {
        //Verifica si el proyecto ya tiene un BOM asociado
        const confirmReplace = confirm(
          `This project already has a saved BOM. Do you want to replace it?`
        );
        if (!confirmReplace) {
          uploadMessage.innerHTML = `
            <div class="alert alert-info py-1">Canceled upload</div>`;
          return;
        }
        // Eliminación del BOM anterior antes de subir el nuevo
        await fetch(`${BASE}/bom/${encodeURIComponent(no_project)}`, {
          method: 'DELETE'
        });
      } else {
        // Si no existe, registrar el proyecto primero
        const projectRes = await fetch(`${BASE}/projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ no_project, name_project, status })
        });
        const projectData = await projectRes.json();
        if (!projectRes.ok) {
          uploadMessage.innerHTML = `
            <div class="alert alert-danger py-1">Error registering the project: ${projectData.message}</div>`;
          return;
        }
      }
      
      // Subir el archivo del BOM
      const formData = new FormData();
      formData.append('file', file);
      formData.append('no_project', no_project);
      const bomRes = await fetch(`${BASE}/bom`, {
        method: 'POST',
        body: formData,
      });
      const bomText = await bomRes.text();
      let bomData;
      try { bomData = JSON.parse(bomText); } catch { bomData = { message: bomText }; }
      
      if (!bomRes.ok) {
        uploadMessage.innerHTML = `
          <div class="alert alert-danger py-1">Error loading the BOM: ${bomData.message}</div>`;
        return;
      }
      
      uploadMessage.innerHTML = `
        <div class="alert alert-success py-1">The data has been successfully uploaded!</div>`;
      
      // Limpiar el formulario 
      setTimeout(() => {
        document.getElementById('no_project').value = '';
        document.getElementById('name_project').value = '';
        fileInputEl.value = '';
        // Resetear el overlay del archivo
        const overlay = document.querySelector('.upload-design-overlay');
        if (overlay) {
          overlay.classList.remove('file-selected');
          overlay.innerHTML = `
            <i class="bi bi-cloud-arrow-up-fill upload-icon mb-3"></i>
            <p class="drag-text">Drag and Drop here</p>
            <p class="or-text">or</p>
            <a href="#" class="browse-link" onclick="event.preventDefault(); document.getElementById('fileinput').click();">Browse files</a>
          `;
        }
        // Recargar lista de proyectos 
        loadExistingProjects();
      }, 3000);
    } catch (err) {
      uploadMessage.innerHTML = `
        <div class="alert alert-danger py-1">Connection error: ${err.message}</div>`;
    }
  });
});
