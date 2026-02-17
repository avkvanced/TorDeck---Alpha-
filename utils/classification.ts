import { MediaCategory, TorBoxFile, ClassificationConfig } from '@/types/torbox';
import {
  AUDIO_EXTENSIONS,
  ALWAYS_AUDIOBOOK_EXTENSIONS,
  VIDEO_EXTENSIONS,
  EBOOK_EXTENSIONS,
  DOCUMENT_EXTENSIONS,
  ARCHIVE_EXTENSIONS,
  DEFAULT_CLASSIFICATION_CONFIG,
  GAMES_MIN_SIZE_GB,
} from '@/constants/categories';

export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

export function classifyFile(
  file: TorBoxFile,
  siblingFiles?: TorBoxFile[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  parentName?: string
): MediaCategory {
  const ext = getFileExtension(file.name);

  if (ALWAYS_AUDIOBOOK_EXTENSIONS.includes(ext)) {
    return 'audiobook';
  }

  if (VIDEO_EXTENSIONS.includes(ext)) {
    return 'video';
  }

  if (AUDIO_EXTENSIONS.includes(ext)) {
    return classifyAudioFile(file, siblingFiles, config, parentName);
  }

  if (EBOOK_EXTENSIONS.includes(ext)) {
    return 'ebook';
  }

  if (ext === 'pdf') {
    return classifyPdf(file);
  }

  if (DOCUMENT_EXTENSIONS.includes(ext)) {
    return 'other';
  }

  if (ARCHIVE_EXTENSIONS.includes(ext)) {
    const fileSizeGB = file.size / (1024 * 1024 * 1024);
    if ((ext === 'zip' || ext === 'rar') && fileSizeGB >= GAMES_MIN_SIZE_GB) {
      console.log('[Classification] Games by archive size:', file.name, fileSizeGB.toFixed(1), 'GB');
      return 'games';
    }
    return 'other';
  }

  if (DOCUMENT_EXTENSIONS.includes(ext)) {
    return 'other';
  }

  return 'other';
}

function classifyAudioFile(
  file: TorBoxFile,
  siblingFiles?: TorBoxFile[],
  config: ClassificationConfig = DEFAULT_CLASSIFICATION_CONFIG,
  parentName?: string
): MediaCategory {
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB >= config.audiobookMinFileSizeMB) {
    console.log('[Classification] Audiobook by file size:', file.name, fileSizeMB, 'MB');
    return 'audiobook';
  }

  const lowerName = (file.name + ' ' + (file.short_name || '')).toLowerCase();
  const lowerParent = (parentName || '').toLowerCase();
  const combinedText = lowerName + ' ' + lowerParent;

  for (const keyword of config.audiobookKeywords) {
    if (combinedText.includes(keyword)) {
      console.log('[Classification] Audiobook by keyword:', file.name, 'keyword:', keyword);
      return 'audiobook';
    }
  }

  const pathParts = file.name.toLowerCase().split(/[\/\\]/);
  for (const part of pathParts) {
    for (const keyword of config.audiobookKeywords) {
      if (part.includes(keyword)) {
        console.log('[Classification] Audiobook by path keyword:', file.name, 'keyword:', keyword);
        return 'audiobook';
      }
    }
  }

  if (siblingFiles && siblingFiles.length > 1) {
    const audioSiblings = siblingFiles.filter(f =>
      AUDIO_EXTENSIONS.includes(getFileExtension(f.name))
    );

    const hasM4bSibling = siblingFiles.some(f =>
      ALWAYS_AUDIOBOOK_EXTENSIONS.includes(getFileExtension(f.name))
    );
    if (hasM4bSibling) {
      console.log('[Classification] Audiobook by m4b sibling:', file.name);
      return 'audiobook';
    }

    if (audioSiblings.length > 1) {
      const totalSizeMB = audioSiblings.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);
      if (totalSizeMB >= config.audiobookMultiTrackMinSizeMB) {
        console.log('[Classification] Audiobook by multi-track size:', file.name, totalSizeMB, 'MB total');
        return 'audiobook';
      }

      if (audioSiblings.length >= 3) {
        const avgSizeMB = totalSizeMB / audioSiblings.length;
        if (avgSizeMB >= 10 && audioSiblings.length >= 5) {
          console.log('[Classification] Audiobook by chapter pattern:', file.name, audioSiblings.length, 'tracks, avg', avgSizeMB, 'MB');
          return 'audiobook';
        }
      }

      const chapterPattern = /ch(apter)?[\s._-]?\d|part[\s._-]?\d|track[\s._-]?\d|disc[\s._-]?\d/i;
      const hasChapterNames = audioSiblings.filter(f => chapterPattern.test(f.name)).length;
      if (hasChapterNames >= audioSiblings.length * 0.5) {
        console.log('[Classification] Audiobook by chapter naming:', file.name);
        return 'audiobook';
      }
    }
  }

  return 'music';
}

function classifyPdf(file: TorBoxFile): MediaCategory {
  const lowerName = file.name.toLowerCase();
  const ebookKeywords = ['book', 'novel', 'edition', 'author', 'isbn', 'epub', 'ebook'];
  for (const keyword of ebookKeywords) {
    if (lowerName.includes(keyword)) {
      return 'ebook';
    }
  }
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > 5) {
    return 'ebook';
  }
  return 'other';
}
