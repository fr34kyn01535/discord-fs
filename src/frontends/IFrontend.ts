import IJournal from "../backend/IJournal";

export default interface IFrontend{
    start(journal: IJournal): void;
}