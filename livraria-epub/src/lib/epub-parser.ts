import JSZip from "jszip";
import { BookMetadata } from "../types";

export async function parseEpubMetadata(file: File): Promise<Partial<BookMetadata>> {
  const isEpub = file.name.toLowerCase().endsWith(".epub");
  
  if (!isEpub) {
    return {
      title: file.name.replace(/\.(epub|pdf|mobi)$/i, ""),
      author: "Desconhecido",
      fileName: file.name,
    };
  }

  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // 1. Find container.xml to get the path of the OPF file
  const containerXml = await loadedZip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) {
    throw new Error("Invalid EPUB: Missing META-INF/container.xml");
  }

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "text/xml");
  const opfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");

  if (!opfPath) {
    throw new Error("Invalid EPUB: Could not find OPF file path");
  }

  // 2. Parse OPF file for metadata
  const opfXml = await loadedZip.file(opfPath)?.async("string");
  if (!opfXml) {
    throw new Error("Invalid EPUB: Could not find OPF file content");
  }

  const opfDoc = parser.parseFromString(opfXml, "text/xml");
  
  // Robust metadata extraction using localName to bypass namespace issues
  const getDcValue = (name: string) => {
    let el = Array.from(opfDoc.getElementsByTagName("*")).find(e => e.localName === name);
    if (!el) {
       el = opfDoc.getElementsByTagName(name)[0];
    }
    return el?.textContent || undefined;
  };

  const getMetaValue = (name: string) => {
    const metas = Array.from(opfDoc.getElementsByTagName("meta"));
    const meta = metas.find(m => m.getAttribute("name") === name || m.getAttribute("property") === name);
    return meta?.getAttribute("content") || undefined;
  };

  const internalTitle = getDcValue("title");
  const internalCreator = getDcValue("creator");
  const calibreTitle = getMetaValue("calibre:title");
  const calibreAuthor = getMetaValue("calibre:author_link_map");
  
  const fileNameTitle = file.name.replace(/\.(epub|pdf|mobi|azw3)$/i, "");
  
  const title = calibreTitle || internalTitle || fileNameTitle;
  const author = internalCreator || "Desconhecido";
  const publisher = getDcValue("publisher") || getMetaValue("publisher") || undefined;
  const date = getDcValue("date") || getMetaValue("publication_date") || undefined;
  const synopsis = getDcValue("description") || undefined;
  
  // Try to extract ISBN from various sources
  const identifiers = Array.from(opfDoc.getElementsByTagName("*")).filter(e => e.localName === "identifier");
  let isbn: string | undefined = undefined;
  for (const id of identifiers) {
    const text = (id.textContent || "").toUpperCase();
    
    // Check for ISBN scheme
    if (id.getAttribute("opf:scheme") === "ISBN" || id.getAttribute("scheme") === "ISBN" || text.includes("ISBN")) {
      const clean = text.replace(/[^0-9X]/gi, "");
      if (clean.length === 10 || clean.length === 13) {
        isbn = clean;
        break;
      }
    }
  }

  // Fallback pattern match for ISBN if not found via scheme
  if (!isbn) {
    for (const id of identifiers) {
      const clean = (id.textContent || "").replace(/[^0-9X]/gi, "");
      if (clean.length === 10 || clean.length === 13) {
        isbn = clean;
        break;
      }
    }
  }

  // 3. Try to find cover image
  let coverData: string | undefined = undefined;
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/")) || "";

  // The cover is often defined by a meta tag with name="cover" pointing to an item ID
  const items = Array.from(opfDoc.getElementsByTagName("item"));
  const metas = Array.from(opfDoc.getElementsByTagName("meta"));
  const references = Array.from(opfDoc.getElementsByTagName("reference"));
  
  const coverMeta = metas.find(m => m.getAttribute("name") === "cover");
  const coverId = coverMeta?.getAttribute("content");
  
  // Strategy 1: Check meta tag and manifest
  let coverItem = items.find(item => 
    (coverId && item.getAttribute("id") === coverId) ||
    item.getAttribute("properties")?.includes("cover-image")
  );

  // Strategy 2: Check guide references
  if (!coverItem) {
    const coverRef = references.find(ref => ref.getAttribute("type") === "cover");
    if (coverRef) {
      const href = coverRef.getAttribute("href");
      coverItem = items.find(item => item.getAttribute("href") === href);
    }
  }

  // Strategy 3: Heuristic search in manifest (id or href containing 'cover')
  if (!coverItem) {
    coverItem = items.find(item => 
      item.getAttribute("id")?.toLowerCase().includes("cover") || 
      item.getAttribute("href")?.toLowerCase().includes("cover")
    );
  }

  // Strategy 4: First image in manifest if it's large enough (simple heuristic)
  if (!coverItem) {
    coverItem = items.find(item => 
      item.getAttribute("media-type")?.startsWith("image/") &&
      !item.getAttribute("href")?.includes("thumb")
    );
  }

  if (coverItem) {
    const coverPath = coverItem.getAttribute("href");
    if (coverPath) {
      const fullCoverPath = normalizePath(opfDir, coverPath);
      const coverFile = loadedZip.file(fullCoverPath);
      if (coverFile) {
        const coverBlob = await coverFile.async("blob");
        coverData = await blobToBase64(coverBlob);
      }
    }
  }

  return {
    title,
    author,
    publisher,
    publicationDate: date,
    synopsis: synopsis ? synopsis.replace(/<[^>]*>?/gm, "").trim() : undefined,
    coverData,
    fileName: file.name,
    isbn,
  };
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function normalizePath(base: string, relative: string): string {
  if (relative.startsWith("/")) return relative.substring(1);
  if (!base) return relative;
  
  const pathParts = base.split("/");
  const relParts = relative.split("/");
  
  for (const part of relParts) {
    if (part === "..") {
      pathParts.pop();
    } else if (part !== ".") {
      pathParts.push(part);
    }
  }
  
  return pathParts.join("/").replace(/^\//, "");
}
