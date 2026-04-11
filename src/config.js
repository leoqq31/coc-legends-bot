require('dotenv').config();

module.exports = {
  botToken: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  cocApiKey: process.env.COC_API_KEY,
  pollIntervalMinutes: 2,
  legendLeagueId: 29000022,
  legendTrophyThreshold: 5000,
};
