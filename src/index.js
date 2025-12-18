require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');

// --- 1. RENDER ÜÇÜN SERVER (Botun sönməməsi üçün) ---
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Mafia Botu 7/24 Aktivdir! 🔪');
});

app.listen(port, () => {
    console.log(`Render serveri ${port} portunda dinləyir`);
});
// -----------------------------------------------------

// --- 2. DISCORD BOT CLIENT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();

// --- 3. KOMANDALARI YÜKLƏMƏK ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`[XƏBƏRDARLIQ] ${filePath} faylında "data" və ya "execute" yoxdur.`);
    }
}

// --- 4. SLASH COMMANDLARI QEYDİYYATDAN KEÇİRMƏK ---
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('Slash commandlar yenilənir...');

        if (process.env.GUILD_ID) {
            console.log(`Komandalar ${process.env.GUILD_ID} serverinə yüklənir (Instant Mode)...`);
            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
        } else {
            console.log('Komandalar Qlobal olaraq yüklənir (Gecikmə ola bilər)...');
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
        }

        console.log('Slash commandlar uğurla yükləndi!');
    } catch (error) {
        console.error('Komandaları yükləyərkən xəta oldu:', error);
    }
})();

// --- 5. EVENTLƏRİ YÜKLƏMƏK ---
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// --- 6. GİRİŞ ---
client.once(Events.ClientReady, c => {
    console.log(`Bot hazırdır! ${c.user.tag} olaraq giriş edildi.`);
});

client.login(process.env.DISCORD_TOKEN);
