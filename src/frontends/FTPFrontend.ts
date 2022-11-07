const ftpd: any = require("simple-ftpd");
import { Stream } from "stream";
import * as sm from "stat-mode";
import IFrontend from "./IFrontend";
import IJournal from "../backend/IJournal";

class VirtualStats{
    constructor(){
        this.size = 1;
        this.mtime = Date.now();
        this.uname= 'Discord';
        this.gname= 'Tester';
        this.mode = 0;
    }
    public mtime:number;
    public mode:number; 
    public size:number;
    public uname:string;
    public gname:string;
}

export default class FTPFrontend implements IFrontend{
    private instance: any;
    private journal: IJournal
    
    constructor(private host : string, private port: number, private externalHost : string){
        
    }

    public async start(journal : IJournal){
        this.journal = journal;
        this.instance = ftpd({ host: this.host, port: this.port, externalHost: this.externalHost, root: '/' }, (session: any) => {
        
            session.on('pass', (username: string, password: string, cb : (_:string, header: string)=>{} ) => {
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

    
    public async stat(pathName:string ,cb :(err?: string,stats?: VirtualStats) => void){
        let directoryEntry = await this.journal.getDirectory(pathName);
        let stat = new VirtualStats(); 
        stat.uname= 'Discord';
        stat.gname= 'Tester';
        let mode = new sm.Mode(stat);

        if(directoryEntry != null){
            mode.isDirectory(true);
        }else{
            let file = await this.journal.getFile(pathName);
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

    public async readdir(pathName:string ,cb :(err?: string,files?: Array<string>) => void){
        let files = await this.journal.getFiles(pathName);
        let directories = await this.journal.getChildDirectories(pathName);
        cb(null,files.concat(directories));
    }

    public async mkdir(pathName:string ,cb :(err?: string) => void){
        await this.journal.createDirectory(pathName);
        cb();
    }

    public async unlink(pathName:string ,cb :(err?: string) => void){
        let file = await this.journal.getFile(pathName);
        if(file == null) {
            return cb("File not found");
        }
        else
            await this.journal.deleteFile(pathName).then(() => cb()).catch((err) => cb(err));
    }

    public async rmdir(pathName:string ,cb :(err?: string) => void){
        let directory = this.journal.getDirectory(pathName);
        if(directory == null) return cb("Directory not found");
        else
            await this.journal.deleteDirectory(pathName).then(() => cb());
    }

    public async upload(pathName:string , offset: any, cb :(err?: string,stream?: Stream ) => void){
        await this.journal.createFile(pathName).then((stream)=>{
            cb(null,stream);
        });
    } 
    
    public async download(pathName:string ,offset: any,cb :(err?: string,stream?: Stream ) => void){
        let file = await this.journal.getFile(pathName);
        if(file != null){
            try{
                let stream: Stream = await this.journal.download(file);
                cb(null,stream);
            }catch(err){
                cb(err);
            }
        }else cb("File not found");
    }
}