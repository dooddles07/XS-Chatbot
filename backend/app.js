require('./config/env');
const express = require('express');
const rateLimit = require('./middleware/rateLimit.middleware');
const { handleChat } = require('./controllers/chat.controller');
const errorHandler = require('./middleware/error.middleware');

const app = express();
app.use(express.json());
app.post('*', rateLimit, handleChat);
app.use(errorHandler);

module.exports = app;
