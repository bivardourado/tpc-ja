import { collection, getDocs, query, addDoc, updateDoc, doc, where, setDoc } from "firebase/firestore";
import { db } from './firebase.js';
import { cache } from './CacheService.js';

export default class ScaleService {
  constructor() {
    this.db = db;
  }

  /**
   * Gera uma nova escala ou atualiza uma existente (Smart Merge).
   * @param {string} periodo - O período da escala (ex: "Janeiro/2025").
   * @param {number|null} [diaInicialEspecificado] - Dia inicial opcional.
   * @param {number|null} [diaReservado] - Dia a ser reservado (opcional).
   * @param {string|null} [turnoReservado] - Turno a ser reservado (opcional).
   * @returns {Promise<string>} - O ID do documento da escala criada/atualizada.
   */
  async gerarEscala(periodo, diaInicialEspecificado = null, diaReservado = null, turnoReservado = null) {
    console.log(`[ScaleService] Iniciando processamento da escala para: ${periodo}`);

    // Etapa 0: Verificar se já existe escala p/ este período (para evitar duplicatas e permitir merge)
    const q = query(collection(this.db, "Escalas"), where("periodo", "==", periodo));
    const snapshot = await getDocs(q);
    let idExistente = null;
    let vagosPreservados = [];

    // Limpar Cache antes de começar para garantir dados frescos
    cache.invalidate('escalas_historico');

    if (!snapshot.empty) {
      const docData = snapshot.docs[0];
      idExistente = docData.id;
      console.log(`[ScaleService] ⚠️ Escala existente encontrada (ID: ${idExistente}). Modo de ATUALIZAÇÃO ativado.`);

      // Se houver dia inicial especificado (> 1), precisamos preservar o passado
      if (diaInicialEspecificado && diaInicialEspecificado > 1) {
        const dadosAntigos = docData.data();
        const todosVagos = dadosAntigos.vagos || [];

        // Filtra para manter apenas dias ANTERIORES ao dia de corte
        vagosPreservados = todosVagos.filter((/** @type {any} */ v) => {
          if (!v.data) return false;
          const diaVago = parseInt(v.data.split('-')[2]); // Ex: "2026-01-15" -> 15
          return diaVago < diaInicialEspecificado;
        });

        console.log(`[ScaleService] 🛡️ Preservando ${vagosPreservados.length} slots do período anterior ao dia ${diaInicialEspecificado}.`);

        // TRUQUE DE MESTRE:
        // Salvamos IMEDIATAMENTE a versão "cortada" no banco.
        // Por que? Para que na hora de calcular pontuação (Step 2), o sistema NÃO VEJA 
        // as designações futuras (que vamos apagar/refazer) como "já realizadas".
        // Isso evita que o algoritmo penalize alguém por uma escala que vai deixar de existir.
        await setDoc(doc(this.db, "Escalas", idExistente), {
          ...dadosAntigos,
          vagos: vagosPreservados, // Apenas o passado
          dataAtualizacao: new Date()
        }, { merge: true });

        console.log(`[ScaleService] 🧹 Futuro limpo temporariamente para garantir sorteio justo.`);
      }
    }

    // Etapa 1: Definir locais
    const locais = await this.carregarLocais();
    if (locais.length === 0) throw new Error('Nenhum local cadastrado.');

    // Etapa 2: Carregar dados (agora com o histórico "limpo" se foi merge)
    // Forçamos limpeza de cache de novo só por segurança
    cache.invalidate('escalas_historico');
    const { participants, historicoDuplas, historicoPorSlot } = await this.carregarParticipantesComPontuacao();

    if (participants.length === 0) throw new Error('Nenhum participante encontrado.');

    // Etapa 3: Gerar NOVOS vagos (do diaInicial pra frente)
    const novosVagos = this.gerarVagos(periodo, locais, diaInicialEspecificado);
    console.log(`[ScaleService] Gerados ${novosVagos.length} novos slots a preencher.`);

    // Etapa 4: Preencher APENAS os novos vagos
    // Nota: O históricoPorSlot já considera os preservados pq eles estão no banco
    this.preencherVagos(novosVagos, participants, historicoDuplas, historicoPorSlot, diaReservado, turnoReservado);

    // Etapa 5: Unir Passado + Futuro
    const vagosFinais = [...vagosPreservados, ...novosVagos];

    // Etapa 6: Salvar (Update ou Create)
    const escalaId = await this.salvarEscala(periodo, vagosFinais, idExistente);

    // Etapa 7: Reset
    await this.resetarIndisponibilidadeProximoMes();

    return escalaId;
  }
  // ... (mantém métodos intermediários iguais) ...

  // Etapa de ajuda (vazia por enquanto)

  async carregarLocais() {
    try {
      // Usa cache para evitar carregar locais toda vez
      // TTL: 24 horas (1440 min) - Locais raramente mudam
      const locais = await cache.cachedGetDocs(
        async () => await getDocs(query(collection(this.db, "Locais"))),
        'locais',
        1440 // 24 horas
      );

      const locaisFormatados = locais.map(/** @param {any} localData */(localData) => ({
        id: localData.id,
        nome: localData.nome,
        configuracao: localData.configuracao || null,
        turnos: localData.turnos || ['Manhã', 'Tarde', 'Noite'],
        dias: localData.dias || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
      }));

      // Fallback se não houver locais cadastrados
      if (locaisFormatados.length === 0) {
        console.warn('[ScaleService] Nenhum local encontrado no banco. Usando padrão.');
        return [{
          id: 'default',
          nome: 'Portaria Principal',
          configuracao: {
            'Segunda': ['Manhã', 'Tarde', 'Noite'],
            'Terça': ['Manhã', 'Tarde', 'Noite'],
            'Quarta': ['Manhã', 'Tarde', 'Noite'],
            'Quinta': ['Manhã', 'Tarde', 'Noite'],
            'Sexta': ['Manhã', 'Tarde', 'Noite'],
            'Sábado': ['Manhã', 'Tarde', 'Noite'],
            'Domingo': ['Manhã', 'Tarde', 'Noite']
          },
          turnos: ['Manhã 08:30-10:30', 'Manhã 10-12', 'Tarde 14-16', 'Tarde 16-18', 'Noite 18-20'],
          dias: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
        }];
      }

      return locaisFormatados;
    } catch (error) {
      console.error("[ScaleService] Erro ao carregar locais:", error);
      // Fallback em caso de erro
      return [{
        id: 'default',
        nome: 'Portaria Principal',
        configuracao: {
          'Segunda': ['Manhã', 'Tarde', 'Noite'],
          'Terça': ['Manhã', 'Tarde', 'Noite'],
          'Quarta': ['Manhã', 'Tarde', 'Noite'],
          'Quinta': ['Manhã', 'Tarde', 'Noite'],
          'Sexta': ['Manhã', 'Tarde', 'Noite'],
          'Sábado': ['Manhã', 'Tarde', 'Noite'],
          'Domingo': ['Manhã', 'Tarde', 'Noite']
        },
        turnos: ['Manhã', 'Tarde', 'Noite'],
        dias: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
      }];
    }
  }

  async carregarParticipantesComPontuacao() {
    try {
      console.log('[ScaleService] Carregando participantes DIRETAMENTE do Firebase (sem cache)...');

      // 🔥 CRÍTICO: NÃO USAR CACHE AQUI!
      // O cache estava causando bug onde participantes indisponíveis ficavam excluídos permanentemente
      // Agora sempre buscamos dados frescos do Firebase
      const participantsSnap = await getDocs(query(collection(this.db, "Pessoas")));
      const allParticipants = participantsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`[ScaleService] 📊 Total de pessoas no banco: ${allParticipants.length}`);

      // Filtrar participantes que marcaram "Não poderei participar no próximo mês"
      const participants = allParticipants.filter((/** @type {any} */ p) => !p.indisponivelProximoMes);

      console.log(`[ScaleService] 📊 Participantes disponíveis (após filtro): ${participants.length}`);

      const participantesExcluidos = allParticipants.length - participants.length;
      if (participantesExcluidos > 0) {
        console.log(`[ScaleService] ${participantesExcluidos} participante(s) excluído(s) por indisponibilidade no próximo mês.`);
      }

      if (participants.length === 0) return { participants: [], historicoDuplas: {}, historicoPorSlot: {} };

      console.log('[ScaleService] Calculando pontuação de prioridade, histórico de duplas e sub-rodízios...');
      /** @type {Record<string, number>} */
      const pontuacoes = {};
      /** @type {Record<string, number>} */
      const historicoDuplas = {}; // Chave: 'id1_id2'
      /** @type {Record<string, Record<string, number>>} */
      const historicoPorSlot = {}; // Chave: id -> { 'segunda-manha': 5 }

      /** @param {string} id1 @param {string} id2 */
      const getDuplaKey = (id1, id2) => {
        return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
      };



      try {
        // Usa cache para escalas
        // TTL: 24 horas (1440 min) - Escalas mudam 1x/mês
        const escalasData = await cache.cachedGetDocs(
          async () => await getDocs(query(collection(this.db, "Escalas"))),
          'escalas_historico',
          1440 // 24 horas
        );
        escalasData.forEach(/** @param {any} escala */(escala) => {
          const vagos = escala.vagos || [];
          vagos.forEach(/** @param {any} vago */(vago) => {
            const pessoa1 = vago.designacao?.pessoa1?.id;
            const pessoa2 = vago.designacao?.pessoa2?.id;

            // Identificar Slot (Dia-Periodo)
            let slotKey = null;
            if (vago.data && vago.hora) {
              // Parse manual da data para evitar problemas de timezone
              const [ano, mes, dia] = vago.data.split('-').map(Number);
              const dataObj = new Date(ano, mes - 1, dia);
              const diaIndex = dataObj.getDay(); // 0 = Domingo, ...

              const diasSafe = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
              const diaCurto = diasSafe[diaIndex];

              if (diaCurto) {
                slotKey = `${diaCurto}-${vago.hora.toLowerCase()}`;
              }
            }

            // Helper para incrementar slot
            const incSlot = (/** @type {string} */ pid, /** @type {string | null} */ key) => {
              if (!pid || !key) return;
              if (!historicoPorSlot[pid]) historicoPorSlot[pid] = {};
              historicoPorSlot[pid][key] = (historicoPorSlot[pid][key] || 0) + 1;
            };

            // Contagem de Pontuação Individual (Global)
            if (pessoa1) {
              pontuacoes[pessoa1] = (pontuacoes[pessoa1] || 0) + 1;
              incSlot(pessoa1, slotKey);
            }
            if (pessoa2) {
              pontuacoes[pessoa2] = (pontuacoes[pessoa2] || 0) + 1;
              incSlot(pessoa2, slotKey);
            }

            // Contagem de Histórico de Duplas
            if (pessoa1 && pessoa2) {
              const key = getDuplaKey(pessoa1, pessoa2);
              historicoDuplas[key] = (historicoDuplas[key] || 0) + 1;
            }
          });
        });
      } catch (error) {
        console.warn('[ScaleService] Coleção "Escalas" não encontrada ou vazia, assumindo pontuação zero e histórico vazio.', error);
      }

      const participantsComPontuacao = participants.map(/** @param {any} p */(p) => ({
        ...p,
        pontuacaoPrioridade: pontuacoes[p.id] || 0
      }));

      return { participants: participantsComPontuacao, historicoDuplas, historicoPorSlot };
    } catch (error) {
      console.error("[ScaleService] Erro ao carregar participantes:", error);
      throw error;
    }
  }

  /**
   * @param {string} periodo
   * @param {Array<{id: string, nome: string, configuracao?: Object<string, string[]>, turnos?: string[], dias?: string[]}>} locais
   * @param {number|null} [diaInicialEspecificado] - Dia inicial opcional
   */
  gerarVagos(periodo, locais, diaInicialEspecificado = null) {
    /** @param {number} year @param {number} month */
    const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
    const [mesNome, ano] = periodo.toLowerCase().split('/');
    /** @type {Record<string, number>} */
    const meses = { 'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril': 3, 'maio': 4, 'junho': 5, 'julho': 6, 'agosto': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11 };

    if (meses[mesNome] === undefined) {
      throw new Error(`Mês inválido: ${mesNome}`);
    }

    const mesNumero = meses[mesNome];
    const diasNoMes = getDaysInMonth(parseInt(ano), mesNumero + 1);
    /** @type {Array<{data: string, hora: string, local: string, designacao: any}>} */
    const vagos = [];



    // Determinar dia inicial
    let diaInicial = 1;

    if (diaInicialEspecificado !== null) {
      diaInicial = diaInicialEspecificado;
      console.log(`[ScaleService] Usando dia inicial especificado: ${diaInicial}`);
    } else {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      const mesAtual = hoje.getMonth();
      const diaAtual = hoje.getDate();

      if (parseInt(ano) === anoAtual && mesNumero === mesAtual) {
        diaInicial = diaAtual;
        console.log(`[ScaleService] Gerando escala a partir do dia ${diaInicial} (dia atual)`);
      } else {
        console.log(`[ScaleService] Gerando escala a partir do dia 1`);
      }
    }

    // Validar dia inicial
    if (diaInicial < 1 || diaInicial > diasNoMes) {
      throw new Error(`Dia inicial inválido: ${diaInicial}. Deve estar entre 1 e ${diasNoMes} para ${mesNome}/${ano}.`);
    }

    const diasSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    // Gerar vagos respeitando a configuração de cada local
    for (let dia = diaInicial; dia <= diasNoMes; dia++) {
      const dataObj = new Date(parseInt(ano), mesNumero, dia);
      const diaSemana = diasSemanaNomes[dataObj.getDay()];

      if (!diaSemana) {
        // Should not happen with getDay() 0-6
        continue;
      }

      for (const local of locais) {
        // Verificar se o local tem configuração
        if (local.configuracao) {
          // Usar configuração detalhada
          const turnosDoLocal = local.configuracao[diaSemana];

          if (!turnosDoLocal || turnosDoLocal.length === 0) {
            // Este local não opera neste dia da semana
            continue;
          }

          // Criar vagos apenas para os turnos configurados
          turnosDoLocal.forEach(turno => {
            // Formatar Data Manualmente (YYYY-MM-DD) para evitar deslocamento de fuso
            const y = dataObj.getFullYear();
            const m = String(dataObj.getMonth() + 1).padStart(2, '0');
            const d = String(dataObj.getDate()).padStart(2, '0');
            const dataStr = `${y}-${m}-${d}`;

            vagos.push({
              data: dataStr,
              hora: turno, // Já vem no formato correto: "Manhã", "Tarde", "Noite"
              local: local.nome,
              designacao: null
            });
          });
        } else {
          // Fallback para formato antigo (sem configuração detalhada)
          // Verifica se o dia da semana está na lista de dias
          if (local.dias && !local.dias.includes(diaSemana)) {
            continue;
          }

          // Criar vagos para os turnos configurados
          const turnosDoLocal = local.turnos || ['Manhã', 'Tarde', 'Noite'];
          turnosDoLocal.forEach(turno => {
            // Formatar Data Manualmente (YYYY-MM-DD)
            const y = dataObj.getFullYear();
            const m = String(dataObj.getMonth() + 1).padStart(2, '0');
            const d = String(dataObj.getDate()).padStart(2, '0');
            const dataStr = `${y}-${m}-${d}`;

            vagos.push({
              data: dataStr,
              hora: turno,
              local: local.nome,
              designacao: null
            });
          });
        }
      }
    }

    return vagos;
  }

  /**
   * @param {any[]} vagos
   * @param {any[]} participantsComPontuacao
   * @param {Record<string, number>} historicoDuplas
   * @param {Record<string, Record<string, number>>} historicoPorSlot
   * @param {number|null} [diaReservado]
   * @param {string|null} [turnoReservado]
   */
  preencherVagos(vagos, participantsComPontuacao, historicoDuplas, historicoPorSlot, diaReservado = null, turnoReservado = null) {


    /** @param {string} id1 @param {string} id2 */
    const getDuplaKey = (id1, id2) => {
      return id1 < id2 ? `${id1}_${id2}` : `${id2}_${id1}`;
    };

    /** Helper para pegar o número da semana do ano (ISO) */
    const getWeekNumber = (/** @type {string} */ dateStr) => {
      const d = new Date(dateStr + 'T12:00:00');
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + 4 - (d.getDay() || 7));
      const yearStart = new Date(d.getFullYear(), 0, 1);
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${d.getFullYear()}-W${weekNo}`;
    };

    // Clona para não mutar o original
    const participants = participantsComPontuacao.map(/** @param {any} p */(p) => ({
      ...p,
      designacoesNoMes: p.designacoesNoMes || 0, // Mantém se já vier preenchido (merge)
      designacoesNoDia: p.designacoesNoDia || {},
      designacoesNaSemana: {} // Tracker de semana
    }));

    // Flag para garantir que reservamos APENAS UM local/vaga
    let reservaJaAplicada = false;

    for (const vago of vagos) {
      const [ano, mes, dia] = vago.data.split('-').map(Number);
      const dataObj = new Date(ano, mes - 1, dia);
      const diaIndex = dataObj.getDay();
      const weekKey = getWeekNumber(vago.data);

      const diasSafe = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
      const diaCurto = diasSafe[diaIndex];

      const turnoNormalizado = vago.hora
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');

      const slotKey = `${diaCurto}-${turnoNormalizado}`;

      // LÓGICA DE RESERVA
      if (diaReservado !== null && turnoReservado !== null && !reservaJaAplicada) {
        const turnoResNorm = turnoReservado.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (dia === diaReservado && turnoNormalizado === turnoResNorm) {
          vago.observacao = 'RESERVADO';
          vago.designacao = null;
          reservaJaAplicada = true;
          continue;
        }
      }

      /** 
       * NORMALIZAÇÃO INTELIGENTE: 
       * Transforma "Terça-feira - 18:00-20:00" em "terca18002000"
       * Mantém palavras como "manha", "tarde", "noite" para garantir o vínculo.
       */
      const smartNorm = (/** @type {string} */ txt) => {
        return txt.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove acentos
          .replace(/feira/g, '')           // "terca-feira" -> "terca"
          .replace(/[^a-z0-9]/g, '');      // Remove símbolos e espaços (mantém letras/números)
      };

      const diaBusca = smartNorm(diaCurto); // ex: "terca"
      const turnoBusca = smartNorm(vago.hora); // ex: "noite1820"

      // Identifica o dia anterior para evitar escalas seguidas (Hard Block)
      const dRef = new Date(vago.data + 'T12:00:00');
      dRef.setDate(dRef.getDate() - 1);
      const ontem = dRef.toISOString().split('T')[0];

      // Filtro 1: Disponibilidade, Regras de Repetição e Limites
      const candidatos = participants.filter(/** @param {any} p */(p) => {
        // 1. Proibição de Dias Seguidos ou Mesmos Dias (Hard Block para todos)
        if (!p.disponibilidade || p.designacoesNoDia[vago.data] || p.designacoesNoDia[ontem]) {
          return false;
        }

        // 2. Limite Semanal Condicional:
        // - Se frequencia <= 4: Máximo 1x por semana.
        // - Se frequencia > 4: Sem limite semanal (respeita apenas a regra de dias seguidos).
        const freq = p.frequenciaMaxima || 0;
        const jaTrabalhouNaSemana = p.designacoesNaSemana[weekKey] || 0;

        if (freq <= 4 && jaTrabalhouNaSemana >= 1 && !p.excecaoSemanal) {
          return false;
        }

        return p.disponibilidade.some((/** @type {string} */ userDisp) => {
          const uNorm = smartNorm(userDisp);

          // A disponibilidade do usuário deve conter o DIA (ex: "terca")
          if (!uNorm.includes(diaBusca)) return false;

          // E deve haver um match parcial no TURNO:
          // Se o vago é "noite1820" e o user é "noite" -> Match!
          // Se o vago é "noite1820" e o user é "noite1820" -> Match!
          const userTurnoOnly = uNorm.replace(diaBusca, '');
          return turnoBusca.includes(userTurnoOnly) || userTurnoOnly.includes(turnoBusca);
        });
      });

      if (candidatos.length < 2) continue;

      const duplasPossiveis = [];
      for (let i = 0; i < candidatos.length; i++) {
        for (let j = i + 1; j < candidatos.length; j++) {
          const p1 = candidatos[i];
          const p2 = candidatos[j];

          const tel1 = (p1.telefone || '').replace(/\D/g, '');
          const tel2 = (p2.telefone || '').replace(/\D/g, '');

          if (p1.id === p2.id || p1.nome === p2.nome || (tel1.length > 8 && tel1 === tel2)) {
            continue;
          }

          const saoConjuges = (p1.conjuge && p1.conjuge.toLowerCase() === p2.nome.toLowerCase()) ||
            (p2.conjuge && p2.conjuge.toLowerCase() === p1.nome.toLowerCase());

          if (p1.genero === p2.genero || saoConjuges) {
            if (p1.designacoesNoMes < p1.frequenciaMaxima && p2.designacoesNoMes < p2.frequenciaMaxima) {

              // --- PESOS AJUSTADOS ---
              const pesoMes = 100000;
              const scoreMes = (p1.designacoesNoMes + p2.designacoesNoMes) * pesoMes;

              const pesoGlobal = 1000;
              const scoreGlobal = (p1.pontuacaoPrioridade + p2.pontuacaoPrioridade) * pesoGlobal;

              const pesoSlot = 100;
              const histSlot1 = (historicoPorSlot[p1.id] && historicoPorSlot[p1.id][slotKey]) || 0;
              const histSlot2 = (historicoPorSlot[p2.id] && historicoPorSlot[p2.id][slotKey]) || 0;
              const scoreSlot = (histSlot1 + histSlot2) * pesoSlot;

              const duplaKey = getDuplaKey(p1.id, p2.id);
              const contagemDupla = historicoDuplas[duplaKey] || 0;
              const pesoDupla = 20000; // AUMENTADO PARA EVITAR REPETIÇÃO DE PARCEIRO
              const scoreDupla = contagemDupla * pesoDupla;

              // --- BÔNUS PARA CASAIS ---
              let scoreBonusCasal = 0;
              if (saoConjuges && contagemDupla === 0) {
                scoreBonusCasal = -1000000;
              }

              // Penalidade de Dias Consecutivos (AUMENTADA)
              const dataRef = new Date(vago.data + 'T12:00:00');
              dataRef.setDate(dataRef.getDate() - 1);
              const prevDateStr = dataRef.toISOString().split('T')[0];
              const trabalhouDiaAnteriorp1 = p1.designacoesNoDia[prevDateStr] ? 1 : 0;
              const trabalhouDiaAnteriorp2 = p2.designacoesNoDia[prevDateStr] ? 1 : 0;

              const pesoConsecutivo = 150000; // MAIOR QUE UM TURNO CHEIO PARA EVITAR MESMO!
              const scoreConsecutivo = (trabalhouDiaAnteriorp1 + trabalhouDiaAnteriorp2) * pesoConsecutivo;

              const pontuacaoFinal = scoreMes + scoreGlobal + scoreSlot + scoreDupla + scoreConsecutivo + scoreBonusCasal;

              duplasPossiveis.push({
                dupla: [p1, p2],
                pontuacao: pontuacaoFinal
              });
            }
          }
        }
      }

      if (duplasPossiveis.length === 0) continue;

      duplasPossiveis.sort((a, b) => a.pontuacao - b.pontuacao);
      const melhorOpcao = duplasPossiveis[0];
      const empate = duplasPossiveis.filter(d => Math.abs(d.pontuacao - melhorOpcao.pontuacao) < 1);

      if (empate.length > 1) {
        empate.sort(() => Math.random() - 0.5);
      }

      const melhorDupla = empate[0].dupla;

      if (melhorDupla) {
        vago.designacao = {
          pessoa1: { id: melhorDupla[0].id, nome: melhorDupla[0].nome, telefone: melhorDupla[0].telefone, genero: melhorDupla[0].genero || '', congregacao: melhorDupla[0].congregacao || '' },
          pessoa2: { id: melhorDupla[1].id, nome: melhorDupla[1].nome, telefone: melhorDupla[1].telefone, genero: melhorDupla[1].genero || '', congregacao: melhorDupla[1].congregacao || '' }
        };

        // Atualiza contadores em TEMPO REAL para o próximo slot
        melhorDupla[0].designacoesNoMes++;
        melhorDupla[1].designacoesNoMes++;
        melhorDupla[0].designacoesNoDia[vago.data] = true;
        melhorDupla[1].designacoesNoDia[vago.data] = true;

        // Atualiza o rastreador de semana
        melhorDupla[0].designacoesNaSemana[weekKey] = (melhorDupla[0].designacoesNaSemana[weekKey] || 0) + 1;
        melhorDupla[1].designacoesNaSemana[weekKey] = (melhorDupla[1].designacoesNaSemana[weekKey] || 0) + 1;

        const dKey = getDuplaKey(melhorDupla[0].id, melhorDupla[1].id);
        historicoDuplas[dKey] = (historicoDuplas[dKey] || 0) + 1; // ATUALIZAÇÃO CRÍTICA DO HISTÓRICO DE DUPLAS

        if (!historicoPorSlot[melhorDupla[0].id]) historicoPorSlot[melhorDupla[0].id] = {};
        historicoPorSlot[melhorDupla[0].id][slotKey] = (historicoPorSlot[melhorDupla[0].id][slotKey] || 0) + 1;
        if (!historicoPorSlot[melhorDupla[1].id]) historicoPorSlot[melhorDupla[1].id] = {};
        historicoPorSlot[melhorDupla[1].id][slotKey] = (historicoPorSlot[melhorDupla[1].id][slotKey] || 0) + 1;
      }
    }

  }

  /**
   * @param {string} periodo
   * @param {any[]} vagos
   * @param {string|null} idExistente
   */
  async salvarEscala(periodo, vagos, idExistente = null) {
    console.log('[ScaleService] Salvando a escala final...');

    // Validação
    const vagosValidados = vagos.map(vago => {
      if (vago.designacao && (!vago.designacao.pessoa1 || !vago.designacao.pessoa2)) {
        return { ...vago, designacao: null };
      }
      return vago;
    });

    const escalaFinal = {
      periodo: periodo,
      dataGeracao: new Date(),
      vagos: vagosValidados
    };

    if (idExistente) {
      // Sobrescreve o documento existente (Update)
      await setDoc(doc(this.db, "Escalas", idExistente), escalaFinal);
      console.log('[ScaleService] SUCESSO! Escala ATUALIZADA com ID:', idExistente);
      return idExistente;
    } else {
      // Cria novo (Create)
      const docRef = await addDoc(collection(this.db, "Escalas"), escalaFinal);
      console.log('[ScaleService] SUCESSO! Nova Escala criada com ID:', docRef.id);
      return docRef.id;
    }
  }

  /**
   * Desmarca a opção "indisponivelProximoMes" de todos os participantes.
   * Isso garante que a exclusão vale apenas para UMA geração de escala.
   */
  async resetarIndisponibilidadeProximoMes() {
    try {
      console.log('[ScaleService] Resetando indisponibilidade do próximo mês...');

      // IMPORTANTE: NÃO usar cache aqui! Precisamos dos dados mais recentes do Firebase
      const participantsSnap = await getDocs(collection(this.db, "Pessoas"));

      let contador = 0;
      /** @type {Promise<void>[]} */
      const promises = [];
      /** @type {string[]} */
      const nomesResetados = [];

      participantsSnap.forEach((docSnap) => {
        const participant = docSnap.data();
        if (participant.indisponivelProximoMes === true) {
          // Desmarcar a opção
          promises.push(
            updateDoc(doc(this.db, "Pessoas", docSnap.id), {
              indisponivelProximoMes: false
            })
          );
          contador++;
          nomesResetados.push(participant.nome || docSnap.id);
        }
      });

      await Promise.all(promises);

      if (contador > 0) {
        console.log(`[ScaleService] ✅ ${contador} participante(s) tiveram a indisponibilidade resetada:`);
        console.log(`[ScaleService] 👥 Nomes: ${nomesResetados.join(', ')}`);

        // Limpar cache após reset para garantir que próximas leituras peguem dados atualizados
        cache.invalidate('all_participants_scale');
        cache.invalidate('Pessoas'); // Invalida cache da coleção Pessoas também
        console.log('[ScaleService] 🗑️ Cache de participantes invalidado - próxima leitura será do Firebase.');
      } else {
        console.log('[ScaleService] ℹ️ Nenhum participante tinha indisponibilidade marcada.');
      }
    } catch (error) {
      console.error('[ScaleService] Erro ao resetar indisponibilidade:', error);
      // Não lançar erro para não quebrar o fluxo principal
    }
  }
}