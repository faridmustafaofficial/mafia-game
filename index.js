require('dotenv').config(); // Lokalda .env faylını oxumaq üçün
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- 1. RENDER ÜÇÜN SERVER HİSSƏSİ ---
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.send('Bot 7/24 Aktivdir!');
});

app.listen(port, () => {
  console.log(`Web server işləyir: http://localhost:${port}`);
});

// --- 2. DISCORD BOT HİSSƏSİ ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`${client.user.tag} olaraq giriş edildi!`);
});

client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === '!salam') {
        message.reply('Aleykum salam, mən Render-ə hazırlaşıram!');
    }
});

// Tokeni sistemdən alır (Həm lokalda .env-dən, həm də Render-dən)
client.login(process.env.DISCORD_TOKEN);