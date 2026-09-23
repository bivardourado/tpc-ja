import './style.css';
import './header-fullwidth.css';
import ScaleConfigurator from './components/ScaleConfigurator.js';
import ScaleViewer from './components/ScaleViewer.js';
import { getFooter } from './components/Footer.js';
import { protectRoute } from './utils/authGuard.js';
import { getHeader, initHeader } from './components/Header.js';


const app = document.querySelector('#app');

// Protege a rota antes de renderizar
protectRoute().then(() => {
  if (app) {
    app.innerHTML = `
      ${getHeader('admin', 'Escalas')}
      
      <div class="dashboard-header">
        <h1>Escalas</h1>
        <p style="color: var(--text-secondary);">Gerencie escalas </p>
      </div>

      <div class="dashboard-grid">
        <!-- Card: Gerar Nova Escala (Full Width - Sempre no topo) -->
        <div class="dashboard-card full-width">
          <div id="scale-configurator-container"></div>
        </div>

        <!-- Card: Visualizar Escalas (Full Width) -->
        <div class="dashboard-card full-width">
          <div id="scale-viewer-container"></div>
        </div>


      </div>
      
      ${getFooter()}
    `;

    // Monta o componente de configuração
    new ScaleConfigurator('#scale-configurator-container');

    // Monta o componente de visualização
    new ScaleViewer('#scale-viewer-container');



    // Inicializa o header (dropdown e logout)
    initHeader();
  } else {
    console.error('Elemento #app não encontrado!');
  }
});