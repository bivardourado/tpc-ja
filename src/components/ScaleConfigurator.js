import ScaleService from '../services/ScaleService.js';

export default class ScaleConfigurator {
  /**
   * @param {string} containerId
   */
  constructor(containerId) {
    this.containerId = containerId;
    this.scaleService = new ScaleService();
    this.render();
    this.bindEvents();
  }

  render() {
    const container = document.querySelector(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <h2>Gerar Nova Escala</h2>
      <form id="scale-form" class="scale-form">
        <div class="form-group">
          <label for="periodo">Período (Mês/Ano):</label>
          <input type="text" id="periodo" name="periodo" placeholder="Ex: Janeiro/2025" required>
        </div>
        
        <div class="row">
          <div class="form-group half">
            <label for="diaInicial">Começar do Dia (opcional):</label>
            <input type="number" id="diaInicial" name="diaInicial" min="1" max="31" placeholder="Ex: 10">
          </div>
        </div>

        <!-- Nova Área de Reserva -->
        <fieldset style="border: 1px solid #ddd; padding: 10px; margin-bottom: 15px; border-radius: 5px;">
          <legend style="font-size: 0.9em; font-weight: bold; color: var(--primary-color);">Reserva Especial (Opcional)</legend>
          <div class="row">
            <div class="form-group half">
              <label for="diaReservado">Dia:</label>
              <input type="number" id="diaReservado" min="1" max="31" placeholder="Ex: 15">
            </div>
            <div class="form-group half">
              <label for="turnoReservado">Turno:</label>
              <select id="turnoReservado">
                <option value="">Selecione...</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
              </select>
            </div>
          </div>
          <small style="color: var(--text-secondary);">Deixe vazio se não quiser reservar nada. O sistema deixará este horário vago.</small>
        </fieldset>
        
        <div class="form-actions">
          <button type="submit" class="btn-primary">
            <span class="icon">📅</span> Gerar Escala
          </button>
        </div>
      </form>
      <div id="message-area"></div>
    `;
  }

  bindEvents() {
    const form = document.querySelector('#scale-form');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const inputPeriodo = /** @type {HTMLInputElement|null} */ (document.querySelector('#periodo'));
      const inputDiaInicial = /** @type {HTMLInputElement|null} */ (document.querySelector('#diaInicial'));
      const inputDiaReservado = /** @type {HTMLInputElement|null} */ (document.querySelector('#diaReservado'));
      const selectTurnoReservado = /** @type {HTMLSelectElement|null} */ (document.querySelector('#turnoReservado'));

      if (!inputPeriodo) return;

      const periodo = inputPeriodo.value;
      const diaInicial = inputDiaInicial?.value ? parseInt(inputDiaInicial.value) : null;
      const diaReservado = inputDiaReservado?.value ? parseInt(inputDiaReservado.value) : null;
      const turnoReservado = selectTurnoReservado?.value || null;

      const btn = /** @type {HTMLButtonElement|null} */ (form.querySelector('button'));
      if (!btn) return;

      const originalText = btn.innerHTML;

      try {
        btn.disabled = true;
        btn.innerText = 'Gerando...';

        await this.scaleService.gerarEscala(periodo, diaInicial, diaReservado, turnoReservado);

        const mensagem = diaInicial
          ? `Escala para "${periodo}" gerada a partir do dia ${diaInicial} e salva com sucesso!`
          : `Escala para "${periodo}" gerada e salva com sucesso!`;
        alert(mensagem);

        const formElement = /** @type {HTMLFormElement} */ (form);
        formElement.reset();
      } catch (error) {
        console.error("Erro ao gerar escala:", error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        alert(`Erro: ${errorMessage}`);
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  }
}