import './style.css';
import './header-fullwidth.css';
import LocationManager from './components/LocationManager.js';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';

const app = document.querySelector('#app');

// Protege a rota antes de renderizar
protectRoute().then(() => {
  if (app) {
    app.innerHTML = `
      ${getHeader('locais', 'Locais')}
     <div class="dashboard-header">
        <h1>Gerencie Locais</h1>
        <p style="color: var(--text-secondary);">Insira e/ou exclua locais.  </p>
      </div>
      <div id="consulta-container"></div>

      <div id="location-manager-container"></div>

      ${getFooter()}
    `;

    // Monta o componente de gerenciamento de locais
    new LocationManager('#location-manager-container');

    // Inicializa o header (dropdown e logout)
    initHeader();
  } else {
    console.error('Elemento #app não encontrado!');
  }
});
