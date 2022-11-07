export const enum JOURNAL_ENTRY_TYPE {
    FILE = 0,
    DIRECTORY = 1
}

export class BaseJournalEntry {
    public readonly type: JOURNAL_ENTRY_TYPE;
    public name: string;
    public mid: string;
    public changed: Date;
    public created: Date;
}
