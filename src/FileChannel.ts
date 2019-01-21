import * as Discord from "discord.js";
import * as Mode from "stat-mode";
import { Journal } from "./Journal";
import * as uuidv4 from "uuid/v4";
import * as fs from "fs";

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
        this.journal.CreateDirectory("/");
       //this.journal.CreateFile("/var/test.txt",Buffer.from("12354"))
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
            if(file == null) return cb("File not found",null);
            stat.size = file.size;
            stat.mtime = <number><any>file.changed;
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
        var files = this.journal.GetFiles(pathName);
        var directories = this.journal.GetChildDirectories(pathName);
        cb(null,files.concat(directories));
    }

    public download(pathName,offset,cb){
        this.journal.DownloadFile(pathName).then((res) => {
            cb(null,res);
        })
    }
    public mkdir(pathName,cb){
        this.journal.CreateDirectory(pathName);
        cb();
    }

    public unlink(pathName,cb){
        var file = this.journal.GetFile(pathName);
        if(file == null) return cb("File not found");
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
        var tempFile = "./tmp/"+ uuidv4();
        var that = this;
        var fileStream = fs.createWriteStream(tempFile);
        fileStream.on('finish', function() {
            that.journal.CreateFile(pathName,fs.readFileSync(tempFile)).then(function(){
                fs.unlinkSync(tempFile);
            });
        });
        cb(null,fileStream);
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
