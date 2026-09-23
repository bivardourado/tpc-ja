import { AuthService } from './services/auth.js';
import { getHeader, initHeader } from './components/Header.js';
import { protectRoute } from './utils/authGuard.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Renderizar Header com Título (Passando 'Página inicial' para o componente)
    const headerRender = document.getElementById('header-render');
    if (headerRender) {
        headerRender.innerHTML = getHeader('hub', 'Página inicial');
    }

    // 2. Proteger Rota e Carregar Dados do Usuário
    protectRoute().then(() => {
        AuthService.onAuthStateChanged((/** @type {any} */ user) => {
            if (!user) return; // protectRoute já lida com o login se não houver user

            // Exibir elementos agora que estamos autenticados
            document.body.style.visibility = 'visible';

            // Atualizar Saudação Central
            const greetAvatar = /** @type {HTMLImageElement | null} */ (document.getElementById('greet-avatar'));
            const greetName = document.getElementById('greet-name');
            const greetPrefix = document.getElementById('greet-prefix');

            if (user.displayName) {
                const firstName = user.displayName.split(' ')[0].toLowerCase();
                if (greetName) greetName.textContent = firstName;
            }

            if (greetAvatar && user.photoURL) {
                greetAvatar.src = user.photoURL;
                greetAvatar.style.display = 'block';
            }

            // Determinar Bom dia / Boa tarde / Boa noite
            const hour = new Date().getHours();
            let prefix = "Bom dia,";
            if (hour >= 12 && hour < 18) prefix = "Boa tarde,";
            else if (hour >= 18 || hour < 5) prefix = "Boa noite,";

            if (greetPrefix) greetPrefix.textContent = prefix;
        });
    });

    // 3. Inicializar Comportamentos do Header
    initHeader();
});

