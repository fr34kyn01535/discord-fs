import Bot from "./src/DiscordFSBot";
require('dotenv').config();
let bot = new Bot();
bot.connect(process.env.TOKEN);