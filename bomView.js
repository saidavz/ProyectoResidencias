 document.addEventListener('DOMContentLoaded', function() {
    loadBOMData();
  });

  async function loadBOMData() {
    try {
      const response = await fetch('http://localhost:3000/api/bomView'); 
      const data = await response.json();
      console.log("Datos recibidos:", data); 
      displayBOMData(data);
    } catch (error) {
      console.error('Error loading BOM:', error);
      document.getElementById('bomTableBody').innerHTML = 
        '<tr><td colspan="10" class="text-center text-danger">Error loading data</td></tr>';
    }
  }

  function displayBOMData(data) {
    const tbody = document.getElementById('bomTableBody');
    
    if (data.length === 0) {
      tbody.innerHTML = '<tr><td colspan=7" class="text-center">No BOM found</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    data.forEach(item => {
      const row = `
        <tr>
          <td>${item.name_project}</td>
          <td>${item.type_p}</td>
          <td>${item.no_part}</td>
          <td>${item.description}</td>
          <td>${item.brand}</td>
          <td ${item.quantity}</td>
          <td>${item.unit}</td>
          <td>${item.quantity_requested}</td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  }
