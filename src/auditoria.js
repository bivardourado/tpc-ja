import './style.css';
import './header-fullwidth.css';
import { initHeader, getHeader } from './components/Header.js';
import { AuthService } from './services/auth.js';
import ScaleAudit from './components/ScaleAudit.js';

const app = document.querySelector('#app');
if (app) {
  app.innerHTML = `
    ${getHeader('auditoria', 'Auditoria')}
    <main class="container">
      <div id="audit-component"></div>
    </main>
  `;
}

initHeader();

// Verificar autenticação antes de carregar
AuthService.onAuthStateChanged((/** @type {any} */ user) => {
  if (!user) {
    window.location.href = '/'; // Redireciona para login se não estiver logado
  } else {
    // Inicializa o componente de auditoria
    new ScaleAudit('#audit-component');
  }
});
