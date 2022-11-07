import Bot from "./src/DiscordFSBot";

let bot = new Bot();
bot.connect(process.env.TOKEN)
