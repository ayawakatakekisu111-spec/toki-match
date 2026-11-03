
import { getStore } from '@netlify/blobs';


const model = 'gemini-3.5-flash-lite';

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export default async (request) => {
  if (request.method !== 'POST') {
    return reply({ error: 'POSTのみ対応' }, 405);
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return reply({ error: 'Gemini APIキーが未設定です' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return reply({ error: '入力形式が不正です' }, 400);
  }

  const { character, history, message } = body || {};

  if (
    typeof message !== 'string' ||
    !message.trim() ||
    message.length > 400 ||
    !character ||
    typeof character.name !== 'string' ||
    character.name.length > 60
  ) {
    return reply({ error: '入力を確認してください' }, 400);
  }

  const cookie = request.headers.get('cookie') || '';
  let id = (cookie.match(
    /(?:^|;\s*)toki_visitor=([a-f0-9-]{36})/
  ) || [])[1];

  if (!id) id = crypto.randomUUID();

  const day = new Date().toISOString().slice(0, 10);
  const store = getStore('toki-chat-limits');
  const key = `${day}/${id}`;

  let count = 0;
  try {
    const item = await store.get(key, { type: 'json' });
    count = Number(item?.count || 0);
  } catch {
    return reply({ error: '利用回数の確認に失敗しました' }, 503);
  }

  if (count >= 20) {
    return reply({
      error: '今日のAIチャットは20通までです。明日また話そう！'
    }, 429);
  }

  const prompt = `
あなたは歴史人物「${character.name}」を演じる
TOKI MATCHの創作チャット相手です。

日本語で自然に、親しみやすく会話してください。
史実と創作を混同せず、実在人物の発言を
史実として捏造しないでください。

返信は基本60〜150字、最大220字程度。
相手の話を聞き、時々質問してください。
恋愛的な親しさは自然に段階的に深めてください。

時代背景: ${String(character.era || '').slice(0, 60)}
人物像: ${String(character.tag || '').slice(0, 120)}
史実: ${String(character.fact || '').slice(0, 650)}
功績: ${String(character.achievement || '').slice(0, 300)}
特徴: ${String(character.warning || '').slice(0, 200)}
`;

  
const contents = [
  {
    role: 'user',
    parts: [
      { text: message }
    ]
  }
];

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: prompt }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 320,
            temperature: 0.85
          }
        })
      }
    );
  } catch {
    return reply({ error: 'AIサーバーに接続できませんでした' }, 502);
  }

  


if (!response.ok) {
  const details = await response.json().catch(() => ({}));
  const code = details.error?.status || 'UNKNOWN';
  const message = details.error?.message || '詳細不明';

  console.error('Gemini API error:', {
    status: response.status,
    code,
    message
  });

  return reply({
    error: `Gemini HTTP ${response.status}: ${code} — ${message.slice(0, 300)}`
  }, 502);
}

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '').join('').trim();

  if (!text) {
    return reply({ error: 'AIから返信がありませんでした' }, 502);
  }

  try {
    await store.setJSON(key, { count: count + 1 });
  } catch {
    return reply({ error: '利用回数の保存に失敗しました' }, 503);
  }

  return new Response(
    JSON.stringify({
      reply: text,
      remaining: Math.max(0, 19 - count)
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie':
          `toki_visitor=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
      }
    }
  );
};
