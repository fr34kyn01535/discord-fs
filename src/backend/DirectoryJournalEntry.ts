import { BaseJournalEntry, JOURNAL_ENTRY_TYPE } from "./BaseJournalEntry";

export class DirectoryJournalEntry extends BaseJournalEntry {
    public readonly type: JOURNAL_ENTRY_TYPE = JOURNAL_ENTRY_TYPE.DIRECTORY;
    public id: any;
}
