/**
 * LOTE ESPECIAL — partilhado por todas as páginas de posto (1, 2, 3, …)
 *
 * Quando a coluna "LOTE" (cabeçalho exato, em maiúsculas — hoje é a coluna O)
 * da linha do posto tiver um dos códigos abaixo,
 * o ecrã entra em "modo lote especial":
 *   - mostra um alerta (cartão no lugar das zonas);
 *   - os prazos/datas, Ord. Prod. (header), Cliente/País, Modelo/Equipamento, Colaborador e Nº de série
 *     continuam a ser lidos
 *     do separador do posto (a página trata disso);
 *   - a Evolução (%) é calculada pelo prazo: dias úteis decorridos / dias úteis do
 *     prazo — cada dia útil acrescenta um bloco de 100/total %;
 *   - os outros campos mostram "--"; o Lote mostra o código ("001") e o nome do
 *     tipo (ex.: "Live Demo") aparece só no cartão de alerta.
 *
 * Uso na página (dentro de renderSheetData, DEPOIS de desenhar datas/prazo):
 *
 *   if (aplicarLoteEspecial(sheetRow)) return;
 *
 * Requer sheet-utils.js (columnLetterToIndex, getSheetRowValue, getWorkDaysCount) carregado antes.
 */
(function () {
  // A coluna é procurada pelo cabeçalho; a letra só é usada se o cabeçalho não existir.
  // Nota: o PM1 tem também uma coluna "Lote" (minúsculas, AK) — por isso a comparação
  // do cabeçalho é exata, para não a confundir com "LOTE".
  const LOTE_ESPECIAL_HEADER = 'LOTE';
  const LOTE_ESPECIAL_COLUNA = 'O';

  const LOTES_ESPECIAIS = {
    '001': 'Live Demo',
    '002': 'Recondicionamento',
    '003': 'Manutenção',
    '004': 'FAT',
  };

  // Campos que ficam com "--" (o nome do tipo só aparece no cartão de alerta)
  const CAMPOS_VAZIOS = [
    '#statusLabel',  // Estado (por baixo da evolução)
    '.details-section .detail-row:nth-child(3) .d-v', // Enc. Cliente
  ];
  const VAZIO = '--';

  function semAcentos(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function encontrarColunaLote(rowData, header, coluna) {
    const cols = rowData.table && Array.isArray(rowData.table.cols) ? rowData.table.cols : [];
    const idx = cols.findIndex(c => String(c.label || '').trim() === header);
    return idx >= 0 ? idx : columnLetterToIndex(coluna);
  }

  /**
   * Devolve { codigo, nome } se a coluna LOTE da linha tiver um código especial, senão null.
   * Aceita "001", "001 - Live Demo", 1 (número), ou só o nome ("Live Demo").
   */
  function detetarLoteEspecial(rowData, header = LOTE_ESPECIAL_HEADER, coluna = LOTE_ESPECIAL_COLUNA) {
    if (!rowData || !rowData.valuesByColumn) return null;
    const idx = encontrarColunaLote(rowData, header, coluna);
    const raw = rowData.valuesByColumn[idx];
    if (raw == null) return null;

    const texto = String(raw).trim();
    if (!texto) return null;

    // Código numérico no início: "001", "1", "001 - Live Demo", "002-Recond."
    const m = texto.match(/^0*(\d{1,3})(?=\s|[-–·:.]|$)/);
    if (m) {
      const codigo = m[1].padStart(3, '0');
      if (LOTES_ESPECIAIS[codigo]) return { codigo, nome: LOTES_ESPECIAIS[codigo] };
    }

    // Só o nome escrito
    const alvo = semAcentos(texto);
    for (const [codigo, nome] of Object.entries(LOTES_ESPECIAIS)) {
      if (alvo === semAcentos(nome)) return { codigo, nome };
    }
    return null;
  }

  function injetarEstilos() {
    if (document.getElementById('lote-especial-css')) return;
    const style = document.createElement('style');
    style.id = 'lote-especial-css';
    style.textContent = `
      .id-lote .le-lote-desc {
        margin-top: clamp(4px, 0.8vh, 8px);
        font-size: .6em; font-weight: 700; letter-spacing: 3px;
        text-transform: uppercase; color: #ffaa00;
      }

      .lote-especial-alerta {
        grid-column: 1 / -1;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: clamp(6px, 1vh, 12px); text-align: center;
        padding: clamp(14px, 2.4vh, 28px);
        border: 2px solid #ffaa00; border-radius: 12px;
        background: rgba(255,170,0,0.12);
      }
      .lote-especial-alerta .le-icone { font-size: clamp(28px, 4.5vh, 56px); line-height: 1; }
      .lote-especial-alerta .le-nome {
        font-family: 'Bebas Neue', sans-serif; color: #ffaa00;
        font-size: clamp(40px, 7vh, 96px); line-height: .9; letter-spacing: 3px;
        overflow-wrap: anywhere;
      }
      .lote-especial-alerta .le-sub {
        font-size: clamp(13px, 1.8vh, 20px); font-weight: 700;
        letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.8);
      }
    `;
    document.head.appendChild(style);
  }

  function preencherCampos({ codigo, nome }) {
    CAMPOS_VAZIOS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { el.textContent = VAZIO; });
    });

    // Lote: só o código por baixo, sempre com 3 dígitos ("002", nunca "2")
    const lote = document.querySelector('.id-lote');
    if (lote) {
      lote.innerHTML = 'Lote<div class="le-lote-desc"></div>';
      lote.querySelector('.le-lote-desc').textContent = codigo;
    }

    const zg = document.getElementById('zonasGrid');
    if (zg) {
      zg.innerHTML = `
        <div class="lote-especial-alerta" role="alert">
          <div class="le-icone">⚠</div>
          <div class="le-nome"></div>
          <div class="le-sub">Lote especial</div>
        </div>`;
      zg.querySelector('.le-nome').textContent = nome;
    }
  }

  // Mesmas colunas de datas que as páginas usam para o prazo
  const DATA_INICIO = ['DATA INICIO PRODUÇÃO', 'E'];
  const DATA_PREVISTA = ['DATA PRETENDIDA', 'G'];

  // Mesmas cores que ec() nas páginas
  const corEvolucao = v => v >= 75 ? '#00ff87' : v >= 40 ? '#00d4ff' : '#ffaa00';

  /**
   * Evolução pelo prazo: dias úteis decorridos (incluindo hoje) / dias úteis do prazo.
   * Ex.: prazo de 8 dias úteis → cada dia soma 12,5% (1/8, 2/8, … 8/8 = 100%).
   * Usa a mesma contagem do bloco "Prazo", por isso bate certo com "6 / 8 dias".
   */
  function calcularEvolucaoPorPrazo(rowData, hoje = new Date()) {
    const inicio = getSheetRowValue(rowData, ...DATA_INICIO);
    const previsto = getSheetRowValue(rowData, ...DATA_PREVISTA);
    if (inicio == null || previsto == null) return null;

    const dia = new Date(hoje);
    dia.setHours(0, 0, 0, 0);
    const total = getWorkDaysCount(inicio, previsto, true);
    const decorridos = getWorkDaysCount(inicio, dia, true);
    if (!total || decorridos == null) return null;

    return Math.round(Math.min(1, Math.max(0, decorridos / total)) * 100);
  }

  function mostrarEvolucao(rowData) {
    const ev = document.getElementById('evNum');
    if (!ev) return;
    const pct = calcularEvolucaoPorPrazo(rowData);
    if (pct == null) {
      ev.textContent = '--';
      ev.style.color = 'rgba(255,255,255,0.15)';
      ev.style.textShadow = 'none';
      return;
    }
    ev.textContent = `${pct}%`;
    ev.style.color = corEvolucao(pct);
    ev.style.textShadow = `0 0 60px ${corEvolucao(pct)}40`;
  }

  // A folha só redesenha a página quando os dados mudam; num lote especial a
  // evolução avança com o calendário, por isso revemos a cada minuto (e o prazo também).
  let ultimaLinha = null;
  setInterval(() => {
    if (!ultimaLinha || !document.body.classList.contains('lote-especial')) return;
    mostrarEvolucao(ultimaLinha);
    if (typeof updateDeadline === 'function') {
      updateDeadline(getSheetRowValue(ultimaLinha, ...DATA_INICIO), getSheetRowValue(ultimaLinha, ...DATA_PREVISTA));
    }
  }, 60 * 1000);

  /**
   * Verifica a linha e aplica/remove o modo lote especial.
   * Devolve o tipo ({ codigo, nome }) se estiver ativo — a página deve então
   * parar de desenhar os restantes campos — ou null em caso normal.
   */
  function aplicarLoteEspecial(rowData, header, coluna) {
    const tipo = detetarLoteEspecial(rowData, header, coluna);
    injetarEstilos();
    document.body.classList.toggle('lote-especial', !!tipo);
    ultimaLinha = tipo ? rowData : null;
    if (tipo) {
      document.body.dataset.loteEspecial = tipo.codigo;
      preencherCampos(tipo);
      mostrarEvolucao(rowData);
    } else {
      delete document.body.dataset.loteEspecial;
    }
    return tipo;
  }

  window.LOTES_ESPECIAIS = LOTES_ESPECIAIS;
  window.calcularEvolucaoPorPrazo = calcularEvolucaoPorPrazo;
  window.detetarLoteEspecial = detetarLoteEspecial;
  window.aplicarLoteEspecial = aplicarLoteEspecial;
})();
