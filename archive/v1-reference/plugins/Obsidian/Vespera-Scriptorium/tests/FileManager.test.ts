import { describe, it, expect } from "vitest";
import { discoverVaultFilesFromVault, VaultFileMeta } from "../src/FileManager";

// Mock TFile and Vault types
class MockTFile {
  constructor(
    public path: string,
    public extension: string,
    public stat: { size: number }
  ) {}
}
class MockVault {
  private files: MockTFile[];
  constructor(files: MockTFile[]) {
    this.files = files;
  }
  getFiles() {
    return this.files;
  }
}

describe("FileManager.discoverVaultFilesFromVault", () => {
  it("finds only supported files and returns correct metadata", () => {
    const mockFiles = [
      new MockTFile("note1.md", "md", { size: 10 }),
      new MockTFile("readme.txt", "txt", { size: 20 }),
      new MockTFile("data.csv", "csv", { size: 30 }),
      new MockTFile("script.js", "js", { size: 40 }),
      new MockTFile("sub/story.html", "html", { size: 50 }),
      new MockTFile("sub/ignore.tmp", "tmp", { size: 60 }),
    ];
    const vault = new MockVault(mockFiles);
    const files: VaultFileMeta[] = discoverVaultFilesFromVault(vault as any);
    const fileNames = files.map(f => f.filePath).sort();
    expect(fileNames).toEqual([
      "data.csv",
      "note1.md",
      "readme.txt",
      "sub/story.html",
    ].sort());
    for (const file of files) {
      expect(["md", "txt", "html", "csv"]).toContain(file.extension);
      expect(typeof file.size).toBe("number");
      expect(file.size).toBeGreaterThan(0);
    }
  });
});
