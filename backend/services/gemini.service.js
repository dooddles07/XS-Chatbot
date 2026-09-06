const { GoogleGenAI } = require('@google/genai');
const { GEMINI_API_KEY } = require('../config/env');
const { SYSTEM_PROMPT } = require('./systemPrompt');

const client = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function reply(message) {
  const interaction = await client.interactions.create({
    model: 'gemini-3.8-flash',
    input: message,
    system_instruction: SYSTEM_PROMPT
  });
  return interaction.output_text;
}

module.exports = { reply };
