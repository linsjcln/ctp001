(() => {
  const sectionWeights = { I:1.0, II:2.5, III:1.0, IV:2.0, V:2.0, VI:1.0, VII:0.5 };
  const sections = Object.keys(sectionWeights);
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  function calculateFull() {
    let total = 0;
    const details = {};
    let allAnswered = true;

    sections.forEach(sec => {
      const inputs = $$(`input[name^="${sec}_"]`);
      const names = Array.from(new Set(inputs.map(i => i.name)));
      if (!names.length) { details[sec] = { ok:false, sectionScore:0, items:0 }; return; }

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

  function updateScoresUI() {
    const res = calculateFull();
    const grauCell = $('#grauCell');
    const summaryEl = '#scoresSummary';
    if (grauCell) grauCell.textContent = `${res.total.toFixed(2)} / ${res.maxTotal.toFixed(2)} (${res.percentage.toFixed(1)}%) - Grau ${res.grau}`;
    const el = $(summaryEl);
    if (el) {
      el.innerHTML = sections.map(s => {
        const d = res.details[s];
        return `${s}: ${d.sectionScore.toFixed(2)} / ${sectionWeights[s].toFixed(2)}${d.ok ? '' : ' (incompleto)'}`;
      }).join('<br>');
    }
  }

  function collectPayload() {
    const safe = v => (v == null ? '' : String(v));
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
    $$('input[type="radio"]').forEach(r => { if (r.checked) responses[r.name] = r.value; });
    return { meta, responses, summary: calculateFull() };
  }

  async function sendToFunction(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch('/.netlify/functions/enviar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { ok: res.ok, status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  // Listeners
  $$('input[type="radio"]').forEach(r => r.addEventListener('change', updateScoresUI));
  updateScoresUI();

  const sendBtn = $('#sendWebhook');
  if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
      const payload = collectPayload();
      try {
        console.info('📤 Enviando para função local', payload);
        const result = await sendToFunction(payload);
        console.info('📥 Resposta:', result);
        if (result.ok) {
          alert('✅ Ficha salva com sucesso!');
        } else {
          const msg = result.data?.error || result.data || 'Erro desconhecido';
          alert(`⚠️ Não consegui salvar. Status: ${result.status}\nResposta: ${msg}`);
        }
      } catch (err) {
        const msg = err.name === 'AbortError' ? 'Timeout ao enviar' : 'Falha de rede/processamento';
        console.error('❌ Erro ao enviar:', err);
        alert(`❌ Não foi possível processar: ${msg}. Verifique o console (F12).`);
      }
    });
  }

  const printBtn = $('#printBtn');
  if (printBtn) printBtn.addEventListener('click', () => { updateScoresUI(); window.print(); });

  const form = $('#faiForm');
  if (form) form.addEventListener('submit', e => e.preventDefault());

  const aptEl = $('#apto'), naoAptoEl = $('#naoApto');
  if (aptEl && naoAptoEl) {
    aptEl.addEventListener('change', () => { if (aptEl.checked) naoAptoEl.checked = false; });
    naoAptoEl.addEventListener('change', () => { if (naoAptoEl.checked) aptEl.checked = false; });
  }
})();
