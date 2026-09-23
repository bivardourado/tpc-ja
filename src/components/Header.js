import { AuthService } from '../services/auth.js';

/**
 * Retorna o HTML do header com dropdown de perfil
 * @param {string} activePage - Página ativa
 * @param {string} pageTitle - Título da página
 * @returns {string} HTML do header
 */
export function getHeader(activePage = '', pageTitle = '') {
    return `
        <header class="main-header">
            <div class="header-container">
                <div class="header-left">
                    <a href="/" class="logo-area">
                        <div class="logo-box">TPUBLI</div>
                    </a>
                    ${pageTitle ? `<div class="header-page-title">${pageTitle}</div>` : `
                        <nav class="header-nav">
                            ${['admin', 'participantes', 'locais', 'monitoramento', 'auditoria', 'acesso'].includes(activePage) ? `
                                <a href="/admin" ${activePage === 'admin' ? 'class="active"' : ''}>Escalas</a>
                                <a href="/participantes" ${activePage === 'participantes' ? 'class="active"' : ''}>Participantes</a>
                                <a href="/locais" ${activePage === 'locais' ? 'class="active"' : ''}>Locais</a>
                                <a href="/monitoramento" ${activePage === 'monitoramento' ? 'class="active"' : ''}>Monitoramento</a>
                                <a href="/auditoria" ${activePage === 'auditoria' ? 'class="active"' : ''}>Auditoria</a>
                                <a href="/acesso" ${activePage === 'acesso' ? 'class="active"' : ''}>Acesso</a>
                            ` : `
                                <a href="/form" ${activePage === 'form' ? 'class="active"' : ''}>Cadastro</a>
                                <a href="/atualizar" ${activePage === 'atualizar' ? 'class="active"' : ''}>Atualizar</a>
                                <a href="/consulta" ${activePage === 'consulta' ? 'class="active"' : ''}>Minha Escala</a>
                            `}
                        </nav>
                    `}
                </div>

                <div class="header-right">
                    <!-- Dropdown de perfil -->
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
        ${(pageTitle && pageTitle !== 'Página inicial') ? `
            <div class="header-breadcrumb">
                <a href="/" class="back-link">
                    <span class="back-icon">‹</span> Página inicial
                </a>
            </div>
        ` : ''}
    `;
}

/**
 * Inicializa o comportamento do header (dropdown e logout)
 */
export function initHeader() {
    const userProfileBtn = document.getElementById('user-profile-btn');
    const userDropdownMenu = document.getElementById('user-dropdown-menu');
    const btnLogout = document.getElementById('btn-logout-dropdown');
    const userAvatar = /** @type {HTMLImageElement} */ (document.getElementById('user-avatar'));
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');

    // Carregar informações do usuário
    AuthService.onAuthStateChanged((/** @type {any} */ user) => {
        if (user) {
            if (userAvatar) {
                userAvatar.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email || 'User');
            }
            if (userName) {
                userName.textContent = user.displayName || user.email?.split('@')[0] || 'Usuário';
            }
            if (userEmail) {
                userEmail.textContent = user.email || '';
            }
        }
    });

    // Toggle dropdown
    if (userProfileBtn && userDropdownMenu) {
        userProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = userDropdownMenu.style.display === 'block';
            userDropdownMenu.style.display = isVisible ? 'none' : 'block';
        });

        // Fechar dropdown ao clicar fora
        document.addEventListener('click', () => {
            userDropdownMenu.style.display = 'none';
        });

        userDropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Logout
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (confirm('Deseja realmente sair?')) {
                await AuthService.logout();
                window.location.href = '/';
            }
        });
    }
}
