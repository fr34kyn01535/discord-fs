import * as Discord from "discord.js";
import FileChannel from "./src/FileChannel";
import * as ftpd from "simple-ftpd";
import * as express from "express";
import * as mime from "mime-types";
import * as busboy from "connect-busboy";
import * as path from "path";
import * as fs from "fs";

var app = express();
var bot = new Discord.Client();
var fileChannel = new FileChannel(bot,process.env.GUILD,process.env.CHANNEL);

app.use(busboy({
    highWaterMark: 8e+6
}));

app.post(/^.*$/,(req,res)=>{
    if(!fileChannel.journal || !fileChannel) return res.send(500);
    
    var root = null;//req.originalUrl;
    var file = null;
    var fileName = null;

    function upload(){
        fileChannel.journal.CreateFile(path.join(root, fileName)).then(stream => {
            stream.on('close', () => {
                res.send(200);
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
    if(fileChannel == null || fileChannel.journal == null) return res.send(500);

    var filePath = decodeURI(req.originalUrl);
    var file = fileChannel.journal.GetFile(filePath);

    if(file == null){
        var directory = fileChannel.journal.GetDirectory(filePath);
        if(directory != null){
            res.header("Content-Type", "text/html");
            var files = fileChannel.journal.GetFiles(directory.name).map(i => <any>{ type:"file", name: i});
            var directories = fileChannel.journal.GetChildDirectories(directory.name).map(i => <any>{ type:"directory", name: i});
            var template = fs.readFileSync(path.join(__dirname,'index.html'),"UTF-8");
            template = template.replace("{CONTENT}",JSON.stringify(files.concat(directories)));
            template = template.replace("{NAME}",directory.name);

            res.send(template);
        }else return res.send(404);
    }
    else{
        var stream = await fileChannel.journal.Download(file);
        if(stream == null) res.send(500);
        res.header("Content-Type", mime.lookup(filePath));
        res.header("Content-Length", file.size.toString());
        stream.pipe(res);
        stream.on("close",() =>{
            res.end();
        })
    }
});

if(process.env.HTTP_PORT){
    app.listen(process.env.HTTP_PORT, function () {
        console.log('Webserver listening on port ' + process.env.HTTP_PORT);
    }); 
}

bot.login(process.env.TOKEN);


ftpd({ host: process.env.LISTEN_IP, port: process.env.PORT, externalHost: process.env.EXTERNAL_IP, root: '/' }, (session) => {

    session.on('pass', (username, password, cb) => {
        session.readOnly = false
        cb(null, 'Welcome guest') 
    })  
   
    session.on('stat', fileChannel.stat.bind(fileChannel));
    session.on('readdir',fileChannel.readdir.bind(fileChannel));
    session.on('read',fileChannel.download.bind(fileChannel));
    session.on('write', fileChannel.upload.bind(fileChannel));
 
    session.on('mkdir', fileChannel.mkdir.bind(fileChannel));
    session.on('unlink', fileChannel.unlink.bind(fileChannel));
    session.on('remove', fileChannel.rmdir.bind(fileChannel));
     /*
        session.on('rename', console.log)
    */
  })

