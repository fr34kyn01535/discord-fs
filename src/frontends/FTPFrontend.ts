import * as ftpd from "simple-ftpd";
import Journal from "../Journal";
import { Stream } from "stream";
import * as Mode from "stat-mode";

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

export default class FTPFrontend{
    private instance;
    private journal: Journal;
    private host: string;
    private port: number;
    private externalHost: string;
    constructor(journal: Journal, host : string, port: number, externalHost : string){
        this.journal = journal;
        this.host = host;
        this.port = port;
        this.externalHost = externalHost;
    }

    public async Listen(){
        this.instance = ftpd({ host: this.host, port: this.port, externalHost: this.externalHost, root: '/' }, (session) => {
        
            session.on('pass', (username, password, cb) => {
                session.readOnly = false
                cb(null, 'Welcome guest') 
            })  
        
            session.on('stat', this.stat.bind(this));
            session.on('readdir', this.readdir.bind(this));
            session.on('read', this.download.bind(this));
            session.on('write', this.upload.bind(this));
        
            session.on('mkdir', this.mkdir.bind(this));
            session.on('unlink', this.unlink.bind(this));
            session.on('remove', this.rmdir.bind(this));
            /*
                session.on('rename', console.log)
            */
        });
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
            this.journal.Download(file).then((stream)=>{
                cb(null,stream);
            }).catch((err)=>{
                cb(err);
            });
        }else cb("File not found");
    }
}