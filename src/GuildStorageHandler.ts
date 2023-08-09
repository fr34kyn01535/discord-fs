import * as Discord from "discord.js";
import ChannelAttachmentHandler from "./backend/ChannelAttachmentHandler";
import FTPFrontend from "./frontends/FTPFrontend";
//import FuseFrontend from "./frontends/FuseFrontend";
import HTTPFrontend from "./frontends/HTTPFrontend";
import IFrontend from "./frontends/IFrontend";
import config from "dotenv"
config()
export default class StorageHandler{
   
    private journal: ChannelAttachmentHandler
    private frontends : IFrontend[] = [];

    constructor(
        private guild: Discord.Guild, 
        private channel: Discord.TextChannel
        ){
       
        this.journal = new ChannelAttachmentHandler(channel);
    }

    public async load(){
        this.journal.load();
        this.loadFrontends();
    }

    private loadFrontends(){
        if(process.env.HTTP_PORT != null){
            let httpPort = process.env.HTTP_PORT;
            this.addFrontend(new HTTPFrontend(parseInt(httpPort)));
        }
        
        if(process.env.LISTEN_IP != null && (process.env.FTP_PORT != null || process.env.PORT != null) && process.env.EXTERNAL_IP != null){
            let port = process.env.FTP_PORT || process.env.PORT;
            let listenIP = process.env.LISTEN_IP;
            let externalIP = process.env.EXTERNAL_IP;
            this.addFrontend(new FTPFrontend(listenIP ,parseInt(port), externalIP));
        }

        if(process.env.MOUNT_PATH){
            //this.addFrontend(new FuseFrontend(process.env.MOUNT_PATH));
        }

        this.startFrontends();
    }

    
    public addFrontend(frontend: IFrontend){
        this.frontends.push(frontend);
    }

    private startFrontends(){
        this.frontends.forEach(async f => await f.start(this.journal));
    }
}
