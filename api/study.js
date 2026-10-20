const MODEL = 'gemini-3.8-flash';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Study generation is not configured.' });
  const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 60000) : '';
  const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName.slice(0, 120) : 'Class notes';
  if (text.length < 100) return res.status(400).json({ error: 'There is not enough text to make a study set.' });

  const prompt = `You are Goodkid, a kind, clear study coach for high school students. Make a useful study set using only the notes below. Never invent facts. Teach for understanding, then test active recall. Write at an age-appropriate level without baby talk. Return only valid JSON with this shape: {"title":"short topic title","subject":"short subject","concepts":["key idea"],"lesson":"A plain-language teaching explanation of the main ideas in 3-5 sentences. Explain relationships and why they matter; do not simply copy a list.","questions":[{"prompt":"A clear question","options":["four distinct answer choices"],"correct":0,"explanation":"Explain why the right answer is right, referring to the notes."}]}. Create 5 questions with exactly 4 plausible choices each, one unambiguous correct answer, and a mix of understanding and application. Keep explanations constructive. No unsupported claims. Document: ${fileName}\n\nNOTES:\n${text}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 4000 } }),
    });
    if (!response.ok) return res.status(502).json({ error: 'The study generator is temporarily unavailable.' });
    const payload = await response.json();
    const raw = payload.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
    const parsed = JSON.parse(raw || '{}');
    if (!Array.isArray(parsed.questions) || !parsed.questions.length) return res.status(502).json({ error: 'The study set could not be created.' });
    const questions = parsed.questions.slice(0, 6).filter(q => typeof q.prompt === 'string' && Array.isArray(q.options) && q.options.length === 4 && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4).map(q => ({ prompt: q.prompt.slice(0, 280), options: q.options.map(o => String(o).slice(0, 280)), correct: q.correct, explanation: String(q.explanation || '').slice(0, 800) }));
    if (!questions.length) return res.status(502).json({ error: 'The study set could not be created.' });
    return res.status(200).json({ title: String(parsed.title || fileName.replace(/\.pdf$/i, '')).slice(0, 100), subject: String(parsed.subject || 'Class notes').slice(0, 80), concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 8).map(x => String(x).slice(0, 60)) : [], lesson: String(parsed.lesson || '').slice(0, 1600), questions });
  } catch {
    return res.status(502).json({ error: 'The study set could not be created.' });
  }
};

