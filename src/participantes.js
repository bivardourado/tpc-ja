import './style.css';
import './header-fullwidth.css';
import ParticipantList from './components/ParticipantList.js';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';

const app = document.querySelector('#app');

// Protege a rota antes de renderizar
protectRoute().then(() => {
  if (app) {
    app.innerHTML = `
      ${getHeader('participantes', 'Participantes')}
      
      <div class="dashboard-header">
        <h1>Gerenciar Participantes</h1>
        <p style="color: var(--text-secondary);">Visualize e gerencie todos os participantes cadastrados.</p>
      </div>

      <div class="dashboard-grid">
        <!-- Card: Lista de Participantes (Full Width) -->
        <div class="dashboard-card full-width">
          <div id="participant-list-container"></div>
        </div>
      </div>
      
      ${getFooter()}
    `;

    // Monta o componente de lista de participantes
    new ParticipantList('#participant-list-container');

    // Inicializa o header (dropdown e logout)
    initHeader();
  } else {
    console.error('Elemento #app não encontrado!');
  }
});
