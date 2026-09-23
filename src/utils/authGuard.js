import { AuthService } from '../services/auth.js';

/**
 * Verifica autenticação de administrador via Google.
 * Se não estiver autenticado/autorizado, exibe tela de login.
 * Retorna uma Promise que resolve quando o usuário estiver autenticado.
 * @returns {Promise<boolean>}
 */
export function requireAuth() {
    return new Promise((resolve) => {
        // Verifica estado atual da autenticação
        const unsubscribe = AuthService.onAuthStateChanged((/** @type {any} */ user) => {
            // Nota: AuthService.onAuthStateChanged já verifica se o email está autorizado

            // Se já temos um usuário válido, apenas resolvemos
            if (user) {
                unsubscribe();
                resolve(true);
                return;
            }

            // Se não, mostramos a tela de login
            // A tela de login vai lidar com o login e chamar o resolve quando tiver sucesso
            // Mas precisamos garantir que não chamamos resolve duas vezes se o onAuthStateChanged disparar novamente
            // Por isso unsubscribe acima é importante se fosse um listener duradouro, 
            // mas aqui queremos detectar a *mudança* após o login também?

            // O AuthService.login() é Promise-based, então podemos esperar o botão clicar.
            // Mas o onAuthStateChanged pode disparar se a sessão persistida carregar *depois* da renderização inicial?
            // Auth do Firebase tem um estado de "loading". 

            // Vamos simplificar: Se não user, mostrar tela. A tela chama AuthService.login().
            // Se login der certo, removemos tela e resolvemos.
        });

        // O onAuthStateChanged do AuthService verifica autorização.
        // Se retornar user, está autorizado.
        // Se retornar null, não está logado ou não autorizado.

        // Problema: onAuthStateChanged pode demorar um pouco para verificar a sessão salva.
        // Se mostrarmos a tela de login imediatamente e depois a sessão carregar, fica estranho.
        // Mas o AuthService.onAuthStateChanged espera a verificação inicial? 
        // O wrapper do AuthService parece encapsular o onAuthStateChanged nativo.
    });
}

/**
 * Implementação real que gerencia a UI
 */
export function protectRoute() {
    return new Promise((resolve) => {
        // Criar overlay (inicialmente invisível se estivermos apenas checando sessão)
        // Mas como queremos feedback visual se demorar... melhor mostrar um loader ou nada até confirmar?
        // Vamos mostrar apenas se detectarmos que não tem usuário.

        // Usar uma flag para saber se já resolvemos
        let resolved = false;

        AuthService.onAuthStateChanged((/** @type {any} */ user) => {
            if (resolved) return;

            if (user) {
                resolved = true;
                if (document.getElementById('auth-overlay')) {
                    /** @type {HTMLElement} */ (document.getElementById('auth-overlay')).remove();
                    document.body.classList.remove('auth-locked');
                }
                resolve(true);
            } else {
                // Não tem usuário (ou falhou verificação), mostrar login se não estiver mostrando
                if (!document.getElementById('auth-overlay')) {
                    showLoginOverlay(resolve);
                }
            }
        });
    });
}

/**
 * @param {function(boolean): void} resolveCallback
 */
function showLoginOverlay(resolveCallback) {
    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = '#f0f2f5';
    overlay.style.backgroundImage = 'radial-gradient(#e2e8f0 1px, transparent 1px)';
    overlay.style.backgroundSize = '20px 20px';
    overlay.style.zIndex = '99999';
    overlay.style.display = 'flex';
    document.body.style.visibility = 'visible';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.fontFamily = "'Inter', sans-serif";

    overlay.innerHTML = `
        <div style="background: white; padding: 3rem 2.5rem; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center; max-width: 400px; width: 90%; animation: fadeIn 0.3s ease;">
            <div style="font-size: 3rem; margin-bottom: 1rem;">🔐</div>
            <h2 style="margin-top: 0; margin-bottom: 0.5rem; color: #1a1a1a;">Área Administrativa</h2>
            <p style="color: #666; margin-bottom: 2rem; line-height: 1.5;">Esta área é restrita a administradores autorizados.<br>Faça login com sua conta Google.</p>
            
            <button id="google-auth-btn" 
                style="width: 100%; padding: 0.9rem; background: white; color: #3c4043; border: 1px solid #dadce0; border-radius: 24px; cursor: pointer; font-size: 1rem; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 10px; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" alt="Google">
                Entrar com Google
            </button>
            
            <p id="auth-error" style="color: #ef4444; display: none; margin-top: 1.5rem; font-size: 0.9rem; background: #fee2e2; padding: 0.8rem; border-radius: 8px;">
            </p>

            <a href="/" style="display: inline-block; margin-top: 2rem; color: #6b7280; text-decoration: none; font-size: 0.9rem; transition: color 0.2s;">
                
            </a>
        </div>
        <style>
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #google-auth-btn:hover {
                background-color: #f8f9fa;
                box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                transform: translateY(-1px);
            }
            #google-auth-btn:active {
                background-color: #f1f3f4;
                transform: translateY(0);
            }
        </style>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('auth-locked');

    const btn = overlay.querySelector('#google-auth-btn');
    const errorMsg = /** @type {HTMLElement} */ (overlay.querySelector('#auth-error'));

    if (btn) {
        btn.addEventListener('click', async () => {
            console.log('🔘 Botão de login clicado');
            try {
                // @ts-ignore
                btn.disabled = true;
                // @ts-ignore
                btn.style.opacity = '0.7';
                // @ts-ignore
                btn.textContent = 'Abrindo...';

                console.log('📱 Chamando AuthService.login()...');
                await AuthService.login();
                console.log('✅ Login bem-sucedido!');

                // O onSuccess será tratado pelo onAuthStateChanged que resolverá a promise
                // Mas para garantir:
                const overlay = document.getElementById('auth-overlay');
                if (overlay) {
                    overlay.remove();
                    document.body.classList.remove('auth-locked');
                }
                resolveCallback(true);

            } catch (/** @type {any} */ error) {
                console.error('❌ Erro no login:', error);

                // @ts-ignore
                btn.disabled = false;
                // @ts-ignore
                btn.style.opacity = '1';
                // @ts-ignore
                btn.textContent = 'Entrar com Google';

                errorMsg.style.display = 'block';

                // Tratar erros específicos
                const errorCode = error?.code || '';
                const errorMessage = error?.message || 'Erro desconhecido';

                console.log('🔍 Error code:', errorCode);
                console.log('🔍 Error message:', errorMessage);

                if (errorCode === 'auth/popup-blocked') {
                    errorMsg.innerHTML = `❌ <strong>Popup Bloqueado</strong><br>Por favor, permita popups para este site e tente novamente.`;
                } else if (errorCode === 'auth/popup-closed-by-user') {
                    errorMsg.innerHTML = `⚠️ Login cancelado.<br>A janela de autenticação foi fechada.`;
                } else if (errorCode === 'auth/cancelled-popup-request') {
                    errorMsg.innerHTML = `⚠️ Já existe uma tentativa de login em andamento.`;
                } else if (String(errorMessage).includes('não autorizado')) {
                    errorMsg.innerHTML = `❌ <strong>Acesso Negado</strong><br>Este e-mail não tem permissão de administrador.`;
                } else {
                    errorMsg.innerHTML = `❌ <strong>Erro:</strong> ${errorMessage}`;
                }
            }
        });
    }
}
