import * as Discord from "discord.js";
import FileChannel from "./src/FileChannel";
import * as ftpd from "simple-ftpd";

var bot = new Discord.Client();

var fileChannel = new FileChannel(bot,'536667092276215811', '536667818452582411');


bot.login('NTM2NjY3MTYzMTQzMTc2MjE5.DyaBww.Bo2lTmXh0l90JKiRgfV0baEJI2w');


ftpd({ host: '0.0.0.0', port: 1337, root: '/' }, (session) => {

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

