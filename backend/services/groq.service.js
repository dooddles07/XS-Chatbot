const Groq = require('groq-sdk');
const { GROQ_API_KEY } = require('../config/env');

const client = new Groq({ apiKey: GROQ_API_KEY });

async function reply(message) {
  const completion = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [
      {
        role: 'system',
        content: 'You are XS, a sharp, concise strategic thinking partner. Keep replies under 3 sentences.'
      },
      { role: 'user', content: message }
    ]
  });
  return completion.choices[0].message.content;
}

module.exports = { reply };
