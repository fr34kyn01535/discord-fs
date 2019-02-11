import * as crypto from "crypto";
import * as Discord from "discord.js";
import * as split from "fixed-size-stream-splitter";
import * as https from "https";
import * as MultiStream from "multistream";
import * as path from "path";
import * as stream from "stream";
import { Stream } from "stream";
import * as uuidv4 from "uuid/v4";

export const enum JOURNAL_ENTRY_TYPE {
    FILE = 0,
    DIRECTORY = 1
}

export class BaseJournalEntry{
    public readonly type : JOURNAL_ENTRY_TYPE;
    public name: string 
    public mid: string
    public changed:Date
    public created:Date
}

export class File{
    public journalEntry : FileJournalEntry
    public directory :DirectoryJournalEntry
    public parts: FileJournalEntry[]
    get size() : number {
        return this.journalEntry.size + this.parts.map(a => a.size).reduce((a, b) => a + b, 0);
    }
}

export class FileJournalEntry extends BaseJournalEntry {
    public readonly type : JOURNAL_ENTRY_TYPE = JOURNAL_ENTRY_TYPE.FILE;
    public directory: any
    public url: string
    public iv: string
    public size: number
}

export class DirectoryJournalEntry extends BaseJournalEntry {
    public readonly type : JOURNAL_ENTRY_TYPE = JOURNAL_ENTRY_TYPE.DIRECTORY;
    public id: any
}


export default class Journal {
    private aesKey = process.env.AES_KEY ? crypto.createHash('md5').update(process.env.AES_KEY,"utf8").digest("hex").slice(0, 32) : null;

    encrypt(text:string) : string {
        var iv = crypto.randomBytes(16);
        var cipher = crypto.createCipheriv("aes-256-cbc",this.aesKey,iv);
        return iv.toString("hex") + cipher.update(Buffer.from(text,"utf-8"),"utf8","hex") + cipher.final("hex");
      }
       
    decrypt(text:string) : string{
        var b = Buffer.from(text, "hex");
        var iv = b.slice(0,16);
        var data = b.slice(16,b.length);
        var decipher = crypto.createDecipheriv("aes-256-cbc",this.aesKey,iv);
        return decipher.update(data).toString() + decipher.final().toString();
    }

    constructor(channel: Discord.TextChannel) {
        this.channel = channel;
    }

    getCipher(iv){
        return crypto.createCipheriv("aes-256-cbc",this.aesKey,iv);
    }

    getDecipher(iv){
        return crypto.createDecipheriv("aes-256-cbc",this.aesKey,iv);
    }

    private channel: Discord.TextChannel;

    public async Load() : Promise<Journal> {
        var that: Journal = this;
        var lastMessages = await this.channel.fetchMessages({ limit: 100 });
        var messages : Array<Discord.Message> = Array.from(lastMessages.values());
        console.info("Fetched "+messages.length +" journal entries");

        while(lastMessages.size === 100)
        {
            lastMessages = await this.channel.fetchMessages({ limit: 100, before:lastMessages.lastKey() });
            messages = messages.concat(Array.from(lastMessages.values()));
            console.info("Fetched "+lastMessages.size +" more journal entries");
        }

        return new Promise<Journal>((resolve, reject) => {
                messages.filter(m => m.author.id == that.channel.client.user.id).forEach(message => {
                    try {
                        var entry = null;

                        if(that.aesKey != null){
                            var content = that.decrypt(message.content);
                            entry = JSON.parse(content);
                        }else{
                            entry = JSON.parse(message.content);
                        }

                        if (entry.type == JOURNAL_ENTRY_TYPE.DIRECTORY) {
                            var directory :DirectoryJournalEntry = <DirectoryJournalEntry>Object.assign(new DirectoryJournalEntry(), entry)
                            directory.mid = message.id;
                            directory.changed = message.createdAt;
                            that.directories.push(directory);
                        }
                        if (entry.type == JOURNAL_ENTRY_TYPE.FILE) {
                            var attachment = message.attachments.first();
                            var file :FileJournalEntry = <FileJournalEntry>Object.assign(new FileJournalEntry(), entry)
                            file.size = attachment.filesize;
                            file.url = attachment.url;
                            file.mid = message.id;
                            file.changed = message.createdAt;
                            that.files.push(file);
                        }
                    }
                    catch (e) {
                        console.error("Couldn't parse journal entry: " + message.content);
                    }
                });
                
                if(that.GetDirectory("/") == null) that.CreateDirectory("/");
                resolve(that);
        });
    }

    private directories: Array<DirectoryJournalEntry> = new Array<DirectoryJournalEntry>();
    private files: Array<FileJournalEntry> = new Array<FileJournalEntry>();

    private normalizePath(p){
        var r = path.posix.normalize(p.replace(/\\/g, '/'));
        if(r.endsWith("/") && r != "/") r = r.slice(0, -1);
        return r;
    }

    
    public async Download(file: File ) : Promise<stream.Readable> {
        var that = this;
        return new Promise<stream.Readable>(async (resolve, reject) => {
            try{
                var files = [file.journalEntry].concat(file.parts);
                var streams = [];
                for(var f of files){
                    var res = await that.downloadFile(f.url);
                    
                    if(that.aesKey == null){
                        res.pause();
                        streams.push(res);
                    }else{
                        res.pause();
                        streams.push(res.pipe(that.getDecipher(Buffer.from(f.iv,"hex"))));
                    }
                }
                resolve(MultiStream(streams));
            }catch(e){
                reject(e);
            }
        });
    }
    

    private async downloadFile(url: string) : Promise<stream.Readable> {
        return new Promise<stream.Readable>((resolve, reject) => { https.get(url, resolve).on("error", reject); });
    }

    public GetDirectory(directoryName) : DirectoryJournalEntry{
        directoryName = this.normalizePath(directoryName);
        var directory = this.directories.find(d => d.name == directoryName);
        return directory;
    }


    public GetChildDirectories(directoryName) : Array<string> {
        directoryName = this.normalizePath(directoryName);
        var children = [];
        this.directories.forEach((item) => {
            if(item.name != directoryName && item.name.startsWith(directoryName) && item.name.trim() != ""){
                var name = item.name;
                if(name.indexOf(directoryName) == 0) name = name.substring(directoryName.length);
                if(name.indexOf("/") == 0) name = name.substring(1);
                if(!name.includes("/")) children.push(name);
            }
        });
        return children;
    }

    public GetFile(filePath) : File {
        var directoryName = this.normalizePath(path.dirname(filePath));
        var fileName = path.basename(filePath);
        var directory = this.directories.find(d => d.name == directoryName);
        if(directory == null) return null;
        var file = new File();
        file.journalEntry = this.files.find(f => f.directory == directory.id && f.name == fileName);
        if(file.journalEntry == null) return null;
        file.parts = this.files.filter(f => f.directory == directory.id && f.name.indexOf(fileName+ ".part") == 0)
            .sort((a,b) => parseInt(a.name.split(".part").pop()) - parseInt(b.name.split(".part").pop()));
        file.directory = directory;
        return file;
    }

    public GetFiles(directoryName, ignorePartFiles = true) : Array<string> {
        var directory = this.GetDirectory(directoryName);
        if(directory == null) return [];
        var files = this.files.filter(f => f.directory == directory.id).map(f => f.name);
        if(ignorePartFiles) files = files.map(f => f.replace(".part0","")).filter(f => !f.includes(".part"));
        return files;
    }

    public async DeleteFile(filePath: string) {
        console.log("Deleting file " + filePath);
        var file = this.GetFile(filePath);
        if(file == null) return Promise.reject(new Error("File not found"));
        var files : FileJournalEntry[] = [file.journalEntry].concat(file.parts);
        var promises = [];
        for(var f of files){
            this.files = this.files.filter(f => f.mid != file.journalEntry.mid);
            var message = await this.channel.messages.get(file.journalEntry.mid);
            if(message != null) promises.push(message.delete());
        }
        return Promise.all(promises).then(()=>{}); //Hihi, penis.
    }

    public async CreateFile(filePath: string): Promise<Stream> {
        var j = 0;
        var that = this;
        return Promise.resolve(split(8e+6, function (stream) {
            if(that.aesKey != null){
                var iv = crypto.randomBytes(16);
                that.createFile(filePath + (j == 0 ? "" : ".part"+ j),stream.pipe(that.getCipher(iv)),iv);
            }else{
                that.createFile(filePath + (j == 0 ? "" : ".part"+ j),stream);
            }
            j++;
        }));
    };

    private async createFile(filePath: string, content: Stream, iv: Buffer = null): Promise<FileJournalEntry> {
        var that = this;
        return new Promise<FileJournalEntry>(async (resolve, reject) => {
            var directoryName = that.normalizePath(path.dirname(filePath));
            var fileName = path.basename(filePath);
            var directory = that.directories.find(d => d.name == directoryName);
            if (directory == null) directory = await that.CreateDirectory(directoryName);
            if(that.files.find(f => f.directory == directory.id && f.name == fileName)){
                await that.DeleteFile(filePath);
            }
            var entry: FileJournalEntry = new FileJournalEntry();
            if(iv != null)
                entry.iv = iv.toString("hex");
            entry.directory = directory.id;
            entry.name = fileName;

            var text = JSON.stringify(entry);
            var attachmentName = fileName;

            if(that.aesKey != null){
                 text = that.encrypt(text);
                attachmentName = that.encrypt(attachmentName);
            }

            that.channel.send(text, {
                files: [new Discord.Attachment(content, attachmentName)]
            }).then((message: Discord.Message) => { 
                var attachment = message.attachments.first();
                entry.size = attachment.filesize;
                entry.url = attachment.url;
                entry.mid = message.id;
                that.files.push(entry);
                return resolve(entry);
            }).catch(reject);
        });
    }

    public async CreateDirectory(directoryName: string): Promise<DirectoryJournalEntry> {
        var that = this;
        return new Promise<DirectoryJournalEntry>((resolve, reject) => {
            directoryName = that.normalizePath(directoryName);
            var existingDirectory = that.directories.find(d => d.name == directoryName);
            if(existingDirectory != null){
                console.log("Not recreating directory because it already exists " + directoryName);
                return resolve(existingDirectory);
            }
            console.log("Creating directory " + directoryName);
            var entry = new DirectoryJournalEntry();
            entry.id = uuidv4();
            entry.name = directoryName;
            var text = JSON.stringify(entry);
            if(that.aesKey != null){
                text = that.encrypt(text);
            }
            that.channel.send(text).then((message: Discord.Message) => {
                entry.mid = message.id;
                that.directories.push(entry);
                return resolve(entry);
            }).catch(reject);
        });
    }

    public async DeleteDirectory(directoryName: string) {
        console.log("Deleting directory " + directoryName);
        directoryName = this.normalizePath(directoryName);
        var directory = this.directories.find(d => d.name == directoryName);
        this.directories = this.directories.filter(d => d.id != directory.id);
        return new Promise((resolve, reject) => {
            if (directory != null) {
                var journalEntry = this.channel.messages.get(directory.mid);
                if (journalEntry != null)
                    journalEntry.delete().then(resolve).catch(reject);
                else
                    reject(new Error("Journal entry not found (async?)"));
            }
            else
                reject(new Error("Directory not found in journal"));
        });
    }
}

