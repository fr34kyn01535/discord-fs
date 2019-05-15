# discord-fs

discord-fs is a Discord bot that allows creating a virtual file system accesible via FTP, backed by text-messages for journaling and attachments for storage. The maximum file size limit is 8mb. For bigger files i've implemented multi-part up & download. There is no limit in the amount of files in theory. 

## Features
* Theoretically unlimited file size thanks to splitting the file in 8mb chunks (discord is quite unreliable when it comes to uploading 20 files in a row without any issues)
* FTP frontend
* HTTP frontend (up & downloading)
* (Incomplete) fuse frontend
* optional AES-256-CBC encryption (with per file iv, unreadable journal)

## Installation

```bash
git clone https://github.com/fr34kyn01535/discord-fs.git
npm install
```

## Usage

```bash
export GUILD=536667092276215811 #The guild snowflake
export CHANNEL=536667818452582411 #The channel snowflake
export TOKEN=_6qrZcUqja7812RVdnEKjpzOL4CvHB123qrZcUqja7812RVdnEKjpzOL4CvHBFG #Your discord bot api token
export AES_KEY=BAM~NOBODY~GUESSES_this_:D #Don't set this to disable encryption

export LISTEN_IP=127.0.0.1 #IP the FTP server will listen on
export EXTERNAL_IP=127.0.0.1 #IP reported to passive FTP connections (Set it to your external ip)
export PORT=33333 #Port the FTP server will listen on

export HTTP_PORT=1338#Port the web frontend will listen on
npm start
```

## Contributing
At this point discord-fs is pretty mutch just a POC.
Pull requests are welcome. 

## License
[MIT](https://choosealicense.com/licenses/mit/)
