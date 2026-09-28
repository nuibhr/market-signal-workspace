// Bigdata Research Agent API: https://docs.bigdata.com/getting-started/quickstart_guide_research_agent
function publicSource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const candidateUrl = raw.url ?? raw.action?.url;
  const url = typeof candidateUrl === 'string' && /^https?:\/\//i.test(candidateUrl) ? candidateUrl : null;
  const title = String(raw.hd ?? raw.headline ?? raw.title ?? raw.src_name ?? raw.action?.name ?? 'แหล่งข้อมูล').slice(0, 180);
  const publishedAt = raw.ts ?? raw.timestamp;
  return { title, url, publishedAt: typeof publishedAt === 'string' ? publishedAt : null };
}

export async function researchWithBigdata(question, selectedSymbol, conversation = null) {
  const key = process.env.BIGDATA_API_KEY?.trim();
  if (!key) throw new Error('BIGDATA_NOT_CONFIGURED');
  const prompt = `คุณคือน้องนักออม AI ผู้ช่วยวิจัยหุ้นของ Nugaom AI Pick ตอบภาษาไทยให้กระชับเป็นข้อความธรรมดา ใช้เฉพาะข้อมูลหุ้น บริษัท ETF ข่าว งบ และเอกสารที่ค้นจาก Bigdata.com ในคำถามนี้ ทุกคำตอบต้องมีแหล่งข้อมูลอย่างน้อยหนึ่งแห่ง อ้างหลักฐานและวันที่ข้อมูลอย่างชัดเจน แยกข้อเท็จจริงกับการตีความ ถ้าหาข้อมูลรองรับไม่ได้ให้บอกว่าไม่พบข้อมูล ห้ามแต่งราคา ข่าว ตัวเลข เป้าหมายราคา หรือแนะนำส่งคำสั่งซื้อขาย คำถามอาจครอบคลุมหุ้นหลายตัวทั่วโลก ไม่จำกัดเฉพาะหุ้นที่เปิดอยู่บนหน้าจอ\nสินทรัพย์ที่เปิดดูอยู่ (ใช้เป็นบริบทเฉพาะเมื่อคำถามพูดถึง “ตัวนี้”): ${selectedSymbol || 'ไม่ระบุ'}\nคำถาม: ${question}`;
  const response = await fetch('https://agents.bigdata.com/v1/research-agent', {
    method: 'POST',
    headers: { 'X-API-KEY': key, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message: prompt, research_effort: 'lite', persistence_mode: 'enabled',
      ...(conversation?.chatId ? { chat_id: conversation.chatId } : {}),
      ...(conversation?.checkpointId ? { from_checkpoint_id: conversation.checkpointId } : {}) }),
    signal: AbortSignal.timeout(120_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'BIGDATA_AUTH_FAILED' : response.status === 429 ? 'BIGDATA_RATE_LIMIT' : 'BIGDATA_UNAVAILABLE');
  if (!response.body) throw new Error('BIGDATA_EMPTY_RESPONSE');

  let answer = '';
  let chatId = conversation?.chatId ?? null;
  let checkpointId = null;
  let buffer = '';
  let failed = false;
  const sources = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const processLine = line => {
    if (!line.startsWith('data: ')) return;
    let event;
    try { event = JSON.parse(line.slice(6)); } catch { return; }
    const delta = event?.message ?? {};
    if (typeof event?.chat_id === 'string') chatId = event.chat_id;
    if (delta.type === 'ANSWER' && typeof delta.content === 'string') answer += delta.content;
    if (delta.type === 'ERROR') failed = true;
    if (delta.type === 'COMPLETE' && typeof delta.checkpoint_id === 'string') checkpointId = delta.checkpoint_id;
    if (delta.type === 'GROUNDING' && Array.isArray(delta.references)) {
      for (const reference of delta.references) {
        const source = publicSource(reference?.source);
        if (source && !sources.some(item => item.url === source.url && item.title === source.title)) sources.push(source);
      }
    }
    if (answer.length > 12_000) throw new Error('BIGDATA_RESPONSE_TOO_LONG');
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 250_000) throw new Error('BIGDATA_RESPONSE_TOO_LONG');
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      lines.forEach(processLine);
    }
    if (buffer) processLine(buffer);
  } finally { reader.releaseLock(); }
  if (failed || !answer.trim()) throw new Error('BIGDATA_EMPTY_RESPONSE');
  if (sources.length === 0) throw new Error('BIGDATA_UNGROUNDED');
  return { answer: answer.trim().slice(0, 8_000), sources: sources.slice(0, 8), provider: 'Bigdata.com Research Agent', generatedAt: new Date().toISOString(), chatId, checkpointId };
}
