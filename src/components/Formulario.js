// Importa as funções necessárias do Firebase para salvar dados
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from '../services/firebase.js';
import { cache } from '../services/CacheService.js';

export default class Formulario {
  /**
   * @param {string} containerId
   * @param {{ mode: 'create' | 'update' }} options
   */
  constructor(containerId, options = { mode: 'create' }) {
    this.containerId = containerId;
    this.mode = options.mode; // 'create' ou 'update'
    this.editingId = new URLSearchParams(window.location.search).get('id');
    this.passwordVerified = false;
    /** @type {Array<{id: string, nome: string, telefone: string, genero: string}>} */
    this.allParticipants = [];

    // Verificar se já foi autenticado via parâmetro URL
    const urlParams = new URLSearchParams(window.location.search);
    const isAuthenticated = urlParams.get('auth') === 'true';

    // Se está editando via URL (admin), pula a senha e força modo update
    if (this.editingId) {
      this.mode = 'update';
      this.passwordVerified = true;
      this.render();
      this.bindEvents();
      this.loadParticipant(this.editingId);
    } else if (isAuthenticated) {
      // Se já foi autenticado via URL, pula a senha
      this.passwordVerified = true;
      this.render();
      this.bindEvents();
    } else {
      // Se está em modo 'create', mostra modal de escolha inicial
      if (this.mode === 'create') {
        this.showChoiceModal();
      } else {
        // Mostra tela de senha para modo update
        this.renderPasswordScreen();
      }
    }

    this.loadAllParticipants();
  }

  async loadAllParticipants() {
    try {
      // Usa cache para evitar carregar todos os participantes toda vez
      // TTL: 1 hora (60 min) - Permite ver novos cadastros mais rapidamente
      const participants = await cache.cachedGetDocs(
        async () => await getDocs(collection(db, "Pessoas")),
        'all_participants',
        60 // 1 hora
      );

      this.allParticipants = participants.map(/** @param {any} p */(p) => ({
        id: p.id,
        nome: p.nome,
        telefone: p.telefone,
        genero: p.genero
      }));

      console.log('👥 Participantes carregados para autocomplete:', this.allParticipants.length);
    } catch (error) {
      console.error("Erro ao carregar lista de participantes:", error);
    }
  }

  renderPasswordScreen() {
    const container = document.querySelector(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="password-screen">
        <div class="password-card">
          <h2>🔐 ${this.mode === 'create' ? 'Novo Cadastro' : 'Atualizar Dados'}</h2>
          <p>Digite a senha de <strong>${this.mode === 'create' ? 'ACESSO' : 'ATUALIZAÇÃO'}</strong>:</p>
          <div class="form-group">
            <input type="password" id="access-password" placeholder="Digite a senha" autocomplete="off">
          </div>
          <button type="button" id="verify-password-btn" class="btn-primary">Verificar Senha</button>
          <p class="password-hint">💡 Solicite a senha no grupo do WhatsApp</p>
        </div>
      </div>
    `;

    // Bind do botão de verificação
    const verifyBtn = document.getElementById('verify-password-btn');
    const passwordInput = /** @type {HTMLInputElement} */ (document.getElementById('access-password'));

    if (verifyBtn && passwordInput) {
      // Permitir Enter para verificar
      passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          verifyBtn.click();
        }
      });

      verifyBtn.addEventListener('click', async () => {
        const enteredPassword = passwordInput.value.trim();

        if (!enteredPassword) {
          alert('⚠️ Por favor, digite a senha.');
          return;
        }

        try {
          const passwordsToTry = [
            { key: this.mode === 'create' ? 'senhaCadastro' : 'senhaAtualizacao', def: this.mode === 'create' ? 'tpubli2026' : 'tpubli2026' },
            { key: this.mode === 'create' ? 'senhaAtualizacao' : 'senhaCadastro', def: this.mode === 'create' ? 'tpubli2026' : 'tpubli2026' },
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

            if (enteredPassword.toLowerCase() === correctPassword.toLowerCase()) {
              isMatch = true;
              break;
            }
          }

          if (isMatch) {
            this.passwordVerified = true;
            this.render();
            this.bindEvents();
          } else {
            alert('❌ Senha incorreta.');
            passwordInput.value = '';
            passwordInput.focus();
          }
        } catch (error) {
          console.error('Erro ao verificar senha:', error);
          alert('❌ Erro ao verificar senha. Tente novamente.');
        }
      });
    }
  }

  render() {
    // Versão com dois cards lado a lado
    const container = document.querySelector(this.containerId);
    if (!container) return;

    const title = this.editingId
      ? 'Editar Disponibilidade'
      : (this.mode === 'create' ? 'Novo Cadastro' : 'Localizar Meu Cadastro');

    const btnText = this.editingId
      ? 'Salvar Alterações'
      : (this.mode === 'create' ? 'Enviar Minha Disponibilidade' : 'Atualizar Dados');

    container.innerHTML = `
      <form id="disponibilidade-form">
        <div class="form-cards-container">
          <!-- Card 1: Dados Pessoais -->
          <div class="form-card">
            <h2>${title}</h2>
            
            ${this.mode === 'update' && !this.editingId ? `
            <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border-left: 4px solid #2196f3;">
                <p style="margin: 0; color: #0d47a1;">🔍 <strong>Modo de Atualização:</strong><br>Comece digitando seu nome completo abaixo para localizar seus dados.</p>
            </div>
            ` : ''}

            <div class="form-group"><label for="telefone">Telefone/WhatsApp:</label><input type="tel" id="telefone" required placeholder="Digite seu telefone"></div>
            <div class="form-group">
              <label for="nome">Nome Completo:</label>
              <input type="text" id="nome" required autocomplete="off" placeholder="${this.mode === 'update' ? 'Digite para buscar...' : 'Seu nome completo'}">
              <ul id="suggestions-list" class="suggestions-list" style="display: none;"></ul>
            </div>
            <div class="form-group"><label for="email">E-mail (Opcional):</label><input type="email" id="email"></div>
            <div class="form-group"><label for="genero">Gênero:</label><select id="genero" required><option value="">Selecione...</option><option value="Masculino">Masculino</option><option value="Feminino">Feminino</option></select></div>
            <div class="form-group"><label for="congregacao">Congregação:</label><input type="text" id="congregacao" placeholder="Ex: Petrolina Centro" required></div>
            <div class="form-group">
              <label for="conjuge">Esposa (se também estiver no TPUBLI):</label>
              <input type="text" id="conjuge" placeholder="Nome da esposa" autocomplete="off">
              <ul id="conjuge-suggestions-list" class="suggestions-list" style="display: none;"></ul>
            </div>
            <div class="form-group">
              <label for="frequencia-maxima">Quantas vezes você pode participar? (0 ou vazio para não participar):</label>
              <input type="number" id="frequencia-maxima" min="0" max="30" placeholder="Ex: 2 (Deixe 0 para apenas cadastro)">
            </div>
            <div class="form-group checkbox-group" style="margin: 15px 0; padding: 1rem; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
              <input type="checkbox" id="indisponivel-proximo-mes" style="width: 18px; height: 18px; margin-right: 10px;">
              <label for="indisponivel-proximo-mes" style="font-size: 0.95rem; color: #856404; cursor: pointer; font-weight: 500;">
                ⚠️ Não poderei participar no próximo mês
              </label>
            </div>
            <div class="form-group checkbox-group" style="margin: 15px 0; padding: 1rem; background-color: #d1ecf1; border-left: 4px solid #17a2b8; border-radius: 4px;">
              <input type="checkbox" id="excecao-semanal" style="width: 18px; height: 18px; margin-right: 10px;">
              <label for="excecao-semanal" style="font-size: 0.95rem; color: #0c5460; cursor: pointer; font-weight: 500;">
                ⭐ Pode ser escalado mais de uma vez na mesma semana
              </label>
            </div>
          </div>

          <!-- Card 2: Disponibilidade -->
          <div class="form-card">
            <h2>Disponibilidade</h2>
            <p class="availability-hint">Marque os dias e períodos em que você pode servir:</p>
            <div class="weekly-config">
              ${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((dia, index) => {
      const diaLower = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'][index];
      return `
                  <div class="day-row">
    <span class="day-label">${dia}</span>
    <div class="shifts-options" style="display: flex; flex-wrap: wrap; gap: 10px;">
      <label for="${diaLower}-manha-08:30-10:30"><input type="checkbox" id="${diaLower}-manha-08:30-10:30" name="disponibilidade" value="${diaLower}-manha-08:30-10:30"> Manhã (08:30-10:30)</label>
      <label for="${diaLower}-manha-10-12"><input type="checkbox" id="${diaLower}-manha-10-12" name="disponibilidade" value="${diaLower}-manha-10-12"> Manhã (10-12)</label>
      <label for="${diaLower}-tarde-14-16"><input type="checkbox" id="${diaLower}-tarde-14-16" name="disponibilidade" value="${diaLower}-tarde-14-16"> Tarde (14-16)</label>
      <label for="${diaLower}-tarde-16-18"><input type="checkbox" id="${diaLower}-tarde-16-18" name="disponibilidade" value="${diaLower}-tarde-16-18"> Tarde (16-18)</label>
      <label for="${diaLower}-noite-18-20"><input type="checkbox" id="${diaLower}-noite-18-20" name="disponibilidade" value="${diaLower}-noite-18-20"> Noite (18-20)</label>
    </div>
</div>

                `;
    }).join('')}
            </div>
          </div>
        </div>
        
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 2rem 0;">
        
        <div class="form-group checkbox-group" style="margin: 20px 0; display: flex; align-items: flex-start; gap: 10px; background-color: var(--primary-color); padding: 1.5rem; border-radius: 8px;">
          <input type="checkbox" id="termo-lgpd" required style="width: 20px; height: 20px; margin-top: 3px; flex-shrink: 0;">
          <label for="termo-lgpd" style="font-size: 0.9rem; color: white; line-height: 1.4; cursor: pointer;">
            Autorizo o armazenamento dos meus dados pessoais exclusivamente para fins de organização do TPUBLI. Estou ciente de que meu nome, telefone, congregação e e-mail serão compartilhados com os irmãos designados para trabalhar comigo na mesma escala e com a equipe de apoio.
          </label>
        </div>
        
        <div class="form-actions-bottom">
          <button type="submit" id="submit-btn" class="btn-primary">${btnText}</button>
          ${this.editingId ? '<button type="button" class="btn-secondary" onclick="window.location.href=\'/participantes\'" style="margin-left: 10px;">Voltar</button>' : ''}
        </div>
        
        <div id="last-submission-info" style="margin-top: 15px; text-align: center; color: #666; display: none;">
           <!-- Preenchido via JS -->
        </div>
      </form>

    
      <!-- Confirmation Modal -->
      <div id="confirmation-modal" class="modal-overlay" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
             <h3>🔍 Conferir Disponibilidade</h3>
          </div>
          <p>Por favor, confirme se os dias e turnos abaixo estão corretos:</p>
          
          <div id="modal-summary-content" class="modal-summary">
             <!-- Inserido via JS -->
          </div>

          <div class="modal-warning">
             <small>⚠️ Ao confirmar, você estará se comprometendo com esses horários.</small>
          </div>

          <div class="modal-actions">
            <button type="button" id="btn-cancel-submit" class="btn-secondary">Voltar / Corrigir</button>
            <button type="button" id="btn-confirm-submit" class="btn-primary">✅ Confirmar e Enviar</button>
          </div>
        </div>
      </div>

      <style>
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); z-index: 9999;
            display: flex; justify-content: center; align-items: center;
            backdrop-filter: blur(4px);
            animation: fadeIn 0.3s;
        }
        .modal-content {
            background: var(--surface-color, #fff); 
            padding: 25px; 
            border-radius: 12px;
            max-width: 450px; 
            width: 90%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            animation: slideUp 0.3s;
            border: 1px solid var(--border-color, #ddd);
            color: var(--text-primary, #333);
        }
        .modal-header h3 { margin: 0 0 15px 0; color: var(--primary-color, #0d6efd); display: flex; align-items: center; gap: 8px;}
        .modal-summary {
            background: var(--bg-secondary, #f8f9fa); 
            padding: 15px; 
            border-radius: 8px;
            margin: 15px 0; 
            max-height: 40vh; 
            overflow-y: auto;
            border: 1px solid var(--border-color, #eee);
        }
        .summary-list { list-style: none; padding: 0; margin: 0; }
        .summary-item { 
            padding: 8px 0; 
            border-bottom: 1px solid #eee; 
            display: flex; 
            justify-content: space-between;
            align-items: center;
        }
        .summary-item:last-child { border-bottom: none; }
        .summary-day { font-weight: 600; }
        .summary-shift { 
            background: #e7f1ff; color: #0c5460; 
            padding: 2px 8px; border-radius: 12px; font-size: 0.85rem; 
        }
        .modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
        .modal-warning { margin-top: 10px; color: #856404; font-size: 0.9rem; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        @media (prefers-color-scheme: dark) {
            .modal-content { background: #1e1e1e; border-color: #333; }
            .modal-summary { background: #2d2d2d; border-color: #444; }
            .summary-item { border-bottom-color: #444; }
            .summary-shift { background: #0d3c61; color: #bbdefb; }
        }
      </style>
    `;
  }

  /**
   * @param {string} id
   */
  async loadParticipant(id) {
    try {
      const docRef = doc(db, "Pessoas", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        this.editingId = id; // Set editing ID

        // Atualizar título e botão se não estiver na página de edição dedicada
        const titleEl = document.querySelector('.form-card h2');
        const btnEl = document.getElementById('submit-btn');
        if (titleEl) titleEl.textContent = 'Editar Disponibilidade';
        if (btnEl) btnEl.textContent = 'Salvar Alterações';

        // Preencher campos de texto
        /**
         * @param {string} id
         * @param {any} val
         */
        const setVal = (id, val) => {
          const el = /** @type {HTMLInputElement} */ (document.getElementById(id));
          if (el) el.value = val || '';
        };

        setVal('nome', data.nome);
        setVal('email', data.email);
        setVal('telefone', data.telefone);
        setVal('genero', data.genero);
        setVal('congregacao', data.congregacao);
        setVal('conjuge', data.conjuge);
        setVal('frequencia-maxima', data.frequenciaMaxima);

        // Preencher checkbox de indisponibilidade
        const indisponivelCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('indisponivel-proximo-mes'));
        if (indisponivelCheckbox) {
          indisponivelCheckbox.checked = data.indisponivelProximoMes || false;
        }

        // Preencher checkbox de exceção semanal
        const excecaoSemanalCheckbox = /** @type {HTMLInputElement} */ (document.getElementById('excecao-semanal'));
        if (excecaoSemanalCheckbox) {
          excecaoSemanalCheckbox.checked = data.excecaoSemanal || false;
        }

        // Exibir a data da última alteração, se existir
        if (data.dataEnvioDisponibilidade) {
          const dataEnvio = data.dataEnvioDisponibilidade.toDate();
          this.updateSubmissionDateDisplay(dataEnvio);
        }

        // Limpar checkboxes antes de marcar
        document.querySelectorAll('input[name="disponibilidade"]').forEach(cb => /** @type {HTMLInputElement} */(cb).checked = false);

        // Preencher checkboxes
        if (Array.isArray(data.disponibilidade)) {
          data.disponibilidade.forEach(value => {
            const checkbox = /** @type {HTMLInputElement} */ (document.querySelector(`input[value="${value}"]`));
            if (checkbox) checkbox.checked = true;
          });
        }
      } else {
        alert('Participante não encontrado!');
        // Only redirect if we were strictly in edit mode from URL
        if (new URLSearchParams(window.location.search).get('id')) {
          window.location.href = '/participantes';
        }
      }
    } catch (error) {
      console.error("Erro ao carregar participante:", error);
      alert('Erro ao carregar dados.');
    }
  }

  bindEvents() {
    const form = /** @type {HTMLFormElement|null} */ (document.querySelector('#disponibilidade-form'));
    const nomeInput = /** @type {HTMLInputElement|null} */ (document.getElementById('nome'));
    const suggestionsList = document.getElementById('suggestions-list');

    // Elements for Spouse Autocomplete
    const conjugeInput = /** @type {HTMLInputElement|null} */ (document.getElementById('conjuge'));
    const conjugeSuggestionsList = document.getElementById('conjuge-suggestions-list');

    // Element for Phone Input
    const telefoneInput = /** @type {HTMLInputElement|null} */ (document.getElementById('telefone'));

    if (!form) return;

    // Real-time phone validation (only in create mode)
    if (telefoneInput && this.mode === 'create' && !this.editingId) {
      /** @type {number | undefined} */
      let checkTimeout;
      let phoneIsBlocked = false;

      telefoneInput.addEventListener('input', () => {
        clearTimeout(checkTimeout);
        const telefone = telefoneInput.value.replace(/\D/g, ''); // Remove non-digits

        // Remove bloqueio visual se usuário começar a digitar
        if (phoneIsBlocked) {
          telefoneInput.style.borderColor = '';
          telefoneInput.style.backgroundColor = '';
          phoneIsBlocked = false;

          // Reabilitar botão de envio
          const submitBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('submit-btn'));
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
          }

          // Reabilitar todos os campos do formulário
          const generoEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('genero'));
          const congregacaoEl = /** @type {HTMLInputElement|null} */ (document.getElementById('congregacao'));
          const conjugeEl = /** @type {HTMLInputElement|null} */ (document.getElementById('conjuge'));
          const frequenciaEl = /** @type {HTMLInputElement|null} */ (document.getElementById('frequencia-maxima'));
          const indisponivelEl = /** @type {HTMLInputElement|null} */ (document.getElementById('indisponivel-proximo-mes'));
          const termoEl = /** @type {HTMLInputElement|null} */ (document.getElementById('termo-lgpd'));

          if (generoEl) generoEl.disabled = false;
          if (congregacaoEl) congregacaoEl.disabled = false;
          if (conjugeEl) conjugeEl.disabled = false;
          if (frequenciaEl) frequenciaEl.disabled = false;
          if (indisponivelEl) indisponivelEl.disabled = false;
          if (termoEl) termoEl.disabled = false;

          // Reabilitar checkboxes de disponibilidade
          document.querySelectorAll('input[name="disponibilidade"]').forEach(cb => {
            const checkbox = /** @type {HTMLInputElement} */ (cb);
            checkbox.disabled = false;
          });
        }

        // Only check when phone has at least 10-11 digits (complete Brazilian phone)
        if (telefone.length >= 10) {
          checkTimeout = setTimeout(async () => {
            try {
              const pessoasRef = collection(db, 'Pessoas');
              const q = query(pessoasRef, where('telefone', '==', telefoneInput.value));
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                const existingData = querySnapshot.docs[0].data();
                console.log('⚠️ Telefone já cadastrado detectado em tempo real!');

                // Bloquear visualmente o campo
                telefoneInput.style.borderColor = '#ff9800';
                telefoneInput.style.backgroundColor = '#fff3e0';
                phoneIsBlocked = true;

                // Desabilitar botão de envio
                const submitBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById('submit-btn'));
                if (submitBtn) {
                  submitBtn.disabled = true;
                  submitBtn.style.opacity = '0.5';
                  submitBtn.style.cursor = 'not-allowed';
                }

                // Desabilitar todos os campos do formulário abaixo do telefone
                const generoEl = /** @type {HTMLSelectElement|null} */ (document.getElementById('genero'));
                const congregacaoEl = /** @type {HTMLInputElement|null} */ (document.getElementById('congregacao'));
                const conjugeEl = /** @type {HTMLInputElement|null} */ (document.getElementById('conjuge'));
                const frequenciaEl = /** @type {HTMLInputElement|null} */ (document.getElementById('frequencia-maxima'));
                const indisponivelEl = /** @type {HTMLInputElement|null} */ (document.getElementById('indisponivel-proximo-mes'));
                const termoEl = /** @type {HTMLInputElement|null} */ (document.getElementById('termo-lgpd'));

                if (generoEl) generoEl.disabled = true;
                if (congregacaoEl) congregacaoEl.disabled = true;
                if (conjugeEl) conjugeEl.disabled = true;
                if (frequenciaEl) frequenciaEl.disabled = true;
                if (indisponivelEl) indisponivelEl.disabled = true;
                if (termoEl) termoEl.disabled = true;

                // Desabilitar checkboxes de disponibilidade
                document.querySelectorAll('input[name="disponibilidade"]').forEach(cb => {
                  const checkbox = /** @type {HTMLInputElement} */ (cb);
                  checkbox.disabled = true;
                });

                this.showExistingRegistrationModal(existingData);
              }
            } catch (error) {
              console.error('Erro ao verificar telefone:', error);
            }
          }, 800); // Wait 800ms after user stops typing
        }
      });
    }


    // Autocomplete Logic for NAME (Main Participant)
    // Only enable in update mode
    if (nomeInput && suggestionsList && this.mode === 'update') {
      nomeInput.addEventListener('input', () => {
        const value = nomeInput.value.toLowerCase().trim();
        suggestionsList.innerHTML = '';
        suggestionsList.style.display = 'none';

        if (value.length < 2) return;

        const matches = this.allParticipants.filter(p =>
          p.nome.toLowerCase().includes(value)
        );

        if (matches.length > 0) {
          matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.textContent = match.nome; // + (match.telefone ? ` (${match.telefone.slice(-4)})` : ''); // Optional: show last 4 digits
            li.addEventListener('click', () => {
              nomeInput.value = match.nome;
              suggestionsList.style.display = 'none';
              this.loadParticipant(match.id); // Load data for this participant
            });
            suggestionsList.appendChild(li);
          });
          suggestionsList.style.display = 'block';
        }
      });

      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (e.target !== nomeInput && e.target !== suggestionsList) {
          suggestionsList.style.display = 'none';
        }
      });
    }

    // Autocomplete Logic for SPOUSE (Female only)
    if (conjugeInput && conjugeSuggestionsList) {
      conjugeInput.addEventListener('input', () => {
        const value = conjugeInput.value.toLowerCase().trim();
        conjugeSuggestionsList.innerHTML = '';
        conjugeSuggestionsList.style.display = 'none';

        if (value.length < 2) return;

        // Filter: Name matches AND Gender is Female
        const matches = this.allParticipants.filter(p =>
          p.nome.toLowerCase().includes(value) &&
          (p.genero === 'Feminino' || p.genero === 'feminino')
        );

        if (matches.length > 0) {
          matches.forEach(match => {
            const li = document.createElement('li');
            li.className = 'suggestion-item';
            li.textContent = match.nome;
            li.addEventListener('click', () => {
              conjugeInput.value = match.nome;
              conjugeSuggestionsList.style.display = 'none';
            });
            conjugeSuggestionsList.appendChild(li);
          });
          conjugeSuggestionsList.style.display = 'block';
        }
      });

      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (e.target !== conjugeInput && e.target !== conjugeSuggestionsList) {
          conjugeSuggestionsList.style.display = 'none';
        }
      });
    }

    // --- Lógica do Modal de Confirmação ---
    const modal = document.getElementById('confirmation-modal');
    const btnCancel = document.getElementById('btn-cancel-submit');
    const btnConfirm = /** @type {HTMLButtonElement} */ (document.getElementById('btn-confirm-submit'));
    const summaryContent = document.getElementById('modal-summary-content');

    if (btnCancel && modal) {
      btnCancel.addEventListener('click', () => modal.style.display = 'none');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const nomeEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#nome'));
      const emailEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#email'));
      const telefoneEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#telefone'));
      const generoEl = /** @type {HTMLSelectElement|null} */ (document.querySelector('#genero'));
      const congregacaoEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#congregacao'));
      const conjugeEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#conjuge'));
      const frequenciaMaximaEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#frequencia-maxima'));
      const indisponivelProximoMesEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#indisponivel-proximo-mes'));
      const excecaoSemanalEl = /** @type {HTMLInputElement|null} */ (document.querySelector('#excecao-semanal'));

      const formData = {
        nome: nomeEl?.value,
        email: emailEl?.value,
        telefone: telefoneEl?.value,
        genero: generoEl?.value,
        congregacao: congregacaoEl?.value,
        conjuge: conjugeEl?.value,
        frequenciaMaxima: parseInt(frequenciaMaximaEl?.value || '0', 10),
        disponibilidade: Array.from(document.querySelectorAll('input[name="disponibilidade"]:checked')).map(el => /** @type {HTMLInputElement} */(el).value),
        indisponivelProximoMes: indisponivelProximoMesEl?.checked || false,
        excecaoSemanal: excecaoSemanalEl?.checked || false,
        termoAceito: true,
        dataAtualizacao: new Date()
      };

      // Validação Flexível: Só exige disponibilidade se a frequência for maior que 0
      if (formData.frequenciaMaxima > 0 && formData.disponibilidade.length === 0) {
        alert('⚠️ Como você informou que deseja participar (Frequência > 0), por favor selecione pelo menos um dia e período de disponibilidade.');
        return;
      }

      // --- Verificar se telefone já existe (apenas em modo create) ---
      if (this.mode === 'create' && !this.editingId) {
        console.log('🔍 Verificando telefone duplicado. Mode:', this.mode, 'EditingId:', this.editingId);
        try {
          const pessoasRef = collection(db, 'Pessoas');
          const q = query(pessoasRef, where('telefone', '==', formData.telefone));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            // Telefone já cadastrado - mostrar modal de aviso
            console.log('⚠️ Telefone já cadastrado! Bloqueando cadastro duplicado.');
            const existingData = querySnapshot.docs[0].data();
            this.showExistingRegistrationModal(existingData);
            return; // Bloqueia o cadastro
          } else {
            console.log('✅ Telefone disponível para cadastro.');
          }
        } catch (error) {
          console.error('Erro ao verificar telefone:', error);
        }
      } else {
        console.log('ℹ️ Modo update ou editingId presente. Mode:', this.mode, 'EditingId:', this.editingId);
      }

      // --- Exibir Modal ---
      if (summaryContent && modal && btnConfirm) {
        // Formatter Helper
        /** @type {Record<string, string>} */
        const mapDia = /** @type {Record<string, string>} */ ({ 'segunda': 'Segunda', 'terca': 'Terça', 'quarta': 'Quarta', 'quinta': 'Quinta', 'sexta': 'Sexta', 'sabado': 'Sábado', 'domingo': 'Domingo' });
        const mapTurno = /** @type {Record<string, string>} */ ({ 'manha': 'Manhã', 'tarde': 'Tarde', 'noite': 'Noite' });

        const itensOrdenados = formData.disponibilidade.sort((a, b) => {
          const diasOrder = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
          const [da, ta] = a.split('-');
          const [db, tb] = b.split('-');
          const diffDia = diasOrder.indexOf(da) - diasOrder.indexOf(db);
          if (diffDia !== 0) return diffDia;
          const turnosOrder = ['manha', 'tarde', 'noite'];
          return turnosOrder.indexOf(ta) - turnosOrder.indexOf(tb);
        });

        const htmlList = itensOrdenados.map(item => {
          const [dia, turno] = item.split('-');
          return `
               <li class="summary-item">
                 <span class="summary-day">${mapDia[dia] || dia}</span>
                 <span class="summary-shift">${mapTurno[turno] || turno}</span>
               </li>
             `;
        }).join('');


        summaryContent.innerHTML = `<ul class="summary-list">${htmlList}</ul><div style="margin-top:10px;text-align:right;font-weight:bold;">Total: ${itensOrdenados.length} turnos</div>`;

        const modalTitle = modal.querySelector('h3');
        if (modalTitle) {
          modalTitle.innerHTML = this.mode === 'update' ? '🔍 Conferir Atualização' : '🔍 Conferir Disponibilidade';
        }

        modal.style.display = 'flex';

        // Configurar ação de confirmar (comportamento "once")
        btnConfirm.onclick = async () => {
          const btn = /** @type {HTMLButtonElement} */ (btnConfirm);
          btn.disabled = true;
          btn.innerHTML = '⏳ Enviando...';

          try {
            // Include dataEnvioDisponibilidade in the saved data
            const submissionDate = new Date();
            const dataToSave = {
              ...formData,
              dataEnvioDisponibilidade: submissionDate
            };

            // Lógica Original de Salvamento
            if (this.editingId) {
              await updateDoc(doc(db, 'Pessoas', this.editingId), dataToSave);
              cache.clearAll();
              alert('✅ Dados atualizados com sucesso!');

              // Update the display immediately
              this.updateSubmissionDateDisplay(submissionDate);

              if (new URLSearchParams(window.location.search).get('id')) {
                window.location.href = '/participantes';
              } else {
                form.reset();
                this.editingId = null;
                const titleEl = document.querySelector('.form-card h2');
                const btnEl = document.getElementById('submit-btn');
                const lastUpdateEl = document.getElementById('last-submission-info');

                if (titleEl) titleEl.textContent = 'Novo Cadastro'; // Reset to default
                if (btnEl) btnEl.textContent = 'Enviar Minha Disponibilidade';
                if (lastUpdateEl) lastUpdateEl.innerText = ''; // Clear date on reset

                window.scrollTo(0, 0);
                // Force clean reload logic if needed
                this.mode = 'create';
              }
            } else {
              // Modo create ou update sem editingId
              if (this.mode === 'create') {
                // Apenas criar novo cadastro (verificação já foi feita antes)
                const newData = { ...dataToSave, dataCriacao: new Date() };
                await addDoc(collection(db, 'Pessoas'), newData);
                cache.clearAll();
                alert('✅ Cadastro realizado com sucesso!');
                this.updateSubmissionDateDisplay(submissionDate);
                form.reset();
              } else {
                // Modo update - buscar e atualizar
                const pessoasRef = collection(db, 'Pessoas');
                const q = query(pessoasRef, where('telefone', '==', formData.telefone));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                  const docToUpdate = querySnapshot.docs[0];
                  await updateDoc(doc(db, 'Pessoas', docToUpdate.id), dataToSave);
                  cache.clearAll();
                  alert('✅ Seus dados foram atualizados com sucesso!');
                  this.updateSubmissionDateDisplay(submissionDate);
                } else {
                  alert('❌ Cadastro não encontrado. Por favor, faça um novo cadastro.');
                }
                form.reset();
              }
            }
          } catch (error) {
            console.error('Erro ao salvar dados:', error);
            alert('❌ Ocorreu um erro ao salvar os dados.');
          } finally {
            const btn = /** @type {HTMLButtonElement} */ (btnConfirm);
            btn.disabled = false;
            btn.innerHTML = '✅ Confirmar e Enviar';
            modal.style.display = 'none';
          }
        };
      }
    });
  }

  /**
   * @param {Date} date
   */
  updateSubmissionDateDisplay(date) {
    const el = document.getElementById('last-submission-info');
    if (el && date) {
      const formatted = date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      el.innerHTML = `<small>📅 Último envio: <strong>${formatted}</strong> (Horário de Brasília)</small>`;
      el.style.display = 'block';
    }
  }

  /**
   * @param {any} existingData
   */
  /**
   * Mostra modal customizado para entrada de senha
   * @param {string} title - Título do modal
   * @param {string} configKey - Chave da configuração no Firebase
   * @param {string} defaultPassword - Senha padrão caso não encontre no Firebase
   * @returns {Promise<boolean>} - Retorna true se senha correta, false caso contrário
   */
  async showPasswordModal(title, configKey, defaultPassword) {
    return new Promise((resolve) => {

      const passwordModal = document.createElement('div');
      passwordModal.className = 'modal-overlay password-modal-overlay';

      // Estilos inline completos para garantir visibilidade
      passwordModal.style.position = 'fixed';
      passwordModal.style.top = '0';
      passwordModal.style.left = '0';
      passwordModal.style.width = '100%';
      passwordModal.style.height = '100%';
      passwordModal.style.display = 'flex';
      passwordModal.style.justifyContent = 'center';
      passwordModal.style.alignItems = 'center';
      passwordModal.style.zIndex = '100000';
      passwordModal.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';

      passwordModal.innerHTML = `
        <div class="password-modal-card" style="
          background: linear-gradient(135deg, #4A90E2, #357ABD);
          border-radius: 20px;
          padding: 30px;
          max-width: 380px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          color: white;
        ">
          <div class="modal-header" style="margin-bottom: 20px;">
            <h3 style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0; color: white;">
              🔐 ${title}
            </h3>
          </div>
          <div style="padding: 10px 0;">
            <p style="margin-bottom: 20px; font-size: 1.05rem; text-align: center; color: rgba(255, 255, 255, 0.95);">
              Digite a senha para continuar:
            </p>
            <div class="form-group" style="margin-bottom: 15px;">
              <input 
                type="password" 
                id="password-modal-input" 
                class="form-control"
                placeholder="Digite a senha"
                autocomplete="off"
                style="font-size: 1.1rem; padding: 12px; text-align: center; border: 2px solid white; border-radius: 8px; width: 100%; background: rgba(255, 255, 255, 0.95);"
              >
            </div>
            <p style="margin-top: 15px; margin-bottom: 0; font-size: 0.9rem; color: rgba(255, 255, 255, 0.85); text-align: center;">
              💡 Solicite a senha no grupo do WhatsApp
            </p>
          </div>
          <div class="modal-actions" style="display: flex; gap: 10px; margin-top: 20px;">
            <button type="button" class="btn-secondary" id="btn-cancel-password" style="flex: 1; padding: 12px; background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid rgba(255, 255, 255, 0.5);">Cancelar</button>
            <button type="button" class="btn-primary" id="btn-verify-password" style="flex: 2; padding: 12px; background: white; color: #4A90E2; border: none; font-weight: 600;">
              ✅ Verificar
            </button>
          </div>
        </div>
      `;

      console.log('✅ HTML do modal criado');

      document.body.appendChild(passwordModal);
      console.log('✅ Modal adicionado ao body');

      // Verificar se o modal está visível
      const computedStyle = window.getComputedStyle(passwordModal);
      console.log('🔍 Modal display:', computedStyle.display);
      console.log('🔍 Modal z-index:', computedStyle.zIndex);
      console.log('🔍 Modal position:', computedStyle.position);

      // Forçar z-index muito alto
      passwordModal.style.zIndex = '99999';
      console.log('✅ Z-index atualizado para 99999');

      const passwordInput = /** @type {HTMLInputElement} */ (passwordModal.querySelector('#password-modal-input'));
      const btnCancel = passwordModal.querySelector('#btn-cancel-password');
      const btnVerify = /** @type {HTMLButtonElement} */ (passwordModal.querySelector('#btn-verify-password'));

      // Focar no input
      setTimeout(() => passwordInput?.focus(), 100);

      // Função para verificar senha
      const verifyPassword = async () => {
        const senha = passwordInput?.value.trim();

        if (!senha) {
          alert('⚠️ Por favor, digite a senha.');
          return;
        }

        btnVerify.disabled = true;
        btnVerify.innerHTML = '⏳ Verificando...';

        try {
          const passwordsToTry = [
            { key: configKey, def: defaultPassword },
            { key: configKey === 'senhaCadastro' ? 'senhaAtualizacao' : 'senhaCadastro', def: configKey === 'senhaCadastro' ? 'tpubli2026' : 'tpubli2026' },
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

            if (senha.toLowerCase() === correctPassword.toLowerCase()) {
              isMatch = true;
              break;
            }
          }

          if (isMatch) {
            document.body.removeChild(passwordModal);
            resolve(true);
          } else {
            alert('❌ Senha incorreta.');
            passwordInput.value = '';
            passwordInput.focus();
            btnVerify.disabled = false;
            btnVerify.innerHTML = '✅ Verificar';
          }
        } catch (error) {
          console.error('Erro ao verificar senha:', error);
          alert('❌ Erro ao verificar senha. Tente novamente.');
          btnVerify.disabled = false;
          btnVerify.innerHTML = '✅ Verificar';
        }
      };

      // Event listeners
      btnCancel?.addEventListener('click', () => {
        document.body.removeChild(passwordModal);
        resolve(false);
      });

      btnVerify?.addEventListener('click', verifyPassword);

      passwordInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          verifyPassword();
        }
      });

      // Fechar ao clicar fora
      passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
          document.body.removeChild(passwordModal);
          resolve(false);
        }
      });
    });
  }

  /**
   * @param {any} existingData
   */
  showExistingRegistrationModal(existingData) {
    // Criar modal de aviso
    const existingModal = document.createElement('div');
    existingModal.className = 'modal-overlay';
    existingModal.style.display = 'flex';
    existingModal.style.zIndex = '10000';

    const lastUpdate = existingData.dataEnvioDisponibilidade
      ? existingData.dataEnvioDisponibilidade.toDate().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
      : 'Não disponível';

    const nome = existingData.nome || 'Usuário';

    existingModal.innerHTML = `
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3 style="color: #ff9800; display: flex; align-items: center; gap: 8px;">
            ⚠️ Cadastro Já Existe
          </h3>
        </div>
        <div style="padding: 20px 0;">
          <p style="margin-bottom: 10px; font-size: 1.3rem; font-weight: 600; text-align: center; color: var(--primary-color);">
            ${nome}
          </p>
          <p style="margin-bottom: 15px; font-size: 1.1rem; line-height: 1.5; text-align: center;">
            Você já está cadastrado(a) no sistema. Esta página agora é para novos cadastros.
          </p>
          <p style="margin-top: 15px; font-size: 1.05rem; color: #555; text-align: center;">
            Para atualizar seus dados ou disponibilidade, clique no botão abaixo:
          </p>
        </div>
        <div class="modal-actions" style="gap: 10px; flex-direction: column;">
          <button type="button" class="btn-primary" id="btn-go-to-update" style="font-size: 1.2rem; padding: 15px 30px; font-weight: 700; width: 100%;">
            🔄 IR PARA ATUALIZAÇÃO
          </button>
          <button type="button" class="btn-secondary" id="btn-close-existing-modal" style="font-size: 0.95rem;">Fechar</button>
        </div>
        <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
          <small style="color: #999; font-size: 0.85rem;">
            📅 Última alteração: ${lastUpdate}
          </small>
        </div>
      </div>
    `;

    document.body.appendChild(existingModal);

    // Bind dos botões
    const btnClose = existingModal.querySelector('#btn-close-existing-modal');
    const btnGoToUpdate = existingModal.querySelector('#btn-go-to-update');

    if (btnClose) {
      btnClose.addEventListener('click', () => {
        document.body.removeChild(existingModal);
      });
    }

    if (btnGoToUpdate) {
      btnGoToUpdate.addEventListener('click', () => {
        window.location.href = '/atualizar';
      });
    }

    // Fechar ao clicar fora
    existingModal.addEventListener('click', (e) => {
      if (e.target === existingModal) {
      }
    });
  }

  showChoiceModal() {
    const container = document.querySelector(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="choice-modal-overlay">
        <div class="choice-modal-content">
          <div class="choice-modal-header">
            <h2> Bem-vindo ao TPUBLI!</h2>
            <p>O que você pretende fazer?</p>
          </div>
          
          <div class="choice-buttons">
            <button id="btn-novo-cadastro" class="choice-btn choice-btn-primary">
              <span class="choice-icon">📝</span>
              <div class="choice-text">
                <strong> Novo Cadastro</strong>
                <small>Primeira vez no sistema</small>
              </div>
            </button>
            
            <button id="btn-alterar-cadastro" class="choice-btn choice-btn-secondary">
              <span class="choice-icon">🔄</span>
              <div class="choice-text">
                <strong> Alterar Cadastro</strong>
                <small>Atualizar meus dados</small>
              </div>
            </button>
            
            <button id="btn-ver-escala" class="choice-btn choice-btn-tertiary">
              <span class="choice-icon">📅</span>
              <div class="choice-text">
                <strong> Ver Minha Escala</strong>
                <small>Consultar designações</small>
              </div>
            </button>
          </div>
          
          <div class="choice-footer">
            <small>💡 Escolha a opção adequada para continuar</small>
          </div>
        </div>
      </div>
      
      <style>
        /* Modal Overlay */
        .choice-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #4A90E2, #357ABD);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          animation: fadeIn 0.4s ease;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        /* Modal Content */
        .choice-modal-content {
          background: var(--surface-color, #fff);
          border-radius: 24px;
          padding: 3rem 2.5rem;
          max-width: 420px;
          width: 85%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.5s ease;
          text-align: center;
        }
        
        @keyframes slideUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        /* Header */
        .choice-modal-header h2 {
          font-size: 2rem;
          font-weight: 700;
          color: var(--text-primary, #333);
          margin: 0 0 0.5rem 0;
        }
        
        .choice-modal-header p {
          font-size: 1.2rem;
          color: var(--text-secondary, #666);
          margin: 0 0 2rem 0;
        }
        
        /* Buttons Container */
        .choice-buttons {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        /* Choice Button */
        .choice-btn {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem 2rem;
          border: 2px solid transparent;
          border-radius: 16px;
          background: var(--bg-secondary, #f8f9fa);
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: left;
          width: 100%;
        }
        
        .choice-btn:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
        }
        
        .choice-btn-primary {
          border-color: #4A90E2;
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.1), rgba(53, 122, 189, 0.05));
        }
        
        .choice-btn-primary:hover {
          background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(53, 122, 189, 0.1));
          border-color: #357ABD;
        }
        
        .choice-btn-secondary {
          border-color: #28a745;
          background: linear-gradient(135deg, rgba(40, 167, 69, 0.1), rgba(32, 134, 55, 0.05));
        }
        
        .choice-btn-secondary:hover {
          background: linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(32, 134, 55, 0.1));
          border-color: #218838;
        }
        
        .choice-btn-tertiary {
          border-color: #ff9800;
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.1), rgba(245, 124, 0, 0.05));
        }
        
        .choice-btn-tertiary:hover {
          background: linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(245, 124, 0, 0.1));
          border-color: #f57c00;
        }
        
        .choice-icon {
          font-size: 3rem;
          flex-shrink: 0;
        }
        
        .choice-text {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          flex: 1;
          text-align: center;
        }
        
        .choice-text strong {
          font-size: 1.3rem;
          color: var(--text-primary, #333);
          font-weight: 600;
        }
        
        .choice-text small {
          font-size: 0.95rem;
          color: var(--text-secondary, #666);
        }
        
        /* Footer */
        .choice-footer {
          padding-top: 1rem;
          border-top: 1px solid var(--border-color, #e0e0e0);
          color: var(--text-secondary, #666);
        }
        
        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .choice-modal-content {
            background: #1e1e1e;
          }
          
          .choice-modal-header h2 {
            color: #fff;
          }
          
          .choice-modal-header p {
            color: #b0b0b0;
          }
          
          .choice-btn {
            background: #2d2d2d;
          }
          
          .choice-btn-primary {
            background: linear-gradient(135deg, rgba(74, 144, 226, 0.2), rgba(53, 122, 189, 0.1));
          }
          
          .choice-btn-primary:hover {
            background: linear-gradient(135deg, rgba(74, 144, 226, 0.3), rgba(53, 122, 189, 0.2));
          }
          
          .choice-btn-secondary {
            background: linear-gradient(135deg, rgba(40, 167, 69, 0.2), rgba(32, 134, 55, 0.1));
          }
          
          .choice-btn-secondary:hover {
            background: linear-gradient(135deg, rgba(40, 167, 69, 0.3), rgba(32, 134, 55, 0.2));
          }
          
          .choice-text strong {
            color: #fff;
          }
          
          .choice-text small {
            color: #b0b0b0;
          }
          
          .choice-footer {
            border-top-color: #333;
            color: #b0b0b0;
          }
        }
        
        /* Mobile Responsive */
        @media (max-width: 768px) {
          .choice-modal-content {
            padding: 2rem 1.2rem;
            width: 88%;
            max-width: 380px;
          }
          
          .choice-modal-header h2 {
            font-size: 1.5rem;
          }
          
          .choice-modal-header p {
            font-size: 0.95rem;
          }
          
          .choice-btn {
            padding: 1.2rem 1rem;
            gap: 1rem;
          }
          
          .choice-icon {
            font-size: 2.2rem;
          }
          
          .choice-text strong {
            font-size: 1.05rem;
          }
          
          .choice-text small {
            font-size: 0.85rem;
          }
        }
      </style>
    `;

    // Event Listeners
    const btnNovoCadastro = document.getElementById('btn-novo-cadastro');
    const btnAlterarCadastro = document.getElementById('btn-alterar-cadastro');
    const btnVerEscala = document.getElementById('btn-ver-escala');

    if (btnNovoCadastro) {
      btnNovoCadastro.addEventListener('click', async () => {
        try {
          const isAuthenticated = await this.showPasswordModal(
            'Novo Cadastro',
            'senhaCadastro',
            'tpubli2026'
          );

          if (isAuthenticated) {
            // Senha correta, esconde o modal de escolha
            const choiceModal = document.querySelector('.choice-modal-overlay');
            if (choiceModal) {
              choiceModal.remove();
            }

            // Renderiza o formulário
            this.passwordVerified = true;
            this.render();
            this.bindEvents();
          }
        } catch (error) {
          console.error('❌ Erro ao abrir modal de senha:', error);
        }
      });
    }

    if (btnAlterarCadastro) {
      btnAlterarCadastro.addEventListener('click', async () => {
        const isAuthenticated = await this.showPasswordModal(
          'Alterar Cadastro',
          'senhaAtualizacao',
          'tpubli2026'
        );

        if (isAuthenticated) {
          // Senha correta, redireciona para página de atualização com parâmetro
          window.location.href = '/atualizar?auth=true';
        }
      });
    }

    if (btnVerEscala) {
      btnVerEscala.addEventListener('click', async () => {
        const isAuthenticated = await this.showPasswordModal(
          'Ver Minha Escala',
          'senhaAtualizacao',
          'tpubli2026'
        );

        if (isAuthenticated) {
          // Senha correta, redireciona para consulta
          window.location.href = '/consulta?auth=true';
        }
      });
    }
  }
}
