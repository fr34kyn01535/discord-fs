import * as uuidv4 from "uuid/v4";
import * as https from "https";
import * as path from "path";
import * as Discord from "discord.js";
import * as stream from "stream";

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
        var messages = await this.channel.fetchMessages({ limit: 100 });
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

    public async DownloadFile(filePath) : Promise<stream.Readable> {
        return new Promise<stream.Readable>((resolve, reject) => {
            var file = this.GetFile(filePath);
            if(file == null) return reject("File not found");
            https.get(file.url, (res) => { resolve(res); });
        });
    }

    public GetDirectory(directoryName) : DirectoryJournalEntry{
        directoryName = path.posix.normalize(directoryName);
        var directory = this.directories.find(d => d.name == directoryName);
        return directory;
    }

    public GetFile(filePath) : FileJournalEntry{
        var directoryName = path.posix.normalize(path.dirname(filePath));
        var fileName = path.basename(filePath);
        var directory = this.directories.find(d => d.name == directoryName);
        if(directory == null) return null;
        return  this.files.find(f => f.directory == directory.id && f.name == fileName);
    }

    public GetFiles(directoryName) : Array<string> {
        var directory = this.GetDirectory(directoryName);
        if(directory == null) return [];
        return this.files.filter(f => f.directory == directory.id).map(f => f.name);
    }

    public GetChildDirectories(directoryName) : Array<string> {
        directoryName = path.posix.normalize(directoryName);
        var children = [];
        this.directories.forEach((item) => {
            if(item.name != directoryName && item.name.startsWith(directoryName) && item.name.trim() != ""){
                var name = item.name;
                if(name.indexOf(directoryName) == 0) name = name.substring(directoryName.length);
                if(name.indexOf("\\") == 0) name = name.substring(1);
                if(!name.includes("\\")) children.push(name);
            }
        });
        return children;
    }

    public async DeleteFile(filePath: string){
        console.log("Deleting file " + filePath);
        var fileName = path.basename(filePath);
        var directory = this.GetDirectory(path.dirname(filePath));
        return new Promise<FileJournalEntry>((resolve, reject) => {
            if(directory == null) return reject("Directory doesnt exist");
            var file = this.files.find(f => f.directory == directory.id && f.name == fileName);
            if(file == null) return reject("File doesnt exist");
            this.files = this.files.filter(f => f.mid != file.mid);
            this.channel.messages.get(file.mid).delete().then(() => resolve()).catch(reject);
        });
    }

    public async CreateFile(filePath: string, content: any): Promise<FileJournalEntry> {
        console.log("Adding file " + filePath);
        var directoryName = path.posix.normalize(path.dirname(filePath));
        var fileName = path.basename(filePath);
        var directory = this.directories.find(d => d.name == directoryName);
        if (directory == null) directory = await this.CreateDirectory(directoryName);
        if(this.files.find(f => f.directory == directory.id && f.name == fileName)){
            await this.DeleteFile(filePath);
        }
        return new Promise<FileJournalEntry>((resolve, reject) => {
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
            directoryName = path.posix.normalize(directoryName);
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
        directoryName = path.posix.normalize(directoryName);
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
