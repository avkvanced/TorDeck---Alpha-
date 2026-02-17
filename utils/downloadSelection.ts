import { LibraryItem } from '@/types/torbox';

function getBaseName(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] ?? trimmed;
}

export function selectPrimaryDownloadFile(files: LibraryItem[], parentName?: string): LibraryItem | null {
  if (files.length === 0) return null;

  const normalizedParentName = parentName?.trim().toLowerCase();

  if (normalizedParentName) {
    const exactMatch = files.find((file) => {
      const shortName = file.fileName.trim().toLowerCase();
      const baseName = getBaseName(file.fileName).toLowerCase();
      return shortName === normalizedParentName || baseName === normalizedParentName;
    });
    if (exactMatch) return exactMatch;

    const suffixMatch = files.find((file) => file.fileName.trim().toLowerCase().endsWith(normalizedParentName));
    if (suffixMatch) return suffixMatch;
  }

  const sortedBySize = [...files].sort((a, b) => {
    if (b.fileSize === a.fileSize) {
      return a.fileName.localeCompare(b.fileName);
    }
    return b.fileSize - a.fileSize;
  });

  return sortedBySize[0] ?? files[0];
}
