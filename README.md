# discord-fs

discord-fs is a Discord bot that allows creating a virtual file system accesible via FTP, backed by text-messages for journaling and attachments for storage. The maximum file size limit is 8mb. For bigger files i've implemented multi-part up & download. There is no limit in the amount of files in theory. 

## Features
* Theoretically unlimited file size thanks to splitting the file in 8mb chunks (discord is quite unreliable when it comes to uploading 20 files in a row without any issues)
* FTP frontend
* HTTP frontend (up & downloading)
* (Incomplete) fuse frontend
* optional AES-256-CBC encryption (with per file iv, unreadable journal)

## Installation & Preparation

```bash
git clone https://github.com/fr34kyn01535/discord-fs.git
npm install
```
If you haven't already created a discord bot, follow the following steps:

### Create a Discord bot identity
1. Create a new application on https://discord.com/developers/applications
2. Select your new app, navigate to "Bot" in the sidebar, "Add Bot", copy its Token
3. Navigate to "OAuth2" in the sidebar, write down your "Client ID" 
4. Fill in http://localhost as Redirect above "Add Redirect" and save the form

### Invite the Discord bot to your guild
4. Complete the following url with your client id:
    https://discord.com/oauth2/authorize?response_type=code&client_id=<client id>&scope=bot
5. Navigate to the url and let the bot join your preferred guild

You can obtain your guild and channel snowflake (its id) by enabling developer mode on your Discord client  (User Settings > Advanced > Developer Mode)
and rightclicking both the guilds name or the specifc channel and choose "Copy ID" from the context menu.

## Usage
```bash
export GUILD=536667092276215811 #The guild snowflake
export CHANNEL=536667818452582411 #The channel snowflake
export TOKEN=_6qrZcUqja7812RVdnEKjpzOL4CvHB123qrZcUqja7812RVdnEKjpzOL4CvHBFG #Your discord bot api token
export AES_KEY=BAM~NOBODY~GUESSES_this_:D #If you don't want encrpytion, keep this empty, otherwise roll a new secret

export LISTEN_IP=127.0.0.1 #IP the FTP server will listen on
export EXTERNAL_IP=127.0.0.1 #IP reported to passive FTP connections (Set it to your external ip)
export FTP_PORT=33333 #Port the FTP server will listen on
export HTTP_PORT=1338 #Port the web frontend will listen on
npm start
```

HINT: there is also a partly working fuse frontend which i've disabled. You may wanna tinker with it, to enable, uncomment the lines in GuildStorageHandler.ts

## Contributing
At this point discord-fs is pretty mutch just a POC.
Pull requests are welcome. 

## License
[MIT](https://choosealicense.com/licenses/mit/)
