import * as Discord from "discord.js";
import GuildStorageHandler from "./GuildStorageHandler";
import config from "dotenv"
export default class Bot{
    private bot: Discord.Client
    private storageHandler: GuildStorageHandler;

    public async connect(token: string){
        this.bot = new Discord.Client({
            intents: [
                Discord.IntentsBitField.Flags.Guilds, 
                Discord.IntentsBitField.Flags.GuildMessages, 
            ]
        });
        this.bot.on('ready',this.load.bind(this));
        await this.bot.login(token);
    }

    private async load(){
        console.log("Connected to Discord...");
        let guildID = process.env.GUILD;
        let channelID = process.env.CHANNEL;

        let guild = this.bot.guilds.resolve(guildID);
        if(guild == null) throw Error("Guild " + guildID + " not found");
        let channel = <Discord.TextChannel> guild.channels.resolve(channelID);
        if(channel == null) throw Error("Channel " + channelID + " not found");
    
        this.storageHandler = new GuildStorageHandler(guild,channel);
        await this.storageHandler.load();
    }

}
