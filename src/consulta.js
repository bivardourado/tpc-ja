import './style.css';
import './header-fullwidth.css';
import ConsultaEscala from './components/ConsultaEscala.js';
import { getFooter } from './components/Footer.js';
import { getHeader } from './components/Header.js';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './services/firebase.js';

const app = document.querySelector('#app');

// Função para verificar senha
async function verificarSenha() {
  // Verifica se já foi autenticado via parâmetro URL
  const urlParams = new URLSearchParams(window.location.search);
  const isAuthenticated = urlParams.get('auth') === 'true';

  if (isAuthenticated) {
    // Já foi autenticado, remove o parâmetro da URL sem recarregar
    window.history.replaceState({}, '', '/consulta');
    return true;
  }

  const senha = prompt('🔐 Digite a senha para acessar a consulta de escala:');

  if (!senha) {
    // Usuário cancelou - redireciona para /form
    window.location.href = '/form';
    return false;
  }

  try {
    const passwordsToTry = [
      { key: 'senhaAtualizacao', def: 'tpubli2026' },
      { key: 'senhaCadastro', def: 'tpubli2026' },
      { key: 'senhaAcesso', def: 'tpubli2026' }
    ];

    let isMatch = false;

    for (const item of passwordsToTry) {
      const configRef = doc(db, 'configuracoes', item.key);
      const configSnap = await getDoc(configRef);
      let correctPassword = '';

      if (configSnap.exists() && configSnap.data().senha) {
        correctPassword = String(configSnap.data().senha).trim();
      } else {
        correctPassword = item.def;
      }

      if (senha.trim().toLowerCase() === correctPassword.toLowerCase()) {
        isMatch = true;
        break; // Achou um match, pode sair do loop
      }
    }

    if (isMatch) {
      return true;
    } else {
      alert('❌ Senha incorreta.');
      window.location.href = '/form';
      return false;
    }
  } catch (error) {
    console.error('Erro ao verificar senha:', error);
    alert('❌ Erro ao verificar senha.');
    window.location.href = '/form';
    return false;
  }
}

// Verifica senha antes de renderizar
async function inicializar() {
  const senhaCorreta = await verificarSenha();

  if (!senhaCorreta || !app) {
    return;
  }

  app.innerHTML = `
    ${getHeader('consulta', 'Minha Escala')}
    <div class="dashboard-header">
      <h1>Consultar Minha Escala</h1>
      <p style="color: var(--text-secondary);">Digite seu telefone para ver suas designações do mês.</p>
    </div>
    <div id="consulta-container"></div>
    
    ${getFooter()}
  `;

  // Monta o componente de consulta
  new ConsultaEscala('#consulta-container');
}

// Inicia a aplicação
inicializar();
