import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from '../services/firebase.js';
import { cache } from '../services/CacheService.js';

export default class ConsultaEscala {
  /**
   * @param {string} containerId
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.render();
    this.bindEvents();
  }

  /**
   * Mapeia período para horário específico
   * @param {string} periodo
   * @returns {string}
   */
  mapearHorario(periodo) {
    const horarios = {
      'manha': 'Manhã',
      'tarde': 'Tarde',
      'noite': 'Noite'
    };

    const periodoLower = periodo.toLowerCase();
    let label = periodo;
    for (const [key, value] of Object.entries(horarios)) {
      if (periodoLower.includes(key)) {
        label = value;
        break;
      }
    }

    // Adiciona o horário se disponível na string original
    const matches = periodo.match(/\d{2}-\d{2}/);
    if (matches) {
      return `${label} (${matches[0]})`;
    }

    return label;
  }

  render() {
    const container = document.querySelector(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="consulta-escala-container">
        <div class="dashboard-card">
          <h2>Buscar Minhas Designações</h2>
          <form id="consulta-form" class="consulta-form">
            <div class="form-group">
              <label for="telefone-busca">Seu Telefone/WhatsApp:</label>
              <input type="tel" id="telefone-busca" placeholder="Digite seu telefone" required>
            </div>
            <button type="submit" class="btn-primary">
              <span class="icon">🔍</span> Buscar
            </button>
          </form>
        </div>

        <div id="resultados-container"></div>
      </div>
    `;
  }

  bindEvents() {
    const form = /** @type {HTMLFormElement|null} */ (document.querySelector('#consulta-form'));
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const telefoneInput = /** @type {HTMLInputElement|null} */ (document.querySelector('#telefone-busca'));
      if (!telefoneInput) return;

      const telefone = telefoneInput.value.trim();
      if (!telefone) return;

      await this.buscarDesignacoes(telefone);
    });
  }

  /**
   * Busca todas as designações de uma pessoa pelo telefone
   * @param {string} telefone
   */
  async buscarDesignacoes(telefone) {
    const resultadosContainer = document.querySelector('#resultados-container');
    if (!resultadosContainer) return;

    // Mostra loading
    resultadosContainer.innerHTML = `
      <div class="dashboard-card">
        <p style="text-align: center;">🔍 Buscando suas designações...</p>
      </div>
    `;

    try {
      // Helper para normalizar telefone (apenas números)
      const normalizar = (/** @type {string} */ t) => String(t || '').replace(/\D/g, '');
      const telBuscaNorm = normalizar(telefone);

      if (telBuscaNorm.length < 8) {
        resultadosContainer.innerHTML = `
          <div class="dashboard-card">
            <h3>⚠️ Telefone muito curto</h3>
            <p>Por favor, digite o telefone com DDD.</p>
          </div>
        `;
        return;
      }

      // Busca todos os participantes para encontrar o match por telefone normalizado
      // Isso é necessário porque o Firestore não permite busca por "apenas números"
      const pessoasRef = collection(db, 'Pessoas');
      const allParticipantsDocs = await cache.cachedGetDocs(
        async () => await getDocs(pessoasRef),
        'all_participants_lookup',
        60 // 1 hora
      );

      const pessoaDoc = allParticipantsDocs.find((/** @type {any} */ p) => normalizar(p.telefone) === telBuscaNorm);

      if (!pessoaDoc) {
        resultadosContainer.innerHTML = `
          <div class="dashboard-card">
            <h3>❌ Cadastro não encontrado</h3>
            <p>Não encontramos nenhum cadastro com o telefone <strong>${telefone}</strong>.</p>
            <p>Verifique se você digitou o DDD corretamente ou se já realizou seu cadastro no sistema.</p>
          </div>
        `;
        return;
      }

      const targetId = pessoaDoc.id;
      const nomePessoa = pessoaDoc.nome;

      // Busca todas as escalas (com cache)
      const escalasRef = collection(db, 'Escalas');
      const escalas = await cache.cachedGetDocs(
        async () => await getDocs(escalasRef),
        'all_escalas_consulta',
        30 // 30 min cache
      );

      /** @type {any[]} */
      const designacoes = [];

      escalas.forEach((/** @type {any} */ escala) => {
        const vagosArray = escala.vagos || [];
        vagosArray.forEach((/** @type {any} */ vago, /** @type {number} */ vagoIndex) => {
          if (vago.designacao) {
            const p1Id = vago.designacao.pessoa1?.id;
            const p2Id = vago.designacao.pessoa2?.id;

            // Busca por ID é muito mais segura que por telefone ou nome
            if (p1Id === targetId || p2Id === targetId) {
              const posicao = p1Id === targetId ? 1 : 2;
              const parceiro = posicao === 1 ? vago.designacao.pessoa2 : vago.designacao.pessoa1;

              designacoes.push({
                escalaId: escala.id,
                vagoIndex: vagoIndex,
                posicao: posicao,
                data: vago.data,
                local: vago.local,
                hora: vago.hora,
                parceiro: parceiro,
                cancelado: vago.designacao[`pessoa${posicao}Cancelou`] || false
              });
            }
          }
        });
      });

      if (designacoes.length === 0) {
        resultadosContainer.innerHTML = `
          <div class="dashboard-card">
            <h3>📋 Nenhuma Designação Encontrada</h3>
            <p>Olá, <strong>${nomePessoa}</strong>!</p>
            <p>Você ainda não foi designado(a) em nenhuma escala este mês.</p>
          </div>
        `;
        return;
      }

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const designacoesFuturas = designacoes.filter(d => {
        const [ano, mes, dia] = d.data.split('-').map(Number);
        const dataDesignacao = new Date(ano, mes - 1, dia);
        return dataDesignacao >= hoje;
      }).sort((a, b) => a.data.localeCompare(b.data));

      if (designacoesFuturas.length === 0) {
        resultadosContainer.innerHTML = `
          <div class="dashboard-card">
            <h3>📋 Nenhuma Designação Futura</h3>
            <p>Olá, <strong>${nomePessoa}</strong>!</p>
            <p>Você não tem designações futuras agendadas no momento.</p>
          </div>
        `;
        return;
      }

      resultadosContainer.innerHTML = `
        <div class="dashboard-card">
          <h3>✅ Suas Designações</h3>
          <p>Olá, <strong>${nomePessoa}</strong>! Você tem <strong>${designacoesFuturas.length}</strong> designação(ões) futuras:</p>
        </div>
        
        <div class="designacoes-grid">
          ${designacoesFuturas.map((d, i) => this.renderDesignacao(d, i, nomePessoa)).join('')}
        </div>
        
        <style>
          .designacoes-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1rem;
            margin-top: 1rem;
          }
          .designacao-card {
            background: var(--surface-color);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 1.2rem;
            position: relative;
            display: flex;
            flex-direction: column;
          }
          .designacao-card::before {
            content: ''; position: absolute; top:0; left:0; right:0; height:4px;
            background: var(--primary-color); border-radius: 12px 12px 0 0;
          }
          .designacao-card.cancelada::before { background: #e74c3c; }
          .designacao-row { display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border-color); }
          .designacao-label { font-weight: 600; color: var(--text-secondary); }
          .btn-cancel {
            margin-top: 1rem; padding: 8px; border-radius: 6px; border: 1px solid #e74c3c;
            color: #e74c3c; background: transparent; cursor: pointer; font-weight: bold;
          }
          .btn-cancel:hover { background: #e74c3c; color: white; }
          .status-cancelado {
            margin-top: 1rem; padding: 8px; background: #fee; color: #e74c3c;
            border-radius: 6px; text-align: center; font-weight: bold;
          }
        </style>
      `;

      // Eventos
      document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const b = /** @type {HTMLButtonElement} */ (e.currentTarget);
          const data = b.dataset;
          if (confirm(`Atenção ${nomePessoa}!\n\nDeseja informar que não poderá ir no dia ${data.data || ''}?`)) {
            await this.notificarCancelamento(
              data.escalaid || '',
              parseInt(data.vagoindex || '0'),
              parseInt(data.posicao || '0'),
              nomePessoa,
              data.data || '',
              data.local || '',
              data.hora || ''
            );
          }
        });
      });

    } catch (error) {
      console.error(error);
      resultadosContainer.innerHTML = `<div class="dashboard-card"><h3>❌ Erro ao buscar</h3></div>`;
    }
  }

  /**
   * @param {string} escalaId
   * @param {number} _vagoIndex
   * @param {number} posicao
   * @param {string} publicador
   * @param {string} data
   * @param {string} local
   * @param {string} hora
   */
  async notificarCancelamento(escalaId, /** @type {number} */ _vagoIndex, posicao, publicador, data, local, hora) {
    const adminPhone = '5587996006304';
    const [ano, mes, dia] = data.split('-').map(Number);
    const dataFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
    const texto = `🚨 *AVISO DE IMPOSSIBILIDADE* 🚨\n\nOlá, sou o *${publicador}*.\nInfelizmente *não poderei ir* no TPUBLI:\n\n📅 *Data:* ${dataFormatada}\n📍 *Local:* ${local}\n🕐 *Horário:* ${hora}`;
    const whatsappUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(texto)}`;

    // Tenta abrir o WhatsApp imediatamente para aproveitar o evento de clique do usuário
    // Isso evita bloqueio de popup em navegadores mais rígidos
    const win = window.open(whatsappUrl, '_blank');

    try {
      const escalaRef = doc(db, "Escalas", escalaId);
      const escalaSnap = await getDoc(escalaRef);
      if (escalaSnap.exists()) {
        const dataSnap = escalaSnap.data();
        const vagos = dataSnap.vagos || [];

        // Busca o vago correto pelas propriedades (mais seguro que index)
        // Usamos trim() e normalize para garantir o match mesmo com variações de espaços
        const vago = vagos.find((/** @type {any} */ v) => {
          return v.data === data &&
            v.local?.trim() === local?.trim() &&
            v.hora?.trim() === hora?.trim();
        });

        if (vago && vago.designacao) {
          // Garante que o objeto designacao existe e marca o cancelamento
          vago.designacao[`pessoa${posicao}Cancelou`] = true;
          await updateDoc(escalaRef, { vagos });
          console.log('✅ Escala atualizada com sucesso no Firestore');
        } else {
          console.error('❌ Vago não encontrado:', { data, local, hora });
          throw new Error('Não foi possível localizar sua designação no servidor.');
        }
      }

      // Invalida caches para forçar recarregamento dos dados atualizados
      cache.clearAll(); // Limpa tudo para garantir que o admin e o usuário vejam a mudança
      console.log('🗑️ Cache limpo');

      // Se o window.open falhou (bloqueado), tenta redirecionar na mesma aba como último recurso
      if (!win || win.closed || typeof win.closed === 'undefined') {
        alert('Cancelamento registrado! Notifique o administrador no WhatsApp a seguir.');
        window.location.href = whatsappUrl;
      } else {
        alert('Cancelamento registrado com sucesso!');
        location.reload();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao registrar cancelamento no sistema, mas os detalhes foram enviados.');
    }
  }

  /**
   * @param {any} d
   * @param {number} _i
   * @param {string} _nomePessoa
   */
  renderDesignacao(d, _i, _nomePessoa) {
    const horario = this.mapearHorario(d.hora);
    const cancelado = d.cancelado;

    return `
      <div class="designacao-card ${cancelado ? 'cancelada' : ''}">
        <div class="designacao-row">
          <span class="designacao-label">📅 Data:</span>
          <span>${new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
        </div>
        <div class="designacao-row">
          <span class="designacao-label">🕐 Horário:</span>
          <span>${horario}</span>
        </div>
        <div class="designacao-row">
          <span class="designacao-label">📍 Local:</span>
          <span>${d.local}</span>
        </div>
        <div class="designacao-row">
          <span class="designacao-label">👥 Parceiro:</span>
          <span>${d.parceiro?.nome || '...'}</span>
        </div>
        
        ${cancelado
        ? `<div class="status-cancelado">VOCÊ AVISOU QUE NÃO VAI</div>`
        : `<button class="btn-cancel" 
              style="display: none;" 
              data-escalaid="${d.escalaId}" 
              data-vagoindex="${d.vagoIndex}" 
              data-posicao="${d.posicao}"
              data-data="${d.data}"
              data-local="${d.local}"
              data-hora="${d.hora}">Não poderei ir</button>`
      }
      </div>
    `;
  }
}
