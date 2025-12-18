/**
 * GameManager - Oyunun bütün məntiqi
 */
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { assignRoles } = require('./roleManager');
const { setupChannels, deleteChannels } = require('./roomManager');

// Qlobal Oyun Yaddaşı (GuildID -> GameState)
const activeGames = new Map();

class MafiaGame {
    constructor(hostId, guild) {
        this.guild = guild;
        this.hostId = hostId;
        this.players = [hostId]; // Join edənlərin ID-ləri
        this.state = 'LOBBY'; // LOBBY, NIGHT, DAY, ENDED
        this.playerData = {}; // ID -> Role, Status
        this.channels = {}; 
        this.round = 0;
        
        // Gecə hərəkətləri
        this.nightActions = {
            mafiaTarget: null,
            doctorTarget: null,
            policeTarget: null,
            lastHealed: null // Həkimin son qoruduğu (ardıcıl qoruma qadağası üçün)
        };

        // Gündüz səsverməsi
        this.votes = {};
    }

    async addPlayer(userId) {
        if (this.players.includes(userId)) return false;
        this.players.push(userId);
        return true;
    }

    async removePlayer(userId) {
        this.players = this.players.filter(id => id !== userId);
    }

    async start() {
        if (this.players.length < 4 || this.players.length > 10) {
            throw new Error("Oyunçu sayı 4 ilə 10 arasında olmalıdır!");
        }

        // 1. Rolları payla
        this.playerData = assignRoles(this.players);
        const mafiaIds = Object.values(this.playerData)
            .filter(p => p.role === 'Mafiya')
            .map(p => p.id);

        // 2. Otaqları yarat
        this.channels = await setupChannels(this.guild, this.players, mafiaIds);
        
        // 3. Rolları DM at
        await this.notifyRoles();

        // 4. Oyunu başlat
        this.state = 'NIGHT'; // İlk gecə başlayır
        this.round = 1;
        await this.channels.gameChannel.send({ embeds: [
            new EmbedBuilder()
                .setTitle('🎭 Oyun Başladı!')
                .setDescription(`Rollar paylandı. DM qutunuzu yoxlayın.\n**${this.round}-ci Gecə başladı.**`)
                .setColor('DarkBlue')
        ]});

        await this.startNightPhase();
    }

    async notifyRoles() {
        for (const playerId of this.players) {
            const data = this.playerData[playerId];
            try {
                const user = await this.guild.members.fetch(playerId);
                const embed = new EmbedBuilder()
                    .setTitle('Sənin Rolun')
                    .setDescription(`Sən **${data.role}** rolundasan! ${this.getRoleEmoji(data.role)}`)
                    .setColor('Gold');
                
                if (data.role === 'Mafiya') {
                    const partners = Object.values(this.playerData)
                        .filter(p => p.role === 'Mafiya' && p.id !== playerId)
                        .map(p => `<@${p.id}>`);
                    if (partners.length > 0) embed.addFields({ name: 'Komanda yoldaşların:', value: partners.join(', ') });
                }

                await user.send({ embeds: [embed] });
            } catch (e) {
                console.log(`DM göndərilə bilmədi: ${playerId}`);
            }
        }
    }

    getRoleEmoji(role) {
        switch(role) {
            case 'Mafiya': return '🔪';
            case 'Həkim': return '💉';
            case 'Polis': return '👮';
            default: return '🧑‍🌾';
        }
    }

    async startNightPhase() {
        this.state = 'NIGHT';
        this.nightActions = { mafiaTarget: null, doctorTarget: null, policeTarget: null, lastHealed: this.nightActions.lastHealed };
        
        // Mute everyone in voice (optional logic placeholder)
        
        // Fəaliyyət göstərən rollara DM at
        const alivePlayers = Object.values(this.playerData).filter(p => p.isAlive);
        const options = alivePlayers.map(p => ({ label: `Player ${p.id.slice(-4)}`, value: p.id, description: 'Seçmək üçün bas' }));
        // Adları fetch etmək uzun çəkər deyə sadəcə ID istifadə edirik və ya kanalda mention edirik. 
        // Real-time üçün select menu-ya username qoymaq üçün user-i fetch etmək lazımdır. Biz sadəlik üçün ID saxlayırıq.
        
        const actionPromises = [];

        // MAFIYA LOGIC
        const mafias = alivePlayers.filter(p => p.role === 'Mafiya');
        if (mafias.length > 0) {
            // İlk mafiyaya mesaj atırıq (sadəlik üçün) və ya hamısına atıb ilk cavabı götürürük
            mafias.forEach(m => actionPromises.push(this.sendNightAction(m.id, 'MAFIA', alivePlayers)));
        }

        // HEKIM LOGIC
        const doctor = alivePlayers.find(p => p.role === 'Həkim');
        if (doctor) actionPromises.push(this.sendNightAction(doctor.id, 'DOCTOR', alivePlayers));

        // POLIS LOGIC
        const police = alivePlayers.find(p => p.role === 'Polis');
        if (police) actionPromises.push(this.sendNightAction(police.id, 'POLICE', alivePlayers));

        await Promise.all(actionPromises);
        
        // Gecənin bitməsini gözləmək üçün timer (Məs: 30 saniyə)
        setTimeout(() => this.endNightPhase(), 30000); 
        await this.channels.gameChannel.send("🌙 **Gecə düşdü.** Şəhər yatır... (30 saniyə vaxtınız var)");
    }

    async sendNightAction(userId, type, alivePlayers) {
        try {
            const user = await this.guild.members.fetch(userId);
            
            // Özünü seçə bilməz siyahısı (Həkim üçün)
            let options = [];
            for(let p of alivePlayers) {
                const member = await this.guild.members.fetch(p.id);
                options.push({
                    label: member.displayName,
                    value: p.id,
                    description: type === 'POLICE' ? 'Yoxla' : (type === 'MAFIA' ? 'Öldür' : 'Qoru')
                });
            }

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`night_action_${type}`)
                    .setPlaceholder(type === 'MAFIA' ? 'Kimi öldürək?' : (type === 'DOCTOR' ? 'Kimi qoruyaq?' : 'Kimi yoxlayaq?'))
                    .addOptions(options)
            );

            const msg = await user.send({ content: `**Gecə Əməliyyatı:**`, components: [row] });
            
            // Collector
            const filter = i => i.user.id === userId;
            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 25000, max: 1 });

            collector.on('collect', async i => {
                const targetId = i.values[0];
                
                if (type === 'MAFIA') this.nightActions.mafiaTarget = targetId;
                if (type === 'DOCTOR') {
                     if (targetId === this.nightActions.lastHealed && targetId === userId) {
                         // Özünü ardıcıl qoruya bilməz qaydası
                         await i.reply("Özünü ardıcıl iki dəfə qoruya bilməzsən!");
                         return;
                     }
                     this.nightActions.doctorTarget = targetId;
                }
                if (type === 'POLICE') {
                    const targetRole = this.playerData[targetId].role;
                    const isMafia = targetRole === 'Mafiya';
                    await i.reply(`🔍 Yoxlama nəticəsi: Bu şəxs **${isMafia ? 'MAFİYADIR! 🔪' : 'Təmizdir ✅'}**`);
                    return; // Polis üçün iş bitdi
                }

                await i.reply(`Seçim qəbul edildi: <@${targetId}>`);
            });

        } catch (e) { console.log("DM Error", e); }
    }

    async endNightPhase() {
        if (this.state !== 'NIGHT') return;

        let killedId = this.nightActions.mafiaTarget;
        const savedId = this.nightActions.doctorTarget;

        let msg = "🌞 **Səhər açıldı!**\n";

        if (killedId) {
            if (killedId === savedId) {
                msg += "Gecə atışma oldu, amma Həkim öz işini mükəmməl gördü! **Heç kim ölmədi.**";
                this.nightActions.lastHealed = savedId;
            } else {
                this.playerData[killedId].isAlive = false;
                msg += `Təəssüf ki, **<@${killedId}>** qətlə yetirildi. O, **${this.playerData[killedId].role}** idi.`;
                // Kanaldan permission silmək olar, amma mute daha yaxşıdır.
            }
        } else {
            msg += "Gecə sakit keçdi. Heç kim ölmədi.";
        }

        await this.channels.gameChannel.send(msg);
        
        if (await this.checkWinCondition()) return;

        this.startDayPhase();
    }

    async startDayPhase() {
        this.state = 'DAY';
        this.votes = {};
        await this.channels.gameChannel.send("🗣️ **Müzakirə vaxtı!** Şübhələndiyiniz şəxsi `/mafia vote` əmri ilə səsə qoyun.");
    }

    async handleVote(voterId, targetId) {
        if (this.state !== 'DAY') return "Səsvermə vaxtı deyil!";
        if (!this.playerData[voterId].isAlive) return "Ölülər səs verə bilməz!";
        if (!this.playerData[targetId].isAlive) return "Ölülərə səs verə bilməzsən!";

        this.votes[voterId] = targetId;
        
        // Səsləri say
        const voteCounts = {};
        Object.values(this.votes).forEach(target => {
            voteCounts[target] = (voteCounts[target] || 0) + 1;
        });

        const aliveCount = Object.values(this.playerData).filter(p => p.isAlive).length;
        const currentVotes = Object.keys(this.votes).length;

        // Əgər hamı səs veribsə
        if (currentVotes === aliveCount) {
            this.endDayPhase(voteCounts);
            return "Səs qəbul edildi. Hamı səs verdi!";
        }

        return `Səs qəbul edildi: <@${targetId}> üçün. (${currentVotes}/${aliveCount})`;
    }

    async endDayPhase(voteCounts) {
        // Ən çox səs yığanı tap
        let maxVotes = 0;
        let eliminatedId = null;
        
        for (const [target, count] of Object.entries(voteCounts)) {
            if (count > maxVotes) {
                maxVotes = count;
                eliminatedId = target;
            } else if (count === maxVotes) {
                eliminatedId = null; // Bərabərlik (Tie) - heç kim ölmür
            }
        }

        if (eliminatedId) {
            this.playerData[eliminatedId].isAlive = false;
            await this.channels.gameChannel.send(`⚖️ Xalq qərarını verdi! **<@${eliminatedId}>** edam edildi. O, **${this.playerData[eliminatedId].role}** idi.`);
        } else {
            await this.channels.gameChannel.send("⚖️ Səslər bərabər oldu. Bu gün heç kim edam edilmir.");
        }

        if (await this.checkWinCondition()) return;

        // Yeni gecəyə keçid
        setTimeout(() => this.startNightPhase(), 5000);
    }

    async checkWinCondition() {
        const alivePlayers = Object.values(this.playerData).filter(p => p.isAlive);
        const mafias = alivePlayers.filter(p => p.role === 'Mafiya').length;
        const civilians = alivePlayers.length - mafias;

        let winner = null;

        if (mafias === 0) {
            winner = 'VƏTƏNDAŞLAR';
        } else if (mafias >= civilians) {
            winner = 'MAFİYA';
        }

        if (winner) {
            this.state = 'ENDED';
            const embed = new EmbedBuilder()
                .setTitle('🏆 OYUN BİTDİ!')
                .setDescription(`Qalib tərəf: **${winner}** 🎉`)
                .setColor(winner === 'MAFİYA' ? 'Red' : 'Green');
            
            await this.channels.gameChannel.send({ embeds: [embed] });
            await this.channels.gameChannel.send("⚠️ Kanallar 10 saniyə sonra silinəcək...");
            
            setTimeout(() => this.endGame(), 10000);
            return true;
        }
        return false;
    }

    async endGame() {
        await deleteChannels(this.channels);
        activeGames.delete(this.guild.id);
    }
}

module.exports = { MafiaGame, activeGames };