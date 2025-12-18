require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');

// --- YENİ HİSSƏ: RENDER ÜÇÜN SERVER (BUNU ƏLAVƏ ET) ---
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

const client = new Client({
    // ... (kodun qalanı olduğu kimi qalsın)
