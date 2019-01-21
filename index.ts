import * as Discord from "discord.js";
import FileChannel from "./src/FileChannel";
import * as ftpd from "simple-ftpd";

var bot = new Discord.Client();

var fileChannel = new FileChannel(bot,process.env.GUILD,process.env.CHANNEL);
 

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

