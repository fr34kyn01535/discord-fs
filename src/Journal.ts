import * as uuidv4 from "uuid/v4";
import * as https from "https";
import * as path from "path";
import * as Discord from "discord.js";
import * as stream from "stream";
import { Stream } from "stream";
import * as split from "fixed-size-stream-splitter";
import * as MultiStream from "multistream";

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

    public async Download() : Promise<stream.Readable> {
        return new Promise<stream.Readable>(async (resolve, reject) => {
            try{
                var files = [this.journalEntry].concat(this.parts);
                var streams = [];
                for(var f of files){
                    var res = await this.downloadFile(f.url);
                    res.pause();
                    streams.push(res);
                }
                resolve(MultiStream(streams));
            }catch(e){
                reject(e);
            }
        });
    }

    private async downloadFile(url: string) : Promise<stream.Readable> {
        return new Promise<stream.Readable>((resolve, reject) => {
            https.get(url, (res) => { resolve(res); }).on("error", reject);
        });
    }
}

export class FileJournalEntry extends BaseJournalEntry {
    public readonly type : JOURNAL_ENTRY_TYPE = JOURNAL_ENTRY_TYPE.FILE;
    public directory: any
    public url: string
    public size: number
}

export class DirectoryJournalEntry extends BaseJournalEntry {
    public readonly type : JOURNAL_ENTRY_TYPE = JOURNAL_ENTRY_TYPE.DIRECTORY;
    public id: any
}

export class Journal {
    private channel: Discord.TextChannel;
    constructor(channel: Discord.TextChannel) {
        this.channel = channel;
    }

    public async Load(){
        console.log("Fetching initial 100 messages...");
        var lastMessages = await this.channel.fetchMessages({ limit: 100 });
        var messages : Array<Discord.Message> = Array.from(lastMessages.values());

        do{
            lastMessages = await this.channel.fetchMessages({ limit: 100, before:lastMessages.lastKey() });
            console.log("Fetching " + lastMessages.size+" more messages...");
            messages = messages.concat(Array.from(lastMessages.values()));
        } while(lastMessages.size === 100);

        return new Promise((resolve, reject) => {
                messages.filter(m => m.author.id == this.channel.client.user.id).forEach(message => {
                    try {
                        var entry = JSON.parse(message.content);
                        if (entry.type == JOURNAL_ENTRY_TYPE.DIRECTORY) {
                            var directory :DirectoryJournalEntry = <DirectoryJournalEntry>Object.assign(new DirectoryJournalEntry(), entry)
                            directory.mid = message.id;
                            directory.changed = message.createdAt;
                            this.directories.push(directory);
                        }
                        if (entry.type == JOURNAL_ENTRY_TYPE.FILE) {
                            var attachment = message.attachments.first();
                            var file :FileJournalEntry = <FileJournalEntry>Object.assign(new FileJournalEntry(), entry)
                            file.size = attachment.filesize;
                            file.url = attachment.url;
                            file.mid = message.id;
                            file.changed = message.createdAt;
                            this.files.push(file);
                        }
                    }
                    catch (e) {
                        console.error("Couldn't parse journal entry: " + message.content);
                    }
                });
                resolve();
        });
    }

    private directories: Array<DirectoryJournalEntry> = new Array<DirectoryJournalEntry>();
    private files: Array<FileJournalEntry> = new Array<FileJournalEntry>();

    private normalizePath(p){
        var r = path.posix.normalize(p.replace(/\\/g, '/'));
        if(r.endsWith("/") && r != "/") r = r.slice(0, -1);
        return r;
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

    public GetFile(filePath) : File{
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

    public async DeleteFile(filePath: string){
        return new Promise<FileJournalEntry>(async (resolve, reject) => {
            console.log("Deleting file " + filePath);
            var file = this.GetFile(filePath);
            if(file == null) return reject("File not found");
            var files : FileJournalEntry[] = [file.journalEntry].concat(file.parts);
            for(var f of files){
                this.files = this.files.filter(f => f.mid != file.journalEntry.mid);
                var message = await this.channel.messages.get(file.journalEntry.mid);
                if(message != null) message.delete();
            }
            resolve();
        });
    }

    public async CreateFile(filePath: string): Promise<Stream> {
        var that = this;
        return new Promise<Stream>((resolve, reject) => {
            var j = 0;
            resolve(split(8e+6, function (stream) {
                that.createFile(filePath + (j == 0 ? "" : ".part"+ j),stream);
                j++;
            }));
        });
    };

    private async createFile(filePath: string, content: Stream): Promise<FileJournalEntry> {
        return new Promise<FileJournalEntry>(async (resolve, reject) => {
            console.log("Adding file " + filePath);
            var directoryName = this.normalizePath(path.dirname(filePath));
            var fileName = path.basename(filePath);
            var directory = this.directories.find(d => d.name == directoryName);
            if (directory == null) directory = await this.CreateDirectory(directoryName);
            if(this.files.find(f => f.directory == directory.id && f.name == fileName)){
                await this.DeleteFile(filePath);
            }
            var entry: FileJournalEntry = new FileJournalEntry();
            entry.directory = directory.id;
            entry.name = fileName;
            this.channel.send(JSON.stringify(entry), {
                files: [new Discord.Attachment(content, fileName)]
            }).then((message: Discord.Message) => { 
                var attachment = message.attachments.first();
                entry.size = attachment.filesize;
                entry.url = attachment.url;
                entry.mid = message.id;
                this.files.push(entry);
                return resolve(entry);
            }).catch(reject);
        });
    }

    public async CreateDirectory(directoryName: string): Promise<DirectoryJournalEntry> {
        return new Promise<DirectoryJournalEntry>((resolve, reject) => {
            directoryName = this.normalizePath(directoryName);
            var existingDirectory = this.directories.find(d => d.name == directoryName);
            if(existingDirectory != null){
                console.log("Not recreating directory because it already exists " + directoryName);
                return resolve(existingDirectory);
            }
            console.log("Creating directory " + directoryName);
            var entry = new DirectoryJournalEntry();
            entry.id = uuidv4();
            entry.name = directoryName;
            this.channel.send(JSON.stringify(entry)).then((message: Discord.Message) => {
                entry.mid = message.id;
                this.directories.push(entry);
                return resolve(entry);
            }).catch(reject);
        });
    }
    public DeleteDirectory(directoryName: string) {
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
                    reject("Journal entry not found (async?)");
            }
            else
                reject("Directory not found in journal");
        });
    }
}
