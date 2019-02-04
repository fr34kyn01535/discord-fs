import * as Discord from "discord.js";
import * as Mode from "stat-mode";
import { Journal } from "./Journal";
import * as fs from "fs";
import { Stream } from "stream";

export default class FileChannel {
    private guild: Discord.Guild;
    private channel: Discord.TextChannel; 
    public journal: Journal;
    constructor(client: Discord.Client ,guild: string,channel: string){
        if(!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");
        client.on('ready',() => {
            console.log("Connected to Discord...");
           this.guild = client.guilds.get(guild);
           this.channel = <Discord.TextChannel> this.guild.channels.get(channel);
           this.journal = new Journal(this.channel); 
           this.loadJournal();
        }); 

        client.on('message',function(message){
            if(message.channel.id != channel) return;
            if(message.type == "PINS_ADD") message.delete();
        })
    }
    private async loadJournal(){
        await this.journal.Load();
        if(this.journal.GetDirectory("/") == null) this.journal.CreateDirectory("/");
    }

    public stat(pathName:string ,cb :(err?: string,stats?: VirtualStats) => void){
        var directoryEntry = this.journal.GetDirectory(pathName);
        var stat = new VirtualStats(); 
        stat.uname= 'Discord';
        stat.gname= 'Tester';
        var mode = new Mode(stat);

        if(directoryEntry != null){
            mode.isDirectory(true);
            stat.size = 0;
        }else{
            var file = this.journal.GetFile(pathName);
            if(file == null){
                return cb("File not found",null);
            }else{
                stat.size = file.size;
                stat.mtime = <number><any>file.journalEntry.changed;
            }
            mode.isFile(true);
        }
        mode.owner.read = true;
        mode.owner.write = true;
        mode.owner.execute = true;
        mode.group.read = true;
        mode.group.write = true;
        mode.group.execute = true;
        mode.others.read = true;
        mode.others.write = true;
        mode.others.execute = true;
        cb(null,stat);
    }

    public readdir(pathName:string ,cb :(err?: string,files?: Array<string>) => void){
        var files = this.journal.GetFiles(pathName);
        var directories = this.journal.GetChildDirectories(pathName);
        cb(null,files.concat(directories));
    }

    public mkdir(pathName:string ,cb :(err?: string) => void){
        this.journal.CreateDirectory(pathName);
        cb();
    }

    public async unlink(pathName:string ,cb :(err?: string) => void){
        var file = this.journal.GetFile(pathName);
        if(file == null) {
            return cb("File not found");
        }
        else
            this.journal.DeleteFile(pathName).then(() => cb()).catch((err) => cb(err));
    }

    public rmdir(pathName:string ,cb :(err?: string) => void){
        var directory = this.journal.GetDirectory(pathName);
        if(directory == null) return cb("Directory not found");
        else
            this.journal.DeleteDirectory(pathName).then(() => cb());
    }

    public upload(pathName:string , offset, cb :(err?: string,stream?: Stream ) => void){
        this.journal.CreateFile(pathName).then((stream)=>{
            cb(null,stream);
        });
    } 
    
    public async download(pathName:string ,offset,cb :(err?: string,stream?: Stream ) => void){
        var file = this.journal.GetFile(pathName);
        if(file != null){
            file.Download().then((stream)=>{
                cb(null,stream);
            }).catch((err)=>{
                cb(err);
            });
        }else cb("File not found");
    }
}



class VirtualStats{
    constructor(){
        this.size = 1;
        this.mtime = Date.now();
        this.uname= 'Discord';
        this.gname= 'Tester';
        var mode = new Mode(this);
        mode.owner.read = true;
        mode.owner.write = true;
        mode.owner.execute = true;
        mode.group.read = true;
        mode.group.write = true;
        mode.group.execute = true;
        mode.others.read = true;
        mode.others.write = true;
        mode.others.execute = true; 
    }
    public mtime:number;
    public mode:number; 
    public size:number;
    public uname:string;
    public gname:string;
}
