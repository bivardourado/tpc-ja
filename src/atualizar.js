import './style.css';
import './header-fullwidth.css';
import Formulario from './components/Formulario.js';
import { getFooter } from './components/Footer.js';
import { getHeader, initHeader } from './components/Header.js';

const app = document.querySelector('#app');

if (app) {
  app.innerHTML = `
    ${getHeader('atualizar', 'Atualização')}
    
    <div class="dashboard-header">
      <h1>Atualização Cadastral</h1>
      <p style="color: var(--text-secondary);">Mantenha seus dados e disponibilidades sempre em dia.</p>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-card full-width">
        <div id="formulario-container"></div>
      </div>
    </div>
    
    ${getFooter()}
  `;

  // Inicializa o formulário em modo 'update'
  new Formulario('#formulario-container', { mode: 'update' });

  // Inicializa o dropdown de perfil
  initHeader();
} else {
  console.error('Elemento #app não encontrado!');
}
