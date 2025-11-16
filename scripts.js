(() => {
  // Config
  const sectionWeights = { I:1.0, II:2.5, III:1.0, IV:2.0, V:2.0, VI:1.0, VII:0.5 };
  const sections = Object.keys(sectionWeights);
  const SELECTORS = {
    radios: 'input[type="radio"]',
    grauCell: '#grauCell',
    scoresSummary: '#scoresSummary',
    sendBtn: '#sendWebhook',
    printBtn: '#printBtn',
    form: '#faiForm',
    apt: '#apto',
    naoApto: '#naoApto'
  };

  // Dom helpers
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const safe = v => (v == null ? '' : String(v));

  // Cálculo
  function calculateFull() {
    let total = 0;
    const details = {};
    let allAnswered = true;

    sections.forEach(sec => {
      const inputs = $$(`input[name^="${sec}_"]`);
      const names = Array.from(new Set(inputs.map(i => i.name)));
      if (!names.length) {
        details[sec] = { ok: false, sectionScore: 0, items: 0 };
        return;
      }

      let sum = 0, answeredCount = 0;
      names.forEach(name => {
        const checked = document.querySelector(`input[name="${name}"]:checked`);
        if (checked) { sum += Number(checked.value) || 0; answeredCount++; }
      });

      if (answeredCount !== names.length) allAnswered = false;
      const avg = names.length ? (sum / names.length) : 0;
      const sectionScore = avg * sectionWeights[sec];
      details[sec] = { ok: answeredCount === names.length, avg, sectionScore, items: names.length };
      total += sectionScore;
    });

    const maxTotal = Object.values(sectionWeights).reduce((a,b) => a + b, 0);
    const percentage = maxTotal ? (total / maxTotal) * 100 : 0;
    const grau = percentage >= 90 ? 'A' : percentage >= 75 ? 'B' : percentage >= 60 ? 'C' : 'D';

    return { total, maxTotal, percentage, grau, details, allAnswered };
  }

  // UI update
  function updateScoresUI() {
    const res = calculateFull();
    const grauEl = $(SELECTORS.grauCell);
    if (grauEl) grauEl.textContent = `${res.total.toFixed(2)} / ${res.maxTotal.toFixed(2)} (${res.percentage.toFixed(1)}%) - Grau ${res.grau}`;
    const summaryEl = $(SELECTORS.scoresSummary);
    if (summaryEl) {
      summaryEl.innerHTML = sections.map(s => {
        const d = res.details[s];
        return `${s}: ${d.sectionScore.toFixed(2)} / ${sectionWeights[s].toFixed(2)}${d.ok ? '' : ' (incompleto)'}`;
      }).join('<br>');
    }
  }

  // Monta payload
  function collectPayload() {
    const meta = {
      turma: safe($('#turma')?.value),
      om: safe($('#om')?.value),
      aluno: safe($('#aluno')?.value),
      instrutor: safe($('#instrutor')?.value),
      ano: safe($('#ano')?.value),
      local: safe($('#local')?.value),
      data: safe($('#data')?.value)
    };

    const responses = {};
    $$(SELECTORS.radios).forEach(r => { if (r.checked) responses[r.name] = r.value; });

    return { meta, responses, summary: calculateFull() };
  }

  // Envia para enqueue (chamada rápida, espera 202)
  async function sendToEnqueue(payload, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 8000; // 8s por padrão
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('/.netlify/functions/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }

      return { status: res.status, ok: res.status === 202, data };
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('timeout');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Eventos e inicialização
  $$(SELECTORS.radios).forEach(r => r.addEventListener('change', updateScoresUI));
  updateScoresUI();

  const sendBtn = $(SELECTORS.sendBtn);
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const payload = collectPayload();
      console.info('📤 Enviando para enqueue (relativo):', payload);
      sendBtn.disabled = true;
      try {
        const result = await sendToEnqueue(payload, { timeoutMs: 8000 });
        console.info('📥 Resposta enqueue:', result);
        if (result.ok) {
          alert('✅ Pedido recebido. Processamento em segundo plano.');
        } else if (result.status && result.status !== 202) {
          console.error('enqueue returned non-202', result);
          alert('⚠️ Não foi possível iniciar o processamento. Veja console para detalhes.');
        }
      } catch (err) {
        if (err.message === 'timeout') {
          console.warn('enqueue call timeout');
          alert('⚠️ Timeout ao contactar o servidor. O pedido pode ter sido recebido; verifique o relatório.');
        } else {
          console.error('Erro ao enviar para enqueue:', err);
          alert('❌ Erro de rede ao enviar. Verifique o console (F12).');
        }
      } finally {
        sendBtn.disabled = false;
      }
    });
  }

  // Print
  const printBtn = $(SELECTORS.printBtn);
  if (printBtn) {
    printBtn.addEventListener('click', () => { updateScoresUI(); window.print(); });
  }

  // Form prevent
  const form = $(SELECTORS.form);
  if (form) form.addEventListener('submit', e => e.preventDefault());

  // Exclusividade APTO / NÃO APTO
  const aptEl = $(SELECTORS.apt), naoAptoEl = $(SELECTORS.naoApto);
  if (aptEl && naoAptoEl) {
    aptEl.addEventListener('change', () => { if (aptEl.checked) naoAptoEl.checked = false; });
    naoAptoEl.addEventListener('change', () => { if (naoAptoEl.checked) aptEl.checked = false; });
  }
})();