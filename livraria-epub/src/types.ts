export interface BookMetadata {
  id: string; // Hash or path of the file
  title: string;
  author: string;
  synopsis?: string;
  genre?: string;
  pageCount?: number;
  publicationDate?: string;
  publisher?: string;
  rating?: number; // 1-5
  ratingCount?: number;
  youtubeVideoId?: string;
  coverData?: string; // Base64 Data URL or Blob URL
  coverUrl?: string; // Remote URL
  fileName: string;
  filePath: string;
  lastEnriched?: number;
  importedAt: number;
  inTrash?: boolean;
  isbn?: string;
}

export interface FolderHandle {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
}
