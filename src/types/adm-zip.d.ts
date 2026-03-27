declare module 'adm-zip' {
  class AdmZip {
    constructor(input?: string | Buffer)
    addLocalFolder(path: string, zipPath?: string): void
    writeZip(targetPath: string): void
    extractAllTo(targetPath: string, overwrite?: boolean): void
  }

  export = AdmZip
}
