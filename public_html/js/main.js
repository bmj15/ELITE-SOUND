// URL base da API (ajuste conforme seu ambiente)
const API_BASE = 'http://localhost:5000/api';

// Função para carregar os equipamentos do catálogo
async function loadEquipments() {
  try {
    const response = await fetch(`${API_BASE}/equipments`);
    if (!response.ok) {
      throw new Error('Erro ao carregar equipamentos');
    }
    const equipments = await response.json();
    renderEquipments(equipments);
  } catch (error) {
    console.error('Erro:', error);
    document.getElementById('equipment-list').innerHTML = '<p>Não foi possível carregar o catálogo.</p>';
  }
}

// Função para renderizar os equipamentos na página
function renderEquipments(equipments) {
  const equipmentList = document.getElementById('equipment-list');
  equipmentList.innerHTML = ''; // Limpa o conteúdo

  equipments.forEach(eq => {
    const card = document.createElement('div');
    card.className = 'equipment-card';
    card.innerHTML = `
      <h3>${eq.name}</h3>
      <p>${eq.description}</p>
      <p><strong>Preço por dia:</strong> €${eq.price_day}</p>
      <a href="order.html?equipmentId=${eq.id}" class="btn">Reservar</a>
    `;
    equipmentList.appendChild(card);
  });
}

// Carrega os equipamentos ao carregar a página
document.addEventListener('DOMContentLoaded', loadEquipments);
