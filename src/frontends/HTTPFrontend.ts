
import * as express from "express";
import * as mime from "mime-types";
import * as busboy from "connect-busboy";
import * as path from "path";
import * as fs from "fs";
import IFrontend from "./IFrontend";
import IJournal from "../backend/IJournal";
import * as stream from "stream";

export default class HTTPFrontend implements IFrontend{
    private app: express.Express;
    private journal: IJournal;
    constructor(private port: number){
        this.app = express();
        this.app.use(busboy({
            highWaterMark: 26214400
        }));
    }

    public async start(journal: IJournal) {
        this.journal = journal;
        this.registerRoutes();
        await this.app.listen(this.port);
    }

    private upload(root: string, fileName: string, file: stream.Stream, res: any){
        this.journal.createFile(path.join(root, fileName)).then((stream: stream.Writable) => {
            stream.on('close', () => {
                setTimeout(() => {
                    res.redirect("/");
                },1000)
            });
            file.pipe(stream);
        });
    }

    private registerRoutes(){
        this.app.post(/^.*$/,(req : any, res: any)=>{
            let root: string = null;
            let file: stream.Stream = null;
            let fileName: string = null;
        
            req.busboy.on('field', (fn: string, r: string) => {
                if(fn == "path") {
                    root = r;
                    if(fileName != null && file != null) this.upload(root,fileName, file, res);
                }
            });
        
            req.busboy.on('file', (_ : any, f: stream.Stream, fd: any) => {
                fileName = fd.filename;
                file = f;
                if(root != null) this.upload(root,fileName, file, res);
            });
            req.pipe(req.busboy);
        })
        
        this.app.get(/^.*$/,async (req: any,res : any)=>{
            let filePath = decodeURI(req.originalUrl);
            let file = await this.journal.getFile(filePath);
        
            if(file == null){
                let directory = await this.journal.getDirectory(filePath);
                if(directory != null){
                    res.header("Content-Type", "text/html");
                    let files = (await this.journal.getFiles(directory.name)).map(i => <any>{ type:"file", name: i});
                    let directories = (await this.journal.getChildDirectories(directory.name)).map(i => <any>{ type:"directory", name: i});
                    let template = fs.readFileSync(path.join(__dirname,'index.html'),"utf-8");
                    template = template.replace("{CONTENT}",JSON.stringify(files.concat(directories)));
                    template = template.replace("{NAME}",directory.name);
        
                    res.send(template);
                }else return res.send(404);
            }
            else{
                let stream = await this.journal.download(file);
                if(stream == null) res.send(500);
                res.header("Content-Type", mime.lookup(filePath));
                stream.pipe(res);
                stream.on("close",() =>{
                    res.end();
                });
            }
        });
        
    }

}
