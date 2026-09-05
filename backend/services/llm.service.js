const groqService = require('./groq.service');
const geminiService = require('./gemini.service');

async function getReply(message) {
  try {
    return await groqService.reply(message);
  } catch (err) {
    console.warn('groq failed, falling back to gemini:', err.message);
    return await geminiService.reply(message);
  }
}

module.exports = { getReply };
