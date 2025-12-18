/**
 * RoleManager - Rolların paylanması və qarışdırılması
 */

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function assignRoles(playerIds) {
    const count = playerIds.length;
    let roles = [];

    // Tələb olunan rol paylanması
    if (count === 4) {
        roles = ['Mafiya'];
    } else if (count === 5) {
        roles = ['Mafiya', 'Həkim'];
    } else if (count === 6) {
        roles = ['Mafiya', 'Həkim', 'Polis'];
    } else if (count >= 7 && count <= 8) {
        roles = ['Mafiya', 'Mafiya', 'Həkim', 'Polis'];
    } else if (count >= 9 && count <= 10) {
        roles = ['Mafiya', 'Mafiya', 'Mafiya', 'Həkim', 'Polis'];
    } else {
        // Fallback (4 nəfərdən az olarsa - kod icazə vermir, amma təhlükəsizlik üçün)
        roles = ['Mafiya']; 
    }

    // Qalan hər kəs Vətəndaş
    while (roles.length < count) {
        roles.push('Vətəndaş');
    }

    // Rolları qarışdır
    roles = shuffle(roles);

    // Map yaradırıq: PlayerID -> Role
    const playerRoles = {};
    playerIds.forEach((id, index) => {
        playerRoles[id] = {
            role: roles[index],
            isAlive: true,
            id: id
        };
    });

    return playerRoles;
}

module.exports = { assignRoles };