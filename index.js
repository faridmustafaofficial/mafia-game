require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');

// --- RENDER ÜÇÜN SERVER (Bot sönməsin) ---
const app = express();
app.get('/', (req, res) => res.send('Mafia Botu Hazırdır!'));
app.listen(3000, () => console.log('Server 3000 portunda işləyir.'));

// --- BOT AYARLARI ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages // DM göndərmək üçün vacibdir
    ],
    partials: [Partials.Channel] // DM kanallarını görmək üçün
});

// --- OYUN DƏYİŞƏNLƏRİ ---
let lobby = []; // Oyuna qoşulan oyunçuların siyahısı
let gameActive = false; // Oyunun başlayıb-başlamadığını yoxlayır
let playerRoles = {}; // Kimin hansı rolda olduğunu yadda saxlayır

// --- KÖMƏKÇİ FUNKSİYA: Siyahını qarışdırmaq üçün ---
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

client.once('ready', () => {
    console.log(`${client.user.tag} oyuna hazırdır!`);
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Komandaları ayırmaq (Məsələn: !join)
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    // 1. OYUNA QOŞULMAQ
    if (command === '!join') {
        if (gameActive) return message.reply('Oyun artıq başlayıb, qoşula bilməzsən!');
        if (lobby.includes(message.author.id)) return message.reply('Sən artıq siyahıdasan!');
        
        lobby.push(message.author.id);
        message.channel.send(`<@${message.author.id}> oyuna qoşuldu! (Cəmi: ${lobby.length} nəfər)`);
    }

    // 2. OYUNÇU SİYAHISI
    if (command === '!users') {
        if (lobby.length === 0) return message.reply('Hələ heç kim qoşulmayıb.');
        // ID-ləri ada çevirib göstəririk
        const playerNames = lobby.map(id => `<@${id}>`).join(', ');
        message.channel.send(`**Oyunçular:** ${playerNames}`);
    }

    // 3. OYUNU BAŞLATMAQ (ROLLARI PAYLAMAQ)
    if (command === '!start') {
        if (gameActive) return message.reply('Oyun artıq davam edir!');
        if (lobby.length < 2) return message.reply('Oyunu başlamaq üçün ən azı 2 nəfər lazımdır!'); // Test üçün 2 qoydum

        gameActive = true;
        message.channel.send('🎲 **Roll paylanır... Zəhmət olmasa DM qutunuzu yoxlayın!**');

        // Rolları hazırlayaq (Oyunçu sayına görə dinamik)
        let roles = ['Mafiya']; // Həmişə 1 Mafiya olsun
        if (lobby.length >= 4) roles.push('Həkim');
        if (lobby.length >= 5) roles.push('Polis');
        
        // Qalan hər kəs Vətəndaş olur
        while (roles.length < lobby.length) {
            roles.push('Vətəndaş');
        }

        // Rolları qarışdırırıq ki, təsadüfi düşsün
        roles = shuffle(roles);

        // Hər oyunçuya rolunu göndəririk
        lobby.forEach(async (playerId, index) => {
            const role = roles[index];
            playerRoles[playerId] = role; // Yaddaşa yazırıq

            try {
                const user = await client.users.fetch(playerId);
                let emoji = '';
                if(role === 'Mafiya') emoji = '🔪';
                else if(role === 'Həkim') emoji = '💉';
                else if(role === 'Polis') emoji = '👮';
                else emoji = '🧑‍🌾';

                await user.send(`🤫 **Sənin rolun:** ${emoji} ${role}\nOyun başladı, heç kimə rolunu demə!`);
            } catch (err) {
                message.channel.send(`<@${playerId}>-in DM-i bağlıdır deyə rolunu göndərə bilmədim!`);
            }
        });

        message.channel.send('🌞 **Səhər açıldı!** Şəhər əhalisi oyanıb müzakirəyə başlasın. Kim Mafiyadır?');
    }

    // 4. OYUNU BİTİRMƏK (RESET)
    if (command === '!reset') {
        lobby = [];
        gameActive = false;
        playerRoles = {};
        message.channel.send('🔄 Oyun sıfırlandı! Yeni oyun üçün `!join` yaza bilərsiniz.');
    }

    // 5. ROLUNU ÖYRƏNMƏK (Əgər kimsə DM-i silibsə)
    if (command === '!rolum') {
        if (!gameActive) return message.reply('Oyun başlamayıb.');
        if (!playerRoles[message.author.id]) return message.reply('Sən oyunda deyilsən.');
        
        // Burda DM atırıq, kanala yazmırıq ki, bilinməsin
        try {
            await message.author.send(`Sənin rolun: ${playerRoles[message.author.id]}`);
            message.reply('DM-nə bax.');
        } catch (e) {
            message.reply('DM bağlıdır.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
