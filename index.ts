import * as Discord from "discord.js";
import HTTPFrontend from "./src/frontends/HTTPFrontend";
import FTPFrontend from "./src/frontends/FTPFrontend";
import FuseFrontend from "./src/frontends/FuseFrontend";
import Journal from "./src/Journal";

var bot = new Discord.Client();

var guildID = process.env.GUILD;
var channelID = process.env.CHANNEL;
var token = process.env.TOKEN;

if(guildID == null || channelID == null || token == null){
    console.error("GUILD, CHANNEL and TOKEN must be set!");
    process.exit(1);
}

var guild: Discord.Guild;
var channel: Discord.TextChannel;

bot.on('ready',() => {
    console.log("Connected to Discord...");
    guild = bot.guilds.get(guildID);
    if(guild == null) throw Error("Guild " + guildID + " not found");
    channel = <Discord.TextChannel> guild.channels.get(channelID);
    if(channel == null) throw Error("Channel " + channelID + " not found");

    console.info("Loading journal from " + guild.name + "/" + channel.name);
    bot.on('message',function(message){
        if(message.channel.id != channel.id) return;
        if(message.type == "PINS_ADD") message.delete();
    });

    new Journal(channel).Load().then((journal: Journal) => {

        if(process.env.HTTP_PORT != null){
            var httpPort = process.env.HTTP_PORT;
            new HTTPFrontend(journal, parseInt(httpPort)).Listen().then(()=>{
                console.log("Loaded HTTPFrontend on 0.0.0.0:" + httpPort);
            }).catch((err)=>{
                console.warn("Failed to load HTTPFrontend", err);
            });
        }
        
        if(process.env.LISTEN_IP != null && process.env.PORT != null && process.env.EXTERNAL_IP != null){
            var port = process.env.PORT;
            var listenIP = process.env.LISTEN_IP;
            var externalIP = process.env.EXTERNAL_IP;
            new FTPFrontend(journal, listenIP ,parseInt(port), externalIP ).Listen().then(()=>{
                console.log("Loaded FTPFrontend on " + listenIP + ":" + port + "/" + externalIP + ":" + port);
            }).catch((err)=>{
                console.warn("Failed to load FTPFrontend", err);
            });
        }
        if(process.env.MOUNT_PATH){
            new FuseFrontend(journal).Mount(process.env.MOUNT_PATH);
        }
   });
}); 

bot.login(token);

