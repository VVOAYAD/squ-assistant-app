const fs = require('fs');
const path = require('path');

// Load document texts at cold start (cached between invocations)
const docsPath = path.join(__dirname, 'docs_data.json');
const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لجامعة السلطان قابوس. مهمتك الإجابة على أسئلة المستخدمين بناءً على اللوائح الرسمية للجامعة.

تعليمات مهمة جداً:
- النص المقدم مستخرج بتقنية OCR وقد يحتوي على أخطاء إملائية أو أحرف غير صحيحة (مثل: 6سفر بدلاً من سفر، zسفر، *إجازة، وما شابه ذلك). تجاهل هذه الأخطاء وافهم المعنى من السياق.
- ابحث في النص بعمق وتأنٍّ قبل أن تقول إن المعلومة غير موجودة. الموضوع قد يُذكر بصياغة مختلفة أو ضمن مادة أخرى.
- أجب دائماً باللغة العربية الفصحى السليمة بغض النظر عن أخطاء النص الأصلي.
- اذكر رقم المادة أو الفصل المرجعي عند الإمكان.
- إذا وجدت معلومات جزئية فاذكرها، ولا تقل "لم أجد" إلا إذا بحثت جيداً ولم تجد أي إشارة للموضوع.
- كن دقيقاً، شاملاً، ومهنياً في ردودك.
- نظّم إجابتك بنقاط وعناوين واضحة عند الحاجة.`;

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: JSON_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { question, docType, history = [] } = body;

  if (!question || !docType) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Missing question or docType' }) };
  }

  const docText = docType === 'tanfithiya' ? docs.tanfithiya : docs.maliya;
  const docName = docType === 'tanfithiya'
    ? 'اللائحة التنفيذية لقانون جامعة السلطان قابوس'
    : 'اللائحة المالية لجامعة السلطان قابوس';

  // Send up to 80k chars of the document to stay within token limits
  const docChunk = docText.length > 80000 ? docText.substring(0, 80000) : docText;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `فيما يلي نص ${docName}:\n\n---\n${docChunk}\n---\n\nالسؤال: ${question}`,
    },
  ];

  // Inject recent conversation history before the document message
  const recentHistory = history.slice(-8);
  if (recentHistory.length > 0) {
    messages.splice(1, 0, ...recentHistory);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        stream: false,
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        statusCode: response.status,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: `OpenAI error: ${errText}` }),
      };
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'لم أتمكن من الإجابة على هذا السؤال.';

    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ answer }),
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({ error: `Server error: ${err.message}` }),
    };
  }
};
