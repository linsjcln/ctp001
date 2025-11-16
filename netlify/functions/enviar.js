const ACTIVEPIECES_URL = 'https://cloud.activepieces.com/api/v1/webhooks/PYolUaDZ0aNZ0KKEF1WFg/sync';
const ACTIVEPIECES_SECRET = process.env.ACTIVEPIECES_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  try {
    // Timeout com AbortController
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 60000);

    // Opcional: validação leve (ex.: tamanho máximo)
    if (!event.body || event.body.length > 200_000) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Payload inválido ou muito grande' }) };
    }

    const resp = await fetch(ACTIVEPIECES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': ACTIVEPIECES_SECRET
      },
      body: event.body,
      signal: controller.signal
    }).catch(err => {
      // Captura abort/timeout antes de ler body
      throw err;
    });

    clearTimeout(t);

    const text = await resp.text();
    let data;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    return {
      statusCode: resp.status,
      body: JSON.stringify({
        ok: resp.ok,
        status: resp.status,
        data
      })
    };
  } catch (error) {
    const isAbort = error.name === 'AbortError';
    console.error('Erro enviar.js:', error);
    return {
      statusCode: 504,
      body: JSON.stringify({
        error: isAbort ? 'Timeout ao contatar o serviço' : `Falha ao processar: ${error.message}`
      })
    };
  }
};
