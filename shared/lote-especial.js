/**
 * LOTE ESPECIAL — partilhado por todas as páginas de posto (1, 2, 3, …)
 *
 * Quando a coluna D (LOTE) da linha do posto tiver um dos códigos abaixo,
 * o ecrã entra em "modo lote especial":
 *   - mostra um alerta (moldura âmbar a pulsar + cartão no lugar das zonas);
 *   - só os prazos/datas continuam a ser lidos da folha (a página trata disso);
 *   - todos os outros campos mostram o nome do tipo (ex.: "Live Demo").
 *
 * Uso na página (dentro de renderSheetData, DEPOIS de desenhar datas/prazo):
 *
 *   if (aplicarLoteEspecial(sheetRow)) return;
 *
 * Requer sheet-utils.js (columnLetterToIndex) carregado antes.
 */
(function () {
  const LOTE_ESPECIAL_COLUNA = 'D';

  const LOTES_ESPECIAIS = {
    '001': 'Live Demo',
    '002': 'Recondicionamento',
    '003': 'Manutenção',
  };

  // Campos que passam a mostrar o nome do tipo (selectores comuns às páginas de posto)
  const CAMPOS_TEXTO = [
    '.id-cliente',
    '.id-modelo',
    '.id-pais-info',
    '.h-op',
    '.f-op',
    '.f-nserie',
    '#statusLabel',
    '.details-section .detail-row:nth-child(3) .d-v', // Enc. Cliente
  ];

  function semAcentos(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /**
   * Devolve { codigo, nome } se a coluna D da linha tiver um código especial, senão null.
   * Aceita "001", "001 - Live Demo", "1" (número), ou só o nome ("Live Demo").
   */
  function detetarLoteEspecial(rowData, coluna = LOTE_ESPECIAL_COLUNA) {
    if (!rowData || !rowData.valuesByColumn) return null;
    const idx = columnLetterToIndex(coluna);
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
      body.lote-especial::after {
        content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 50;
        border: 4px solid #ffaa00; box-shadow: inset 0 0 60px rgba(255,170,0,0.35);
        animation: loteEspecialPulse 1.6s ease-in-out infinite;
      }
      @keyframes loteEspecialPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }

      body.lote-especial #evNum {
        font-size: clamp(44px, 8vh, 110px) !important;
        letter-spacing: 2px !important;
        text-align: center; line-height: 1 !important;
        color: #ffaa00 !important; text-shadow: 0 0 40px rgba(255,170,0,0.35) !important;
        overflow-wrap: anywhere;
      }
      body.lote-especial .id-flag { display: none; }

      .lote-especial-alerta {
        grid-column: 1 / -1;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        gap: clamp(6px, 1vh, 12px); text-align: center;
        padding: clamp(14px, 2.4vh, 28px);
        border: 2px solid #ffaa00; border-radius: 12px;
        background: rgba(255,170,0,0.12);
        animation: loteEspecialPulse 1.6s ease-in-out infinite;
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

  function preencherCampos(nome) {
    CAMPOS_TEXTO.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { el.textContent = nome; });
    });

    const lote = document.querySelector('.id-lote');
    if (lote) {
      lote.innerHTML = 'Lote &nbsp;·&nbsp; ';
      lote.append(nome);
    }

    const ev = document.getElementById('evNum');
    if (ev) ev.textContent = nome;

    const zg = document.getElementById('zonasGrid');
    if (zg) {
      zg.innerHTML = `
        <div class="lote-especial-alerta" role="alert">
          <div class="le-icone">⚠</div>
          <div class="le-nome"></div>
          <div class="le-sub">Lote especial · só datas e prazo em leitura</div>
        </div>`;
      zg.querySelector('.le-nome').textContent = nome;
    }
  }

  /**
   * Verifica a linha e aplica/remove o modo lote especial.
   * Devolve o tipo ({ codigo, nome }) se estiver ativo — a página deve então
   * parar de desenhar os restantes campos — ou null em caso normal.
   */
  function aplicarLoteEspecial(rowData, coluna) {
    const tipo = detetarLoteEspecial(rowData, coluna);
    injetarEstilos();
    document.body.classList.toggle('lote-especial', !!tipo);
    if (tipo) {
      document.body.dataset.loteEspecial = tipo.codigo;
      preencherCampos(tipo.nome);
    } else {
      delete document.body.dataset.loteEspecial;
    }
    return tipo;
  }

  window.LOTES_ESPECIAIS = LOTES_ESPECIAIS;
  window.detetarLoteEspecial = detetarLoteEspecial;
  window.aplicarLoteEspecial = aplicarLoteEspecial;
})();
