const fs = require("fs");
const path = require("path");
const sessionsPath = path.join(__dirname, "data/sessions.json");

let sessions = {};

function remember(userId, message, result) {
  if (!sessions[userId]) sessions[userId] = [];
  sessions[userId].push({ message, result, time: Date.now() });
  fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2));
}

function recall(userId) {
  return sessions[userId] || [];
}

module.exports = { remember, recall };
