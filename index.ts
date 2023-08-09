import Bot from "./src/DiscordFSBot";
import config from "dotenv"
config()
let bot = new Bot();
bot.connect(process.env.TOKEN)
