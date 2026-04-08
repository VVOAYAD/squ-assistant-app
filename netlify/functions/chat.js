const fs = require('fs');
const path = require('path');

// Load document texts at cold start (cached between invocations)
const docsPath = path.join(__dirname, 'docs_data.json');
const docs = JSON.parse(fs.readFileSync(docsPath, 'utf-8'));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لجامعة السلطان قابوس. تتحدث مع مسؤولين وإداريين في الجامعة. أسلوبك: مهني، واضح، ودود — لست روبوتاً بارداً بل مستشار قانوني ذكي يشرح اللوائح بلغة مفهومة.

**قواعد الإجابة:**
- النص مستخرج بـ OCR وقد يحتوي أخطاء إملائية — تجاهلها وافهم المعنى من السياق.
- ابحث بعمق قبل أن تقول إن المعلومة غير موجودة. الموضوع قد يُذكر بصياغة مختلفة.
- إذا كان السؤال غامضاً، اذكر الافتراض الذي بنيت عليه إجابتك في سطر واحد في البداية.
- إذا وجدت مواد ذات صلة بالموضوع فاذكرها بشكل استباقي ("تجدر الإشارة أيضاً إلى المادة X التي تنص على...").
- نظّم إجابتك بنقاط وعناوين واضحة عند الحاجة.
- أجب دائماً باللغة العربية الفصحى.

**قسم المصدر — إلزامي في نهاية كل إجابة:**
أضف سطراً فاصلاً ثم:
📌 **المصدر:** [رقم المادة أو المواد] – [اسم الباب أو الفصل] – [اسم اللائحة]

**أسئلة مقترحة — إلزامية في نهاية كل إجابة:**
بعد قسم المصدر مباشرةً، أضف هذا السطر بالضبط:
[اقتراحات]: [سؤال مقترح أول؟] | [سؤال مقترح ثانٍ؟]

الأسئلة المقترحة يجب أن تكون متعلقة بما أجبت عنه وتفيد المستخدم في التعمق أكثر. لا تضع قوسين معكوفين في النص الفعلي — استبدلهما بالسؤال الحقيقي.

مثال كامل على نهاية الإجابة:
📌 **المصدر:** المادة (23) والمادة (24) – الباب الرابع: الإجازات – اللائحة التنفيذية
[اقتراحات]: ما هي إجراءات طلب الإجازة الاستثنائية؟ | هل يحق للموظف الجمع بين نوعين من الإجازات؟`;

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

  // Send up to 250k chars of the document (GPT-4o-mini handles this well)
  // This ensures we include vastly more of the regulations than before
  const docChunk = docText.length > 250000 ? docText.substring(0, 250000) : docText;

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  // Inject recent conversation history FIRST (after system prompt)
  // This gives the model context of the conversation
  const recentHistory = history.slice(-8);
  if (recentHistory.length > 0) {
    messages.push(...recentHistory);
  }

  // Add the current question with document context LAST
  // This ensures the model focuses on the latest query with full document access
  messages.push({
    role: 'user',
    content: `فيما يلي نص ${docName}:\n\n---\n${docChunk}\n---\n\nالسؤال: ${question}`,
  });

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
      let errData = {};
      try { errData = JSON.parse(errText); } catch { /* ignore */ }

      const code   = errData?.error?.code || '';
      const status = response.status;

      // Quota exhausted or billing limit reached — return a dignified message
      if (status === 429 || code === 'insufficient_quota' || code === 'billing_hard_limit_reached') {
        return {
          statusCode: 200,
          headers: JSON_HEADERS,
          body: JSON.stringify({
            answer: 'النظام غير متاح مؤقتاً بسبب تجاوز حد الاستخدام. يرجى التواصل مع مسؤول النظام: المؤيد الريامي – داخلي 5102',
          }),
        };
      }

      // Rate limit (too many requests at once)
      if (status === 429) {
        return {
          statusCode: 200,
          headers: JSON_HEADERS,
          body: JSON.stringify({
            answer: 'النظام مشغول حالياً. يرجى المحاولة مرة أخرى بعد لحظات.',
          }),
        };
      }

      // Auth error
      if (status === 401) {
        return {
          statusCode: 200,
          headers: JSON_HEADERS,
          body: JSON.stringify({
            answer: 'خطأ في إعداد النظام. يرجى التواصل مع مسؤول النظام: المؤيد الريامي – داخلي 5102',
          }),
        };
      }

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
