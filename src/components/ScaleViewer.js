import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from '../services/firebase.js';
import { cache } from '../services/CacheService.js';

export default class ScaleViewer {
  /**
   * @param {string} containerId - ID do container onde o componente será renderizado
   */
  constructor(containerId) {
    this.containerId = containerId;
    /** @type {any} */ (window).scaleViewer = this; // Permite acesso global para eventos inline
    /** @type {Array<any>} */
    this.escalas = [];
    /** @type {any[]} */
    this.currentVagos = [];
    /** @type {any[]} */
    this.allParticipants = [];
    this.render();
    this.fetchEscalas();
    this.loadParticipants(); // Carrega em background
  }

  async loadParticipants() {
    try {
      this.allParticipants = await cache.cachedGetDocs(
        async () => await getDocs(query(collection(db, "Pessoas"))),
        'all_participants_autocomplete', // Cache key separada
        60 // 1 hora
      );
      console.log(`[ScaleViewer] ${this.allParticipants.length} participantes carregados para autocomplete.`);
    } catch (error) {
      console.error("[ScaleViewer] Erro ao carregar participantes:", error);
    }
  }

  render() {
    const container = document.querySelector(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <h2>Escalas Geradas</h2>
      <div class="scale-controls">
        <label for="scale-select">Selecione o Período:</label>
        <select id="scale-select">
          <option value="">Carregando...</option>
        </select>
        <button id="btn-refresh-scales" title="Atualizar Lista">🔄 Atualizar Lista</button>
        <button id="btn-delete-scale" class="btn-delete" title="Excluir Escala Selecionada" style="display:none;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          Excluir
        </button>
      </div>
      
      <div id="scale-details-container" class="scale-details">
        <p class="placeholder-text">Selecione uma escala para visualizar.</p>
      </div>
    `;

    const selectEl = document.getElementById('scale-select');
    if (selectEl) {
      selectEl.addEventListener('change', (/** @type {any} */ e) => {
        const target = e.target;
        if (target instanceof HTMLSelectElement) {
          const escalaId = target.value;
          this.renderScaleDetails(escalaId);

          const btnDelete = document.getElementById('btn-delete-scale');
          if (btnDelete) {
            btnDelete.style.display = escalaId ? 'inline-block' : 'none';
          }
        }
      });
    }

    const btnRefresh = document.getElementById('btn-refresh-scales');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.fetchEscalas();
      });
    }

    const btnDelete = document.getElementById('btn-delete-scale');
    if (btnDelete) {
      btnDelete.addEventListener('click', () => {
        this.deleteEscala();
      });
    }
  }

  async fetchEscalas() {
    const select = document.getElementById('scale-select');
    if (!select) return;

    select.innerHTML = '<option value="">Carregando...</option>';

    try {
      const q = query(collection(db, "Escalas"), orderBy("dataGeracao", "desc"));
      const querySnapshot = await getDocs(q);

      this.escalas = [];
      select.innerHTML = '<option value="">Selecione...</option>';

      if (querySnapshot.empty) {
        select.innerHTML = '<option value="">Nenhuma escala encontrada</option>';
        return;
      }

      querySnapshot.forEach((/** @type {any} */ docSnap) => {
        const data = docSnap.data();
        this.escalas.push({ id: docSnap.id, ...data });

        const option = document.createElement('option');
        option.value = docSnap.id;
        const dataGeracao = data.dataGeracao?.toDate ? data.dataGeracao.toDate().toLocaleDateString() : 'Data desc.';
        option.textContent = `${data.periodo} (Gerada em: ${dataGeracao})`;
        select.appendChild(option);
      });

      if (this.escalas.length > 0 && select instanceof HTMLSelectElement) {
        select.value = this.escalas[0].id;
        this.renderScaleDetails(this.escalas[0].id);

        const btnDelete = document.getElementById('btn-delete-scale');
        if (btnDelete) {
          btnDelete.style.display = 'inline-block';
        }
      }

    } catch (error) {
      console.error("Erro ao buscar escalas:", error);
      select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
  }

  async deleteEscala() {
    const select = document.getElementById('scale-select');
    if (!select || !(select instanceof HTMLSelectElement)) return;

    const escalaId = select.value;
    if (!escalaId) {
      alert('Selecione uma escala para excluir.');
      return;
    }

    const escala = this.escalas.find(e => e.id === escalaId);
    if (!escala) return;

    const confirmacao = confirm(`Tem certeza que deseja excluir a escala "${escala.periodo}"?\n\nEsta ação não pode ser desfeita!`);
    if (!confirmacao) return;

    try {
      await deleteDoc(doc(db, "Escalas", escalaId));
      alert(`Escala "${escala.periodo}" excluída com sucesso!`);
      await this.fetchEscalas();

      const container = document.getElementById('scale-details-container');
      if (container) {
        container.innerHTML = '<p class="placeholder-text">Selecione uma escala para visualizar.</p>';
      }

      const btnDelete = document.getElementById('btn-delete-scale');
      if (btnDelete) {
        btnDelete.style.display = 'none';
      }
    } catch (error) {
      console.error("Erro ao excluir escala:", error);
      alert('Erro ao excluir a escala. Tente novamente.');
    }
  }

  /**
   * @param {string} escalaId - ID da escala a ser renderizada
   */
  renderScaleDetails(escalaId) {
    const container = document.getElementById('scale-details-container');
    if (!container) return;

    if (!escalaId) {
      container.innerHTML = '<p class="placeholder-text">Selecione uma escala para visualizar.</p>';
      return;
    }

    const escala = this.escalas.find(e => e.id === escalaId);
    if (!escala) return;

    if (!escala.vagos || escala.vagos.length === 0) {
      container.innerHTML = '<p>Esta escala não possui dados de vagos.</p>';
      return;
    }

    /** @type {Record<string, Array<any>>} */
    const vagosPorData = {};
    escala.vagos.forEach((/** @type {any} */ vago) => {
      if (!vagosPorData[vago.data]) {
        vagosPorData[vago.data] = [];
      }
      vagosPorData[vago.data].push(vago);
    });

    const datasOrdenadas = Object.keys(vagosPorData).sort();

    let html = `
      <div class="scale-summary">
        <h3>Detalhes: ${escala.periodo}</h3>
        <p>Total de Vagos: ${escala.vagos.length}</p>
      </div>
      <div class="table-responsive">
        <table class="scale-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Dia</th>
              <th>Hora</th>
              <th>Local</th>
              <th>Dupla Designada</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
    `;

    this.currentVagos = [];

    datasOrdenadas.forEach(dataStr => {
      const vagosDoDia = vagosPorData[dataStr];
      vagosDoDia.forEach((vago) => {
        // Se o vago não tem designação e não está reservado, não exibe para não confundir
        if (!vago.designacao && vago.observacao !== 'RESERVADO') {
          return;
        }

        const dataFormatada = new Date(vago.data + 'T00:00:00').toLocaleDateString('pt-BR');
        const diaSemana = new Date(vago.data + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
        const vagoIndex = this.currentVagos.length;
        this.currentVagos.push(vago);

        let dupla = '';
        if (vago.observacao === 'RESERVADO') {
          dupla = '<span style="color: #007bff; font-weight: bold; background: #e7f1ff; padding: 2px 6px; border-radius: 4px;">🔒 RESERVADO </span>';
        } else if (vago.designacao) {
          dupla = `
            <div style="font-size: 0.9em;">
              <div><strong>${vago.designacao.pessoa1.nome}</strong></div>
              <div style="margin-top: 2px;"><strong>${vago.designacao.pessoa2.nome}</strong></div>
            </div>
            `;
        } else {
          dupla = '<span class="text-danger">Não preenchido</span>';
        }

        const p1Cancelou = vago.designacao?.pessoa1Cancelou;
        const p2Cancelou = vago.designacao?.pessoa2Cancelou;
        const alguemCancelou = p1Cancelou || p2Cancelou;

        const sentP1 = vago.statusEnvio && vago.statusEnvio.pessoa1;
        const sentP2 = vago.statusEnvio && vago.statusEnvio.pessoa2;
        const allSent = sentP1 && sentP2;

        const btnStyle = alguemCancelou ? 'background-color: #dc3545; color: white;' : (allSent ? 'background-color: #28a745; color: white;' : '');
        const btnText = alguemCancelou ? '🚨 SUBST' : (allSent ? 'Ver' : 'Ver');

        html += `
            <tr style="${alguemCancelou ? 'background-color: #fceaea;' : ''}">
              <td>${dataFormatada}</td>
              <td style="text-transform: capitalize;">${diaSemana.split('-')[0]}</td>
              <td>${vago.hora}</td>
              <td>${vago.local}</td>
              <td style="${alguemCancelou ? 'text-align: center;' : ''}">
                ${alguemCancelou
            ? '<div style="color: #d63031; font-weight: bold; font-size: 1em;">🚨 CANCELAMENTO</div>'
            : dupla}
              </td>
              <td>
                <button class="btn-action" data-index="${vagoIndex}" style="${btnStyle}" onclick="window.scaleViewer.openCardModal(window.scaleViewer.currentVagos[${vagoIndex}], '${escalaId}', ${vagoIndex})">
                  ${btnText}
                </button>
              </td>
            </tr>
        `;
      });
    });

    html += `
          </tbody>
        </table>
      </div>
      <div id="card-modal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);">
        <div class="modal-content" style="background-color: #fefefe; margin: 5% auto; padding: 20px; border: 1px solid #888; width: 90%; max-width: 700px; border-radius: 8px;">
          <span class="close-button" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
          <div id="designation-card" class="designation-card" style="padding: 40px; border: 1px solid #ccc; background: white; color: black; font-family: 'Times New Roman', serif;">
            <h2 style="text-align: left; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; text-transform: uppercase; font-size: 1.5rem; color: black;">DESIGNAÇÃO PARA O TPUBLI</h2>
            <div id="card-content" style="font-size: 1.1rem; line-height: 1.6;"></div>
          </div>
          <div class="modal-actions" style="margin-top: 20px; text-align: center; display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
            <button id="btn-print-card" style="background-color: #333; border: none; padding: 12px 24px; color: white; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px;">🖨️ Imprimir / Salvar PDF</button>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    const modal = document.getElementById('card-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-button');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        this.renderScaleDetails(escalaId);
      });
    }

    const btnPrint = document.getElementById('btn-print-card');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        const cardElement = document.getElementById('designation-card');
        if (!cardElement) return;
        const printWindow = window.open('', '', 'height=600,width=800');
        if (printWindow) {
          printWindow.document.write('<html><head><title>Designação TPUBLI</title><style>body { font-family: "Times New Roman", serif; padding: 20px; } .support-team { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 0.9rem; color: #555; }</style></head><body>');
          printWindow.document.write(cardElement.outerHTML);
          printWindow.document.write('</body></html>');
          printWindow.document.close();
          printWindow.print();
        }
      });
    }

    container.querySelectorAll('.btn-card').forEach((/** @type {any} */ btn) => {
      btn.addEventListener('click', (/** @type {any} */ e) => {
        const target = /** @type {HTMLElement} */ (e.target);
        const indexStr = target.dataset.index;
        if (indexStr) {
          const index = parseInt(indexStr, 10);
          if (this.currentVagos && this.currentVagos[index]) {
            this.openCardModal(this.currentVagos[index], escalaId, index);
          }
        }
      });
    });
  }

  /**
   * @param {string} escalaId
   * @param {number} vagoIndex
   * @param {'pessoa1' | 'pessoa2'} pessoaKey
   */
  async markAsSent(escalaId, vagoIndex, pessoaKey) {
    try {
      const escala = this.escalas.find(e => e.id === escalaId);
      if (!escala) return;

      if (!escala.vagos[vagoIndex].statusEnvio) {
        escala.vagos[vagoIndex].statusEnvio = {};
      }
      escala.vagos[vagoIndex].statusEnvio[pessoaKey] = true;

      const escalaRef = doc(db, "Escalas", escalaId);
      await updateDoc(escalaRef, { vagos: escala.vagos });

    } catch (error) {
      console.error("Erro ao atualizar status de envio:", error);
    }
  }

  /**
   * @param {any} vago
   * @param {string} escalaId
   */
  /**
   * @param {any} vago
   * @param {string} escalaId
   * @param {number} displayedIndex
   */
  openCardModal(vago, escalaId, displayedIndex) {
    const modal = document.getElementById('card-modal');
    const contentDiv = document.getElementById('card-content');
    if (!modal || !contentDiv) return;

    const dataFormatada = new Date(vago.data + 'T00:00:00').toLocaleDateString('pt-BR');

    // Mapeamento de Horários
    let horarioTexto = vago.hora;
    const horaLower = vago.hora.toLowerCase();

    if (horaLower.includes('08:30-10:30') || horaLower === 'manhã' || horaLower === 'manha') {
      horarioTexto = '08:30 às 10:30h';
    } else if (horaLower.includes('10-12')) {
      horarioTexto = '10:00 às 12:00h';
    } else if (horaLower.includes('14-16')) {
      horarioTexto = '14:00 às 16:00h';
    } else if (horaLower.includes('16-18') || horaLower === 'tarde') {
      horarioTexto = '16:00 às 18:00h';
    } else if (horaLower.includes('noite')) {
      horarioTexto = '18:00 às 20:00h';
    }

    // Inicializa dados (podem ser editados)
    let p1 = vago.designacao ? vago.designacao.pessoa1 : { nome: 'RESERVADO', telefone: '', congregacao: '' };
    let p2 = vago.designacao ? vago.designacao.pessoa2 : { nome: 'RESERVADO', telefone: '', congregacao: '' };
    const isReserved = !vago.designacao;

    const p1Cancelou = vago.designacao?.pessoa1Cancelou;
    const p2Cancelou = vago.designacao?.pessoa2Cancelou;

    // Função para renderizar o CONTEÚDO do cartão
    /**
     * @param {any} pessoa1
     * @param {any} pessoa2
     */
    const renderCardContent = (pessoa1, pessoa2) => {
      let subButtonHtml = '';
      if (p1Cancelou || p2Cancelou) {
        subButtonHtml = `
          <button id="btn-intelligent-sub" style="width: 100%; margin-top: 20px; padding: 12px; background: #2f3640; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">
            🔍 Procurar Substituto Inteligente
          </button>
        `;
      }

      contentDiv.innerHTML = `
        <p style="margin-bottom: 20px;"><strong>DIA:</strong> ${dataFormatada}<br>
        <strong>HORARIO:</strong> ${horarioTexto}<br>
        <strong>LOCAL:</strong> ${vago.local.toUpperCase()}</p>

        <div style="${p1Cancelou ? 'border: 2px solid #e74c3c; padding: 10px; border-radius: 8px; background: #fff5f5;' : ''}">
          <p><strong>NOME:</strong> ${pessoa1.nome.toUpperCase()}<br>
          <strong>Telefone:</strong> ${pessoa1.telefone}</p>
          <p><strong>Congregação:</strong> ${(pessoa1.congregacao || (isReserved ? 'VISITANTE' : 'NÃO INFORMADA')).toUpperCase()}</p>
          ${p1Cancelou ? '<p style="color: #e74c3c; font-weight: bold; margin-top: 5px;">🚨 ESTA PESSOA AVISOU QUE NÃO VAI</p>' : ''}
        </div>
        
        <div style="margin-top: 15px; ${p2Cancelou ? 'border: 2px solid #e74c3c; padding: 10px; border-radius: 8px; background: #fff5f5;' : ''}">
          <p><strong>NOME:</strong> ${pessoa2.nome.toUpperCase()}<br>
          <strong>Telefone:</strong> ${pessoa2.telefone}</p>
          <p><strong>Congregação:</strong> ${(pessoa2.congregacao || (isReserved ? 'VISITANTE' : 'NÃO INFORMADA')).toUpperCase()}</p>
          ${p2Cancelou ? '<p style="color: #e74c3c; font-weight: bold; margin-top: 5px;">🚨 ESTA PESSOA AVISOU QUE NÃO VAI</p>' : ''}
        </div>
        
        ${subButtonHtml}


      `;

      if (p1Cancelou || p2Cancelou) {
        const btnSub = document.getElementById('btn-intelligent-sub');
        if (btnSub) {
          btnSub.onclick = () => this.procurarSubstituto(vago, escalaId, displayedIndex);
        }
      }
    };

    renderCardContent(p1, p2);

    // Gerenciamento do Formulário de Edição (Apenas para Reservados)
    const existingForm = modal.querySelector('.reserved-edit-form');
    if (existingForm) existingForm.remove();

    if (isReserved) {
      const editForm = document.createElement('div');
      editForm.className = 'reserved-edit-form';
      editForm.style.cssText = 'background: #f9f9f9; padding: 15px; margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px;';
      editForm.innerHTML = `
        <h4 style="margin-top:0;">Preencher Dados da Reserva</h4>
        <datalist id="participants-list">
          ${this.allParticipants.map(/** @param {any} p */ p => `<option value="${p.nome}">${p.congregacao || ''}</option>`).join('')}
        </datalist>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <div style="flex: 1;">
            <label style="display:block; font-size: 0.8em; font-weight: bold;">Pessoa 1 - Nome</label>
            <input id="edit-p1-nome" list="participants-list" type="text" placeholder="Buscar ou Digitar Nome" value="" style="width: 100%; padding: 5px;" autocomplete="off">
          </div>
          <div style="flex: 1;">
            <label style="display:block; font-size: 0.8em; font-weight: bold;">Pessoa 1 - Telefone</label>
            <input id="edit-p1-tel" type="text" placeholder="Ex: 87999999999" value="" style="width: 100%; padding: 5px;">
             <input id="edit-p1-cong" type="hidden">
          </div>
        </div>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 10px;">
          <div style="flex: 1;">
            <label style="display:block; font-size: 0.8em; font-weight: bold;">Pessoa 2 - Nome</label>
             <input id="edit-p2-nome" list="participants-list" type="text" placeholder="Buscar ou Digitar Nome" value="" style="width: 100%; padding: 5px;" autocomplete="off">
          </div>
          <div style="flex: 1;">
            <label style="display:block; font-size: 0.8em; font-weight: bold;">Pessoa 2 - Telefone</label>
            <input id="edit-p2-tel" type="text" placeholder="Ex: 87999999999" value="" style="width: 100%; padding: 5px;">
            <input id="edit-p2-cong" type="hidden">
          </div>
        </div>
        <button id="btn-update-reserved" style="margin-top: 10px; background: #007bff; color: white; border: none; padding: 8px 16px; cursor: pointer; border-radius: 4px;">Atualizar Cartão</button>
      `;

      const cardContainer = document.getElementById('designation-card');
      if (cardContainer && cardContainer.parentNode) {
        cardContainer.parentNode.insertBefore(editForm, cardContainer);
      }

      // Lógica de Autocomplete
      /**
       * @param {string} inputId
       * @param {string} telId
       * @param {string} congId
       */
      const setupAutocomplete = (inputId, telId, congId) => {
        const input = /** @type {HTMLInputElement} */ (document.getElementById(inputId));
        const telInput = /** @type {HTMLInputElement} */ (document.getElementById(telId));
        const congInput = /** @type {HTMLInputElement} */ (document.getElementById(congId));

        if (input) {
          input.addEventListener('input', () => {
            const val = input.value;
            const found = this.allParticipants.find(p => p.nome === val);
            if (found) {
              if (telInput) telInput.value = found.telefone || '';
              if (congInput) congInput.value = found.congregacao || '';
            } else {
              if (congInput) congInput.value = 'VISITANTE'; // Default se não achar
            }
          });

          // Preenche form se já tiver dados carregados
          input.addEventListener('change', () => {
            /* Apenas garante consistência final */
            const val = input.value;
            const found = this.allParticipants.find(p => p.nome === val);
            if (found) {
              if (telInput && !telInput.value) telInput.value = found.telefone || '';
              if (congInput) congInput.value = found.congregacao || '';
            }
          });
        }
      };

      setupAutocomplete('edit-p1-nome', 'edit-p1-tel', 'edit-p1-cong');
      setupAutocomplete('edit-p2-nome', 'edit-p2-tel', 'edit-p2-cong');

      document.getElementById('btn-update-reserved')?.addEventListener('click', () => {
        const nome1 = /** @type {HTMLInputElement} */(document.getElementById('edit-p1-nome')).value || 'RESERVADO';
        const tel1 = /** @type {HTMLInputElement} */(document.getElementById('edit-p1-tel')).value || '';
        const cong1 = /** @type {HTMLInputElement} */(document.getElementById('edit-p1-cong')).value || 'VISITANTE';

        const nome2 = /** @type {HTMLInputElement} */(document.getElementById('edit-p2-nome')).value || 'RESERVADO';
        const tel2 = /** @type {HTMLInputElement} */(document.getElementById('edit-p2-tel')).value || '';
        const cong2 = /** @type {HTMLInputElement} */(document.getElementById('edit-p2-cong')).value || 'VISITANTE';

        p1 = { ...p1, nome: nome1, telefone: tel1, congregacao: cong1 };
        p2 = { ...p2, nome: nome2, telefone: tel2, congregacao: cong2 };

        renderCardContent(p1, p2);
        setupButtons(p1, p2); // Recria os botões de WhatsApp com novos dados
      });
    }

    /**
     * @param {any} pessoa1
     * @param {any} pessoa2
     */
    const setupButtons = (pessoa1, pessoa2) => {
      const modalActions = modal.querySelector('.modal-actions');
      if (!modalActions) return;

      modalActions.querySelectorAll('.btn-share-whatsapp').forEach(btn => btn.remove());

      /**
       * @param {any} pessoa
       * @param {'pessoa1' | 'pessoa2'} key
       */
      const createShareButton = (pessoa, key) => {
        const btn = document.createElement('button');
        btn.className = 'btn-share-whatsapp';

        const isSent = vago.statusEnvio && vago.statusEnvio[key];
        // Se for reservado, permite enviar sempre (pois pode ser uma atualização)
        const canSend = isReserved ? true : !isSent;
        const btnColor = canSend ? '#128C7E' : '#ccc';

        btn.style.cssText = `background-color: ${btnColor}; border: none; padding: 12px 24px; color: white; border-radius: 5px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 5px; margin: 5px;`;

        let label = 'Enviar';
        if (isReserved) label = `Enviar para ${pessoa.nome.split(' ')[0]}`;
        else label = isSent ? 'Enviado' : `Enviar para ${pessoa.nome.split(' ')[0]}`;

        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 5px;"><path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/></svg> ${label}`;

        if (!canSend) btn.disabled = true;

        btn.addEventListener('click', async () => {
          // Montar o texto da mensagem
          const text = `*DESIGNAÇÃO PARA O TPUBLI*

*DIA:* ${dataFormatada}
*HORARIO:* ${horarioTexto}
*LOCAL:* ${vago.local.toUpperCase()}

*NOME:* ${pessoa1.nome.toUpperCase()}
*Telefone:* ${pessoa1.telefone}
*Congregação:* ${(pessoa1.congregacao || '').toUpperCase()}

*NOME:* ${pessoa2.nome.toUpperCase()}
*Telefone:* ${pessoa2.telefone}
*Congregação:* ${(pessoa2.congregacao || '').toUpperCase()}`;

          const encodedText = encodeURIComponent(text);
          let phone = pessoa.telefone.replace(/\D/g, '');
          if (phone.length >= 10 && phone.length <= 11) {
            phone = '55' + phone;
          }

          window.open(`https://wa.me/${phone}?text=${encodedText}`, '_blank');

          // Se for reservado, não marcamos como enviado no banco pois não tem pessoa real lá
          if (!isReserved) {
            const escala = this.escalas.find(e => e.id === escalaId);
            if (escala) {
              const originalIndex = escala.vagos.indexOf(vago);
              if (originalIndex !== -1) {
                await this.markAsSent(escalaId, originalIndex, key);
                // Atualiza UI do botão
                btn.disabled = true;
                btn.style.backgroundColor = '#ccc';
                btn.style.cursor = 'not-allowed';
                btn.innerHTML = btn.innerHTML.replace(/Enviar.*/, 'Enviado');

                // Verifica se ambos foram enviados para atualizar o botão da tabela principal
                const p1Sent = vago.statusEnvio && vago.statusEnvio.pessoa1;
                const p2Sent = vago.statusEnvio && vago.statusEnvio.pessoa2;

                if (p1Sent && p2Sent) {
                  const mainBtn = /** @type {HTMLElement} */ (document.querySelector(`.btn-action[data-index="${displayedIndex}"]`));
                  if (mainBtn) {
                    mainBtn.style.backgroundColor = '#28a745';
                    mainBtn.style.color = 'white';
                  }
                }
              }
            }
          }
        });
        return btn;
      };

      const btnPrint = document.getElementById('btn-print-card');
      if (btnPrint && modalActions) {
        // Insere os botões novas
        modalActions.insertBefore(createShareButton(pessoa1, 'pessoa1'), btnPrint);
        modalActions.insertBefore(createShareButton(pessoa2, 'pessoa2'), btnPrint);
      }
    };

    setupButtons(p1, p2);
    modal.style.display = 'block';
  }

  /**
   * @param {any} vago
   * @param {string} escalaId
   * @param {number} displayedIndex
   */
  async procurarSubstituto(vago, escalaId, displayedIndex) {
    const contentDiv = document.getElementById('card-content');
    if (!contentDiv) return;

    contentDiv.innerHTML = '<h3>🔍 Buscando Substitutos...</h3><p>Analisando irmãos disponíveis e fila de espera...</p>';

    try {
      // 1. Identificar slotKey
      const dateObj = new Date(vago.data + 'T12:00:00');
      const diasSafe = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
      const diaCurto = diasSafe[dateObj.getDay()];
      const turnoNorm = vago.hora.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
      const slotKey = `${diaCurto}-${turnoNorm}`;

      // 2. Recalcular pontuação (simplificado)
      const { collection, getDocs } = await import("firebase/firestore");
      const escalasSnap = await getDocs(collection(db, "Escalas"));

      /** @type {Record<string, number>} */
      const pontuacoes = {};
      escalasSnap.forEach((/** @type {any} */ doc) => {
        (doc.data().vagos || []).forEach((/** @type {any} */ v) => {
          if (v.designacao?.pessoa1?.id) pontuacoes[v.designacao.pessoa1.id] = (pontuacoes[v.designacao.pessoa1.id] || 0) + 1;
          if (v.designacao?.pessoa2?.id) pontuacoes[v.designacao.pessoa2.id] = (pontuacoes[v.designacao.pessoa2.id] || 0) + 1;
        });
      });

      // 3. Filtrar candidatos
      const p1 = vago.designacao.pessoa1;
      const p2 = vago.designacao.pessoa2;
      const posicaoCancelada = vago.designacao.pessoa1Cancelou ? 1 : 2;

      // Tentar pegar o gênero da designação ou buscar na lista de participantes (fallback para escalas antigas)
      let generoRequerido = posicaoCancelada === 1 ? p1.genero : p2.genero;

      if (!generoRequerido) {
        const idBusca = posicaoCancelada === 1 ? p1.id : p2.id;
        const pOriginal = this.allParticipants.find((/** @type {any} */ p) => p.id === idBusca);
        generoRequerido = pOriginal?.genero;
      }

      let candidatos = this.allParticipants.filter((/** @type {any} */ p) => {
        // Disponível no slot exato? (Ex: quarta-manha-08:30-10:30)
        if (!p.disponibilidade || !p.disponibilidade.includes(slotKey)) return false;
        // Não é uma das pessoas já na vaga?
        if (p.id === p1.id || p.id === p2.id) return false;
        // Mesmo gênero
        if (p.genero !== generoRequerido) return false;
        return true;
      });

      let buscaAmpliada = false;
      // Se não achou ninguém com disponibilidade EXATA (dia e hora), amplia para quem tem disponibilidade nessa HORA em outros dias
      if (candidatos.length === 0) {
        buscaAmpliada = true;
        candidatos = this.allParticipants.filter((/** @type {any} */ p) => {
          // Tem disponibilidade nesse período independente do dia?
          const temPeriodo = p.disponibilidade?.some((/** @type {string} */ d) => d.includes(turnoNorm));
          if (!temPeriodo) return false;
          // Não é uma das pessoas já na vaga?
          if (p.id === p1.id || p.id === p2.id) return false;
          // Mesmo gênero
          if (p.genero !== generoRequerido) return false;
          return true;
        });
      }

      // Ordenar por pontuação (menor primeiro = mais prioridade)
      candidatos.sort((/** @type {any} */ a, /** @type {any} */ b) => (pontuacoes[a.id] || 0) - (pontuacoes[b.id] || 0));

      if (candidatos.length === 0) {
        contentDiv.innerHTML = `<h3>❌ Nenhum substituto encontrado</h3><p>Não há irmãos marcados para <b>${slotKey}</b> e nem para o período de <b>${vago.hora}</b> em outros dias do gênero <b>${generoRequerido}</b>.</p><button onclick="location.reload()" style="padding:10px; margin-top:10px;">Voltar</button>`;
        return;
      }

      // Renderizar resultados
      contentDiv.innerHTML = `
        <h3>${buscaAmpliada ? '🔍 Busca Ampliada' : '✅ Substitutos Encontrados'}</h3>
        ${buscaAmpliada ? `<p style="color: #d35400; font-weight: bold;">⚠️ Ninguém disponível para quarta-feira. Mostrando quem costuma servir de ${vago.hora} em outros dias:</p>` :
          `<p>Irmãos disponíveis para <b>${vago.data} - ${vago.hora}</b> ordenados pela fila de espera:</p>`}
        <div style="margin-top: 15px;">
          ${candidatos.slice(0, 5).map(c => `
            <div style="padding: 12px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 10px; background: white;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <strong>${c.nome}</strong><br>
                  <span style="font-size: 0.8em; color: #666;">${c.congregacao} | Escalas: ${pontuacoes[c.id] || 0}</span>
                </div>
                <button 
                  onclick="window.scaleViewer.aplicarSubstituicao('${escalaId}', ${displayedIndex}, ${posicaoCancelada}, ${JSON.stringify(c).replace(/"/g, '&quot;')})"
                  style="padding: 8px 12px; background: #128C7E; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">
                  Convidar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        <button onclick="location.reload()" style="width: 100%; margin-top: 10px; padding: 10px; background: #eee; border: 1px solid #ccc; border-radius: 5px;">Cancelar</button>
      `;

    } catch (err) {
      console.error(err);
      contentDiv.innerHTML = '<p>Erro ao buscar substitutos.</p>';
    }
  }

  /**
   * @param {string} escalaId
   * @param {number} vagoIndex
   * @param {number} posicao
   * @param {any} novoParticipante
   */
  async aplicarSubstituicao(escalaId, vagoIndex, posicao, novoParticipante) {
    if (!confirm(`Deseja substituir pelo irmão ${novoParticipante.nome}?`)) return;

    try {
      const { doc, getDoc, updateDoc } = await import("firebase/firestore");
      const escalaRef = doc(db, "Escalas", escalaId);
      const escalaSnap = await getDoc(escalaRef);

      if (escalaSnap.exists()) {
        const vagos = escalaSnap.data().vagos || [];
        const currentVago = this.currentVagos[vagoIndex];

        // Busca o vago original no array do Firestore
        const vago = vagos.find((/** @type {any} */ v) => v.data === currentVago.data && v.local === currentVago.local && v.hora === currentVago.hora);

        if (!vago) {
          alert('Erro: Não foi possível localizar a vaga original no banco de dados.');
          return;
        }

        // Atualiza a pessoa
        vago.designacao[`pessoa${posicao}`] = {
          id: novoParticipante.id,
          nome: novoParticipante.nome,
          telefone: novoParticipante.telefone,
          congregacao: novoParticipante.congregacao || '',
          genero: novoParticipante.genero // Mantém o gênero
        };
        // Reseta o cancelamento e status de envio
        vago.designacao[`pessoa${posicao}Cancelou`] = false;
        if (!vago.statusEnvio) vago.statusEnvio = {};
        vago.statusEnvio[`pessoa${posicao}`] = false;

        const texto = `Olá irmão *${novoParticipante.nome}*!\n\nSurgiu uma vaga para o TPUBLI e, como você está disponível, gostaríamos de contar com sua ajuda:\n\n📅 *Data:* ${vago.data}\n📍 *Local:* ${vago.local}\n🕐 *Horário:* ${vago.hora}\n\nVocê teria disponibilidade para assumir essa designação?`;
        let phone = novoParticipante.telefone.replace(/\D/g, '');
        if (phone.length === 10 || phone.length === 11) phone = '55' + phone;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(texto)}`;

        // Abre WhatsApp
        const win = window.open(whatsappUrl, '_blank');

        await updateDoc(escalaRef, { vagos });

        // Invalida caches para forçar recarregamento dos dados atualizados
        cache.invalidate('firestore', 'all_escalas');
        cache.invalidate('firestore', 'all_escalas_admin');

        if (!win || win.closed || typeof win.closed === 'undefined') {
          alert('Substituição realizada! Notifique o substituto no WhatsApp a seguir.');
          window.location.href = whatsappUrl;
        } else {
          alert('Substituição realizada com sucesso!');
          location.reload();
        }
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao aplicar substituição no sistema.');
    }
  }
}
