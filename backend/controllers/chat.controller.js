const { getReply } = require('../services/llm.service');

async function handleChat(req, res) {
  const message = req.body && req.body.message;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'invalid_request' });
  }

  try {
    const reply = await getReply(message.trim());
    res.status(200).json({ reply });
  } catch (err) {
    console.error('llm_unavailable:', err.message);
    res.status(502).json({ error: 'llm_unavailable' });
  }
}

module.exports = { handleChat };
