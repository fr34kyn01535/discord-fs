import * as Discord from "discord.js";
import * as Mode from "stat-mode";
import { Journal } from "./Journal";
import * as fs from "fs";
import * as split from "fixed-size-stream-splitter";
import * as CombineStream from "combine-stream";

export default class FileChannel {
    private guild: Discord.Guild;
    private channel: Discord.TextChannel; 
    private journal: Journal;
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

    public stat(pathName,cb){
        var directoryEntry = this.journal.GetDirectory(pathName);
        var stat = new VirtualStats(); 
        stat.uname= 'Discord';
        stat.gname= 'Tester';
        var mode = new Mode(stat);

        if(directoryEntry != null){
            mode.isDirectory(true);
        }else{
            var file = this.journal.GetFile(pathName);
            if(file == null){
                var i = 0;
                var partFile = this.journal.GetFile(pathName+".part" + (i++));
                if(partFile == null) return cb("File not found",null);
                stat.mtime = <number><any>partFile.changed;
                var totalSize = 0;
                while(partFile != null){
                    totalSize += partFile.size;
                    partFile = this.journal.GetFile(pathName+".part" + (i++));
                }
                stat.size = totalSize;
            }else{
                stat.size = file.size;
                stat.mtime = <number><any>file.changed;
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

    public readdir(pathName, cb){
        var files = this.journal.GetFiles(pathName).map(f => f.replace(".part0","")).filter(f => !f.includes(".part"));
        var directories = this.journal.GetChildDirectories(pathName);
        cb(null,files.concat(directories));
    }

    public mkdir(pathName,cb){
        this.journal.CreateDirectory(pathName);
        cb();
    }

    public async unlink(pathName,cb){
        var file = this.journal.GetFile(pathName);
        if(file == null) {
            var i = 0;
            var currentPath = pathName+".part" + (i++);
            var partFile = this.journal.GetFile(currentPath);
            if(partFile == null) return cb("File not found",null);
            while(partFile != null){
                await this.journal.DeleteFile(currentPath);
                currentPath = pathName+".part" + (i++)
                partFile = this.journal.GetFile(currentPath);
            }
            cb();
        }
        else
            this.journal.DeleteFile(pathName).then(() => cb());
    }

    public rmdir(pathName,cb){
        var directory = this.journal.GetDirectory(pathName);
        if(directory == null) return cb("Directory not found");
        else
            this.journal.DeleteDirectory(pathName).then(() => cb());
    }

    public upload(pathName, offset, cb){
        var that = this;
        var j = 0;
        var fileStream = split(8e+6, function (stream) {
            that.journal.CreateFile(pathName+".part"+j++,stream);
        });
        cb(null,fileStream);
    } 
    
    public async download(pathName,offset,cb){
        var file = this.journal.GetFile(pathName);
        if(file == null){
            var i = 0;
            var currentPath = pathName+".part" + (i++);
            var partFile = this.journal.GetFile(currentPath);
            if(partFile == null) 
                return cb("File not found",null);
            var streams =[];
            while(partFile != null){
                var res = await this.journal.DownloadFile(currentPath);
                streams.push(res);
                currentPath = pathName+".part" + (i++);
                partFile = this.journal.GetFile(currentPath);
            }
            cb(null,new CombineStream(streams));
        }else{
            this.journal.DownloadFile(pathName).then((res) => {
                cb(null,res);
            });
        }
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
