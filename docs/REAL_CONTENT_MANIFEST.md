# Real Content Manifest: Development & Testing Audio

This document records the provenance, legal metadata, and audio specifications for development and integration testing audio assets utilized in **Bolti Kitab (بولتی کتاب)**.

---

## Work Metadata

| Field | Detail |
| :--- | :--- |
| **Title** | The Art of War |
| **Urdu Display Title** | فنِ حرب *(Optional localized catalog display title)* |
| **Author** | Sun Tzu (Ancient Chinese military treatise, ~5th Century BCE) |
| **Translator** | Lionel Giles (1875–1958) |
| **Translation Publication Date** | 1910 |
| **Audio Reader / Narrator** | Bob Neufeld |
| **Language** | English (`en`) |
| **LibriVox Project** | [The Art of War (Version 4)](https://librivox.org/the-art-of-war-version-4-by-sun-tzu/) (Catalog ID: 8650) |
| **Internet Archive Identifier** | [artofwar_1402_librivox](https://archive.org/details/artofwar_1402_librivox) |
| **Project Gutenberg Source Text** | [eBook #17405](https://www.gutenberg.org/ebooks/17405) |

---

## Rights & Jurisdictional Legal Assessment

> [!IMPORTANT]
> Bolti Kitab explicitly records the legal status by jurisdiction and **does not** claim blanket "worldwide public domain" status.

1. **Original Text**:
   - The ancient treatise attributed to Sun Tzu is centuries old and in the public domain in all jurisdictions.
2. **Lionel Giles Translation (1910)**:
   - **United States**: Published prior to 1929; confirmed in the Public Domain under US copyright law by Project Gutenberg.
   - **Pakistan**: Under the Copyright Ordinance, 1962 (Section 18), the copyright term for published literary works extends for 50 years following the end of the calendar year of the author's death. Lionel Giles died in 1958 (term expired December 31, 2008). The translation is thus in the public domain in Pakistan.
3. **Audio Recording (LibriVox)**:
   - LibriVox recordings are dedicated into the public domain (CC0 / Public Domain dedication) by volunteer readers in the United States.
   - LibriVox explicitly reminds users outside the US that copyright laws vary by country; our jurisdictional analysis above establishes the translation and recording availability.

---

## Chapter Ingestion Specifications

### Chapter 1: Part 1 — Laying Plans & Waging War

- **Original Direct Audio URL**: `https://www.archive.org/download/artofwar_1402_librivox/artofwar_01_suntzu_64kb.mp3`
- **Format**: MP3 (MPEG Audio Layer 3)
- **Container / Codec**: `mp3`
- **Sample Rate**: 44,100 Hz
- **Channels**: 1 (Mono) / 2 (Stereo)
- **Bitrate**: 64 kbps CBR / 128 kbps
- **Local Cache Path**: `.content_cache/artofwar_01_suntzu_64kb.mp3`
- **Target Storage Blob Key**: `audiobooks/<book_id>/chapters/<chapter_id>/chapter_01.mp3`
- **Audio Verification Rule**: Inspected via `ffprobe` on server before confirming take and associating with chapter.
