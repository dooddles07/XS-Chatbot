const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../config/env');

const client = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function reply(message) {
  const result = await model.generateContent(message);
  return result.response.text();
}

module.exports = { reply };
