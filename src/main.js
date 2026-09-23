import './style.css';
import './header-fullwidth.css';
import Formulario from './components/Formulario.js';
import { getFooter } from './components/Footer.js';
import { initHeader } from './components/Header.js';

const app = document.querySelector('#app');

if (app) {
  app.innerHTML = `
    <header class="main-header">
      <div class="header-container">
        <div class="header-left">
          <a href="/" class="logo-area">
            <div class="logo-box">TPUBLI</div>
          </a>
          <nav class="header-nav">
            <a href="/form" class="active">Cadastro</a>
            <a href="/atualizar">Atualizar</a>
            <a href="/consulta">Minha Escala</a>
          </nav>
        </div>

        <div class="header-right">
          <div class="user-profile-dropdown">
            <button class="user-profile-btn" id="user-profile-btn" aria-label="Menu do usuário">
              <img id="user-avatar" src="" alt="Avatar" class="user-avatar">
            </button>
            <div class="user-dropdown-menu" id="user-dropdown-menu" style="display: none;">
              <div class="user-info">
                <div class="user-name" id="user-name">Carregando...</div>
                <div class="user-email" id="user-email"></div>
              </div>
              <button class="btn-logout-dropdown" id="btn-logout-dropdown">Sair</button>
            </div>
          </div>
        </div>
      </div>
    </header>
    
    <div class="dashboard-header">
      <h1>Formulário de Disponibilidade</h1>
      <p style="color: var(--text-secondary);">Preencha seus dados e informe sua disponibilidade para servir no TPUBLI.</p>
    </div>

    <div class="dashboard-grid">
      <!-- Card: Formulário de Disponibilidade (Full Width) -->
      <div class="dashboard-card full-width">
        <div id="formulario-container"></div>
      </div>
    </div>
    
    ${getFooter()}
  `;

  // Monta o componente do formulário no container em modo 'create'
  new Formulario('#formulario-container', { mode: 'create' });

  // Inicializa o dropdown de perfil
  initHeader();
} else {
  console.error('Elemento #app não encontrado!');
}