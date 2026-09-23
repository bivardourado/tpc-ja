import './style.css';
import './header-fullwidth.css';
import AccessControl from './components/AccessControl.js';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';

const app = document.querySelector('#app');

// Protege a rota antes de renderizar
protectRoute().then(() => {
  if (app) {
    app.innerHTML = `
      ${getHeader('acesso', 'Controle de Acesso')}
      
      <div class="dashboard-header">
        <h1>Controle de Acesso</h1>
        <p style="color: var(--text-secondary);">Gerencie quem pode acessar o sistema administrativo.</p>
      </div>

      <div id="access-control-container"></div>
      
      ${getFooter()}
    `;

    new AccessControl('#access-control-container');
    initHeader();
  }
});
