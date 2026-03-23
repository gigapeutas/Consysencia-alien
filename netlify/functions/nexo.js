/**
 * CONSYSENCIA — Proxy Function
 * Roda no servidor Netlify. A chave GROQ_API_KEY fica
 * nas variáveis de ambiente do Netlify, nunca no frontend.
 *
 * Endpoint: /.netlify/functions/nexo
 * Método:   POST
 * Body:     { messages: [...], system: "..." }
 */

exports.handler = async (event) => {
  /* Só aceita POST */
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  /* CORS — permite o seu domínio */
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  /* Preflight */
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'GROQ_API_KEY não configurada nas variáveis de ambiente do Netlify.' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const { messages, system } = body;
  if (!messages || !Array.isArray(messages)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages obrigatório' }) };
  }

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 80,
        stream: false,           /* sem streaming nas functions — retorna tudo de uma vez */
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages,
        ],
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      return { statusCode: groqRes.status, headers, body: JSON.stringify({ error: err }) };
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content || '';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
