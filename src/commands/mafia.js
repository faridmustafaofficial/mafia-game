const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MafiaGame, activeGames } = require('../game/gameManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mafia')
        .setDescription('Mafia oyunu idarəetməsi')
        .addSubcommand(sub => 
            sub.setName('create').setDescription('Yeni oyun yarat (Lobby)'))
        .addSubcommand(sub => 
            sub.setName('join').setDescription('Mövcud oyuna qoşul'))
        .addSubcommand(sub => 
            sub.setName('leave').setDescription('Oyundan çıx'))
        .addSubcommand(sub => 
            sub.setName('start').setDescription('Oyunu başlat (Yalnız Host)'))
        .addSubcommand(sub => 
            sub.setName('vote').setDescription('Gündüz fazasında səs ver')
                .addUserOption(opt => opt.setName('target').setDescription('Kimi asmaq istəyirsən?').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('end').setDescription('Oyunu məcburi bitir (Yalnız Host)')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        const userId = interaction.user.id;

        // OYUN YARATMAQ
        if (subcommand === 'create') {
            if (activeGames.has(guildId)) {
                return interaction.reply({ content: 'Bu serverdə artıq aktiv oyun var!', ephemeral: true });
            }
            const game = new MafiaGame(userId, interaction.guild);
            activeGames.set(guildId, game);
            return interaction.reply({ 
                content: `✅ **Lobby yaradıldı!** Host: <@${userId}>\nQoşulmaq üçün \`/mafia join\` yazın.` 
            });
        }

        const game = activeGames.get(guildId);
        if (!game) {
            return interaction.reply({ content: 'Bu serverdə aktiv oyun yoxdur. `/mafia create` ilə yaradın.', ephemeral: true });
        }

        // QOŞULMAQ
        if (subcommand === 'join') {
            if (game.state !== 'LOBBY') return interaction.reply({ content: 'Oyun artıq başlayıb!', ephemeral: true });
            const success = await game.addPlayer(userId);
            if (success) {
                return interaction.reply(`👤 <@${userId}> oyuna qoşuldu! (Cəmi: ${game.players.length})`);
            } else {
                return interaction.reply({ content: 'Artıq oyundasan!', ephemeral: true });
            }
        }

        // ÇIXMAQ
        if (subcommand === 'leave') {
            if (game.state !== 'LOBBY') return interaction.reply({ content: 'Oyun başladıqdan sonra çıxa bilməzsən!', ephemeral: true });
            await game.removePlayer(userId);
            return interaction.reply(`👋 <@${userId}> oyunu tərk etdi.`);
        }

        // BAŞLATMAQ
        if (subcommand === 'start') {
            if (game.hostId !== userId) return interaction.reply({ content: 'Oyunu yalnız Host başlada bilər!', ephemeral: true });
            if (game.state !== 'LOBBY') return interaction.reply({ content: 'Oyun artıq davam edir.', ephemeral: true });
            
            try {
                await interaction.reply("🚀 Oyun başladılır... Kanallar yaradılır...");
                await game.start();
            } catch (error) {
                return interaction.editReply(`Xəta: ${error.message}`);
            }
        }

        // SƏS VERMƏK
        if (subcommand === 'vote') {
            const targetUser = interaction.options.getUser('target');
            const result = await game.handleVote(userId, targetUser.id);
            return interaction.reply({ content: result, ephemeral: true }); // Səsi gizli saxla
        }

        // BİTİRMƏK
        if (subcommand === 'end') {
            if (game.hostId !== userId) return interaction.reply({ content: 'Yalnız Host bitirə bilər!', ephemeral: true });
            await game.endGame();
            return interaction.reply("🛑 Oyun məcburi dayandırıldı və kanallar silindi.");
        }
    }
};