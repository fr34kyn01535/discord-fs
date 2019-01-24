# discord-fs

discord-fs is a Discord bot that allows creating a virtual file system accesible via FTP, backed by text-messages for journaling and attachments for storage. The maximum file size limit is 8mb. There is no limit in the amount of files in theory.

## Installation

```bash
git clone https://github.com/fr34kyn01535/discord-fs.git
npm install
```

## Usage

```python
export GUILD=536667092276215811 #The guild snowflake
export CHANNEL=536667818452582411 #The channel snowflake
export TOKEN=_6qrZcUqja7812RVdnEKjpzOL4CvHBFG6qrZcUqja7812RVdnEKjpzOL4CvHBFG #Your discord bot api token

export LISTEN_IP=127.0.0.1 #IP the FTP server will listen on
export EXTERNAL_IP=127.0.0.1 #IP reported to passive FTP connections
export PORT=33333 #Port the FTP server will listen on

npm start
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
