/**
 * RoomManager - Kanal və Kateqoriya idarəetməsi
 */
const { ChannelType, PermissionFlagsBits } = require('discord.js');

async function setupChannels(guild, players, mafiaIds) {
    // 1. Kateqoriya yarat
    const category = await guild.channels.create({
        name: 'MAFIA GAME',
        type: ChannelType.GuildCategory
    });

    // Bütün oyunçular üçün ümumi icazələr (əsas kanallar)
    const baseOverwrites = [
        {
            id: guild.id, // Serverdəki hamı üçün gizli
            deny: [PermissionFlagsBits.ViewChannel]
        }
    ];

    // Oyundakı hər kəs görə bilsin
    players.forEach(pId => {
        baseOverwrites.push({
            id: pId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
    });

    // 2. Lobby (Text)
    const lobbyChannel = await guild.channels.create({
        name: `mafia-lobby`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: baseOverwrites
    });

    // 3. Game (Text)
    const gameChannel = await guild.channels.create({
        name: `mafia-game`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: baseOverwrites
    });

    // 4. Voice
    const voiceChannel = await guild.channels.create({
        name: `mafia-voice`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel]
            },
            ...players.map(pId => ({
                id: pId,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
            }))
        ]
    });

    // 5. Secret (Yalnız Mafiyalar üçün)
    const mafiaOverwrites = [
        {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel]
        }
    ];
    mafiaIds.forEach(mId => {
        mafiaOverwrites.push({
            id: mId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        });
    });

    const secretChannel = await guild.channels.create({
        name: `mafia-secret`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: mafiaOverwrites
    });

    return {
        category,
        lobbyChannel,
        gameChannel,
        voiceChannel,
        secretChannel
    };
}

async function deleteChannels(channels) {
    try {
        if (channels.gameChannel) await channels.gameChannel.delete();
        if (channels.lobbyChannel) await channels.lobbyChannel.delete();
        if (channels.secretChannel) await channels.secretChannel.delete();
        if (channels.voiceChannel) await channels.voiceChannel.delete();
        if (channels.category) await channels.category.delete();
    } catch (error) {
        console.error("Kanallar silinərkən xəta:", error);
    }
}

module.exports = { setupChannels, deleteChannels };