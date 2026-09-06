const Groq = require('groq-sdk');
const { GROQ_API_KEY } = require('../config/env');
const { SYSTEM_PROMPT } = require('./systemPrompt');

const client = new Groq({ apiKey: GROQ_API_KEY });

async function reply(message) {
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ]
  });
  return completion.choices[0].message.content;
}

module.exports = { reply };
