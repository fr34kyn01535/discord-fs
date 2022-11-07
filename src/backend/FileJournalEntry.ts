import { BaseJournalEntry, JOURNAL_ENTRY_TYPE } from "./BaseJournalEntry";


export class FileJournalEntry extends BaseJournalEntry {
    public readonly type: JOURNAL_ENTRY_TYPE = JOURNAL_ENTRY_TYPE.FILE;
    public directory: any;
    public url: string;
    public iv: string;
    public size: number;
}
