    (function(){
      const sectionWeights = { I:1.0, II:2.5, III:1.0, IV:2.0, V:2.0, VI:1.0, VII:0.5 };

      function calculateFull(){
        const sections = ['I','II','III','IV','V','VI','VII'];
        let total = 0;
        let details = {};
        let allAnswered = true;

        sections.forEach(sec=>{
          const inputs = Array.from(document.querySelectorAll(`input[name^="${sec}_"]`));
          const names = Array.from(new Set(inputs.map(i=>i.name)));
          if (names.length === 0) { details[sec] = {ok:false, sectionScore:0, items:0}; return; }
          let sum = 0;
          let answeredCount = 0;
          names.forEach(name=>{
            const checked = document.querySelector(`input[name="${name}"]:checked`);
            if(checked){ sum += parseFloat(checked.value); answeredCount++; }
          }); 
          if(answeredCount !== names.length) allAnswered = false;
          const avg = answeredCount? (sum / names.length) : 0;
          const sectionScore = avg * sectionWeights[sec];
          details[sec] = {ok: answeredCount===names.length, avg, sectionScore, items: names.length};
          total += sectionScore;
        });

        const maxTotal = Object.values(sectionWeights).reduce((a,b)=>a+b,0);
        const percentage = (total / maxTotal) * 100;
        let grau = '';
        if (percentage >= 90) grau = 'A';
        else if (percentage >= 75) grau = 'B';
        else if (percentage >= 60) grau = 'C';
        else grau = 'D';

        return {total, maxTotal, percentage, grau, details, allAnswered};
      }

      // Atualiza a UI com o cálculo — usada por listeners automáticos
      function updateScoresUI(){
        const res = calculateFull();
        document.getElementById('grauCell').textContent = `${res.total.toFixed(2)} / ${res.maxTotal.toFixed(2)} (${res.percentage.toFixed(1)}%) - Grau ${res.grau}`;
        const summary = [];
        for(const s in res.details){
          const d = res.details[s];
          summary.push(`${s}: ${d.sectionScore.toFixed(2)} / ${sectionWeights[s].toFixed(2)}${d.ok? '':' (incompleto)'}`);
        }
        document.getElementById('scoresSummary').innerHTML = summary.join('<br>');
      }

      // Calcular automaticamente quando qualquer rádio mudar
      document.querySelectorAll('input[type="radio"]').forEach(r=> r.addEventListener('change', updateScoresUI));

      // Calcular ao carregar o script
      updateScoresUI();

      document.getElementById('sendWebhook').addEventListener('click', ()=>{
        const res = calculateFull();
        const data = {
          meta: {
            turma: document.getElementById('turma').value,
            om: document.getElementById('om').value,
            aluno: document.getElementById('aluno').value,
            instrutor: document.getElementById('instrutor').value,
            ano: document.getElementById('ano').value,
            local: document.getElementById('local').value,
            data: document.getElementById('data').value
          },
          responses: {},
          summary: res
        };
        document.querySelectorAll('input[type="radio"]').forEach(r=>{
          if(r.checked) data.responses[r.name] = r.value;
        });
        
        // Enviar para webhook
        const webhookURL = 'https://cloud.activepieces.com/api/v1/webhooks/PYolUaDZ0aNZ0KKEF1WFg/sync';
        fetch(webhookURL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': 'Agencia435'
          },
          body: JSON.stringify(data)
        })
        .then(response => {
          if(response.ok) {
            alert('Ficha salva com sucesso!');
          } else {
            alert('Não consegui salvar. Parece que há uma problema na comunicação com o servidor. Exporte para PDF e tente mais tarde. Erro nº: ' + response.status);
          }
        })
        .catch(error => {
          alert('Não foi possível processar seu pedido de gravação. Salve os dados em PDF. Erro: ' + error.message);
        });
      });

      var printBtn = document.getElementById('printBtn');
      if(printBtn){
        printBtn.addEventListener('click', ()=>{
          // garante cálculo atualizado antes de imprimir
          updateScoresUI();
          window.print();
        });
      }

      // Exclusividade APTO / NÃO APTO
      document.getElementById('apto').addEventListener('change', (e)=>{ if(e.target.checked) document.getElementById('naoApto').checked = false; });
      document.getElementById('naoApto').addEventListener('change', (e)=>{ if(e.target.checked) document.getElementById('apto').checked = false; });

      // Evita submit real
      document.getElementById('faiForm').addEventListener('submit', function(e){ e.preventDefault(); });

    })();