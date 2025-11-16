// netlify/functions/enqueue.background.js
// Background worker: faz o POST final ao ActivePieces com timeout e retries.
// Depende de ACTIVEPIECES_SECRET definido nas Environment Variables do Netlify.

const ACTIVEPIECES_URL = 'https://cloud.activepieces.com/api/v1/webhooks/PYolUaDZ0aNZ0KKEF1WFg/sync';
const ACTIVEPIECES_SECRET = process.env.ACTIVEPIECES_SECRET || '';

function timeoutFetch(url, options = {}, ms = 20000) {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, Object.assign({ signal }, options))
    .finally(() => clearTimeout(timer));
}

exports.handler = async (event, context) => {
  console.log('background:start', { ts: new Date().toISOString(), bodyLength: event.body ? event.body.length : 0 });

  if (!event.body) {
    console.warn('background: payload ausente');
    return { statusCode: 400, body: JSON.stringify({ error: 'Payload ausente' }) };
  }

  // (Opcional) revalide campos essenciais no payload aqui
  // const payload = JSON.parse(event.body); // descomente se for necessário parse

  const maxRetries = 2;
  let attempt = 0;
  let lastError = null;

  while (attempt <= maxRetries) {
    attempt++;
    try {
      const resp = await timeoutFetch(ACTIVEPIECES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': ACTIVEPIECES_SECRET
        },
        body: event.body
      }, 20000); // 20s timeout por tentativa

      const text = await resp.text();
      let data;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }

      console.log('background: proxied response', { attempt, status: resp.status, ok: resp.ok });

      if (resp.ok) {
        console.log('background: success', { attempt, data });
        // opcional: persistir resultado em DB / enviar notificação
        return { statusCode: 200, body: JSON.stringify({ proxied: true, status: resp.status, data }) };
      }

      // registre e tente novamente se aplicável
      lastError = { status: resp.status, data };
      console.warn('background: non-ok response', { attempt, lastError });

    } catch (err) {
      lastError = { name: err.name, message: err.message };
      console.error('background: fetch error', { attempt, lastError });

      // se AbortError por timeout, tentaremos novamente até maxRetries
    }

    // backoff simples entre tentativas
    if (attempt <= maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 1s, 2s, ...
    }
  }

  console.error('background: job failed after retries', { lastError });
  // opcional: persistir falha em DB, enviar alerta, etc.
  return {
    statusCode: 502,
    body: JSON.stringify({ error: 'Falha ao enviar para ActivePieces', detail: lastError })
  };
};