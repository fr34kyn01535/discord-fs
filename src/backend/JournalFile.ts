import { DirectoryJournalEntry } from "./DirectoryJournalEntry";
import { FileJournalEntry } from "./FileJournalEntry";


export class JournalFile {
    public journalEntry: FileJournalEntry;
    public directory: DirectoryJournalEntry;
    public parts: FileJournalEntry[];
    get size(): number {
        return this.journalEntry.size + this.parts.map(a => a.size).reduce((a, b) => a + b, 0);
    }
}
