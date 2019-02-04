import * as Discord from "discord.js";
import FileChannel from "./src/FileChannel";
import * as ftpd from "simple-ftpd";
import * as express from "express";
import * as mime from "mime-types";
import * as busboy from "connect-busboy";
import * as path from "path";

var app = express();
var bot = new Discord.Client();
var fileChannel = new FileChannel(bot,process.env.GUILD,process.env.CHANNEL);

app.use(busboy({
    highWaterMark: 8e+6
}));

app.get("/",(req,res) => {
    res.sendFile('index.html', { root: __dirname });
});

app.post(/^.*$/,(req,res)=>{
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
    var path = req.originalUrl;
    var file = fileChannel.journal.GetFile(path);
    if(file == null) return res.send(404);
    var stream = await file.Download();
    if(stream == null) res.send(500);
    res.header("Content-Type", mime.lookup(path));
    res.header("Content-Length", file.size.toString());
    stream.pipe(res);
    stream.on("close",() =>{
        res.end();
    })
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

