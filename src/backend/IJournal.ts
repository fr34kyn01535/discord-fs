import * as stream from "stream";
import { DirectoryJournalEntry } from "./DirectoryJournalEntry";
import { JournalFile } from "./JournalFile";

export default interface IJournal{
    getDirectory(directoryName: string) : Promise<DirectoryJournalEntry>
    getFile(pathName: string): Promise<JournalFile>
    download(file: JournalFile) : Promise<stream.Readable>
    getFile(filePath: string) : Promise<JournalFile>
    getFiles(directoryName: string, ignorePartFiles?: boolean) : Promise<Array<string>>
    deleteFile(filePath: string): Promise<void>
    deleteDirectory(pathName: string) : Promise<void>
    createFile(filePath: string): Promise<stream.Writable>
    createDirectory(directoryName: string): Promise<DirectoryJournalEntry>
    getChildDirectories(directoryName: string) : Promise<Array<string>>
}