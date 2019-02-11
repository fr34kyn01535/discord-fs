
import * as express from "express";
import * as mime from "mime-types";
import * as busboy from "connect-busboy";
import * as path from "path";
import * as fs from "fs";
import Journal from "../Journal";

export default class HTTPFrontend{
    private app;
    private journal;
    private port;

    constructor(journal: Journal, port: number){
        this.journal = journal;
        this.port = port;
        this.app = express();
        this.app.use(busboy({
            highWaterMark: 8e+6
        }));
        this.registerRoutes(this.app, this.journal);
    }

    public async Listen() : Promise<HTTPFrontend> {
        var that = this; 
        return new Promise<HTTPFrontend>((resolve, reject) => {
            try{
                this.app.listen(this.port, function () { resolve(that); }); 
            }catch(e){
                reject(e);
            }
        })
    }

    private registerRoutes(app, journal){
        app.post(/^.*$/,(req,res)=>{
            if(!journal) return res.send(500);
            
            var root = null;
            var file = null;
            var fileName = null;
        
            function upload(){
                journal.CreateFile(path.join(root, fileName)).then(stream => {
                    stream.on('close', () => {
                        res.send(200).end();
                    });
                    file.pipe(stream);
                });
            }
        
            (<any>req).busboy.on('field', function(fieldname, p) {
                if(fieldname == "path") {
                    root = p;
                    if(fileName != null && file != null) upload();
                }
            });
        
            (<any>req).busboy.on('file', (fieldname, f, fn) => {
                fileName = fn;
                file = f;
                if(root != null) upload();
            });
            req.pipe((<any>req).busboy);
        })
        
        app.get(/^.*$/,async (req,res)=>{
            if(journal == null) return res.send(500);
        
            var filePath = decodeURI(req.originalUrl);
            var file = journal.GetFile(filePath);
        
            if(file == null){
                var directory = journal.GetDirectory(filePath);
                if(directory != null){
                    res.header("Content-Type", "text/html");
                    var files = journal.GetFiles(directory.name).map(i => <any>{ type:"file", name: i});
                    var directories = journal.GetChildDirectories(directory.name).map(i => <any>{ type:"directory", name: i});
                    var template = fs.readFileSync(path.join(__dirname,'index.html'),"UTF-8");
                    template = template.replace("{CONTENT}",JSON.stringify(files.concat(directories)));
                    template = template.replace("{NAME}",directory.name);
        
                    res.send(template);
                }else return res.send(404);
            }
            else{
                var stream = await journal.Download(file);
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
