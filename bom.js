document.addEventListener('DOMContentLoaded', () => {
  const uploadMessage = document.getElementById('uploadMessage');
  const resultEl = document.getElementById('result');

  // URL del backend
  const BASE = 'http://localhost:3000/api';

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
      //Limpiar el formulario después de 3 segundos
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
        uploadMessage.innerHTML = '';
      }, 3000);
    } catch (err) {
      uploadMessage.innerHTML = `
        <div class="alert alert-danger py-1">Connection error: ${err.message}</div>`;
    }
  });
});
