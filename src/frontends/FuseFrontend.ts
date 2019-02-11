import Journal from "../Journal";
import * as Mode from "stat-mode";
var fuse = require('fuse-bindings')


class FileAttributes{
    constructor(){
        this.size = 1;
        this.mtime = Date.now();
        this.atime = Date.now();
        this.ctime = Date.now();
        this.uid= 0;
        this.gid= 0;
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
    public atime:number;
    public ctime:number;
    public mode:number; 
    public size:number;
    public uid:number;
    public gid:number;
}

export default class FuseFrontend{
    private journal : Journal;
    constructor(journal: Journal){
        this.journal = journal;
    }

    private readdir(pathName: string, cb : (err:number, files:Array<string>) => void){
        var files = this.journal.GetFiles(pathName);
        var directories = this.journal.GetChildDirectories(pathName);
        cb(0,files.concat(directories));
    }

    private getattr(pathName: string, cb : (err:number, attributes:FileAttributes) => void){
        var directoryEntry = this.journal.GetDirectory(pathName);
        var attributes = new FileAttributes(); 
        var mode = new Mode(attributes);

        if(directoryEntry != null){
            mode.isDirectory(true);
            attributes.size = 0;
        }else{
            var file = this.journal.GetFile(pathName);
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

        var file = this.journal.GetFile(pathName);
        if(file != null){
            console.log(pathName, arguments);
            this.journal.Download(file).then((stream)=>{
                stream.on('data', (data)=> {
                    console.log(data);
                    buffer.write(data);
                });
                stream.on('end', function(){
                    cb(0);
                });
            }).catch((err)=>{
                cb(1);
            });
        }else cb(fuse.ENOENT);
    }

    public Mount(mountPath : string){

        fuse.mount(mountPath, {
            readdir: this.readdir.bind(this),
            getattr: this.getattr.bind(this),
            open: function (path, flags, cb) { cb(0, 42)  },
            read: this.download.bind(this)
        }, function (err) {
            if (err) throw err
            console.log('Loaded FuseFrontend on ' + mountPath)
        })

        process.on("SIGINT", function () {
            fuse.unmount(mountPath, function (err) {
                if (err) {
                    console.log('Filesystem at ' + mountPath + ' not unmounted', err)
                } else {
                    console.log('Filesystem at ' + mountPath + ' unmounted')
                }
            })
            
            process.exit();
        });
    }
    
}