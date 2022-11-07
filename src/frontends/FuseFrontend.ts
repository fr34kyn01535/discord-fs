import * as sm from "stat-mode";
import IFrontend from "./IFrontend";
import IJournal from "../backend/IJournal";
let fuse = require('fuse-bindings')

class FileAttributes{
    constructor(){
        this.size = 1;
        this.mtime = Date.now();
        this.atime = Date.now();
        this.ctime = Date.now();
        this.uid= 0;
        this.gid= 0;
        let mode = new sm.Mode(this);
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
    public atime:number;
    public ctime:number;
    public mode:number; 
    public size:number;
    public uid:number;
    public gid:number;
}

export default class FuseFrontend implements IFrontend{
    private journal: IJournal
    constructor(private mountPath : string){
        
    }

    public start(journal: IJournal){
        this.journal = journal;
        fuse.mount(this.mountPath, {
            readdir: this.readdir.bind(this),
            getattr: this.getattr.bind(this),
            open: function (path: any, flags: any, cb: any) { cb(0, 42)  },
            read: this.download.bind(this)
        }, function (err: string) {
            if (err) throw err
            console.log('Loaded FuseFrontend on ' + this.mountPath)
        })

        process.on("SIGINT", function () {
            fuse.unmount(this.mountPath, function (err: string) {
                if (err) {
                    console.log('Filesystem at ' + this.mountPath + ' not unmounted', err)
                } else {
                    console.log('Filesystem at ' + this.mountPath + ' unmounted')
                }
            })
            
            process.exit();
        });
    }

    private async readdir(pathName: string, cb : (err:number, files:Array<string>) => void){
        let files = await this.journal.getFiles(pathName);
        let directories = await this.journal.getChildDirectories(pathName);
        cb(0,files.concat(directories));
    }

    private async getattr(pathName: string, cb : (err:number, attributes:FileAttributes) => void){
        let directoryEntry = await this.journal.getDirectory(pathName);
        let attributes = new FileAttributes(); 
        let mode = new sm.Mode(attributes);

        if(directoryEntry != null){
            mode.isDirectory(true);
            attributes.size = 0;
        }else{
            let file = await this.journal.getFile(pathName);
            if(file == null){
                return cb(fuse.ENOENT,null);
            }else{
                attributes.size = file.size;
                attributes.mtime = <number><any>file.journalEntry.changed;
                attributes.ctime = <number><any>file.journalEntry.created;
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
        cb(0,attributes);
    }

    public async download(pathName:string ,fd: number,buffer: Buffer, length:number,position: number,cb :(err: number ) => void){
        //Todo: the os will fetch the first ~4096 bytes to look for a known header, we should cache  either the header or the first 8mb of any file to make this a fast process

        let file = await this.journal.getFile(pathName);
        if(file != null){
            console.log(pathName, arguments);
            try{
                let stream = await this.journal.download(file);
                stream.on('data', (data)=> {
                    console.log(data);
                    buffer.write(data);
                });
                stream.on('end', function(){
                    cb(0);
                });
            }catch{
                cb(1);
            }

        }else cb(fuse.ENOENT);
    }
    
}