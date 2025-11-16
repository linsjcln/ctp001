// netlify/functions/enqueue.js
// Responde rápido com 202 Accepted. Não faz o POST ao ActivePieces.
// Validações mínimas e resposta imediata para acionar o background worker.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método não permitido' })
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Payload ausente' })
    };
  }

  // Limite de payload razoável (ajuste conforme necessidade)
  if (event.body.length > 500_000) {
    return {
      statusCode: 413,
      body: JSON.stringify({ error: 'Payload muito grande' })
    };
  }

  // Responder 202 faz com que Netlify execute o arquivo .background.js do mesmo nome.
  return {
    statusCode: 202,
    body: JSON.stringify({ accepted: true, message: 'Pedido aceito. Processamento em segundo plano.' })
  };
};