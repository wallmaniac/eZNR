'use client';
import { useState, useCallback, useRef, useEffect } from 'react';
import { PDFDocument } from 'pdf-lib';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAll, getRawAll, COLLECTIONS } from '@/lib/dataStore';
import { useDialog } from '@/hooks/useDialog';
import { useSortedList } from '@/hooks/useSortedList';
import { apiParsePdf } from '@/lib/converterAPI';

const FILE_ICONS = {
  pdf: '📕', doc: '📘', docx: '📘', xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙', jpg: '🖼️', jpeg: '🖼️', png: '🖼️',
};
const getExt = (name = '') => (name.split('.').pop() || '').toLowerCase();
const getIcon = (name = '') => FILE_ICONS[getExt(name)] || '📎';
const isWordExt = (ext) => ext === 'docx' || ext === 'doc';

// Convert data URI → Blob URL (Chrome blocks data: URIs for PDFs in iframes)
function dataUriToBlobUrl(dataUri) {
  const [header, base64] = dataUri.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

// Decode data URI base64 → ArrayBuffer
function dataUriToBuffer(dataUri) {
  const base64 = dataUri.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// Force white background HTML wrapper for Word docs
function makeHtml(title, body) {
  return `<!DOCTYPE html>
<html style="color-scheme:light;background:#fff">
<head><meta charset="utf-8"><title>${title}</title>
<style>
html,body{color-scheme:light!important;background:#fff!important;color:#222!important;
  font-family:Arial,Helvetica,sans-serif;max-width:820px;margin:0 auto;padding:32px 40px;line-height:1.6}
img{max-width:100%}table{border-collapse:collapse;width:100%;margin:16px 0}
td,th{border:1px solid #bbb;padding:6px 10px}h1,h2,h3,h4{color:#111}p{margin:0 0 10px}
</style></head><body>${body}</body></html>`;
}

async function convertDocxToBlob(arrayBuffer, title) {
  const mammoth = (await import('mammoth/mammoth.browser')).default;
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const body = result.value;
  const html = makeHtml(title, body);
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  return { blobUrl, body }; // Return BOTH for direct PDF use
}

// ─── MuPDF-powered PDF → DOCX ────────────────────────────────────────────────
// mupdf runs server-side (Node.js API route /api/pdf-parse)
// Actual mupdf JSON structure:
//   block: { type, bbox:{x,y,w,h}, lines:[{ font:{name,weight,style,size}, x, y, text, bbox }] }

function getLineText(line) {
  // Lines may have spans[] OR direct .text depending on mupdf version
  if (line.spans?.length) return line.spans.map(s => s.text || '').join('');
  return line.text || '';
}

function getBlockText(block) {
  return (block.lines || []).map(getLineText).join('\n');
}

function getLineFontInfo(line) {
  const font = line.font || {};
  const size = font.size || line.bbox?.h || 11;
  const bold = font.weight === 'bold' || (font.name || '').toLowerCase().includes('bold');
  const italic = font.style === 'italic' || (font.name || '').toLowerCase().includes('italic');
  return { size, bold, italic };
}

function getBlockFontInfo(block) {
  const lines = block.lines || [];
  if (!lines.length) return { size: 11, bold: false, italic: false };
  // Use the dominant font info from the first non-empty line
  for (const line of lines) {
    const text = getLineText(line);
    if (text.trim()) return getLineFontInfo(line);
  }
  return getLineFontInfo(lines[0]);
}

// bbox helper: mupdf returns {x, y, w, h}  (origin is top-left in screen coords)
function bboxCY(bbox) { return bbox.y + bbox.h / 2; }
function bboxX(bbox)  { return bbox.x; }
function bboxY(bbox)  { return bbox.y; }

async function buildDocxFromPages(pages) {
  const {
    Document: WDoc, Packer, Paragraph, TextRun,
    HeadingLevel, AlignmentType, Table, TableRow, TableCell,
    WidthType, BorderStyle,
  } = await import('docx');

  const NAVY = '1F3864';
  const DARK = '222222';
  const GRAY = '666666';

  const none  = () => ({ style: BorderStyle.NONE,   size: 0, color: 'FFFFFF' });
  const thin  = () => ({ style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' });

  // Detect section headings: Roman numerals or all-caps bold
  const isHeading = (text, bold, size, body) => {
    const t = text.trim();
    if (/^(I{1,3}|IV|V{1,3}I{0,3}|IX|X{1,3}I{0,3})\.\s+\p{Lu}/u.test(t)) return true;
    if (t.length > 3 && t === t.toUpperCase() && (bold || size >= body)) return true;
    return false;
  };

  // Is text a solo checkbox symbol?
  const CB_RE = /^[✓✔☑☒☐□]$/;

  const allChildren = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const { blocks = [], pageWidth = 595, widgets = [] } = pages[pi];
    const pageCenterX = pageWidth / 2;

    // Build a fast lookup: is there a checked widget near (x, y)?
    const isWidgetChecked = (x, y) => {
      for (const w of widgets) {
        const r = Array.isArray(w.rect) ? w.rect : [0,0,0,0];
        // Expand hit-box by 10pt for tolerance
        if (x >= r[0] - 10 && x <= r[2] + 10 && y >= r[1] - 10 && y <= r[3] + 10) {
          return w.checked;
        }
      }
      return null; // no widget found near this position
    };

    // ── Gemini fallback: plain text per page (no MuPDF block data) ──────────
    // Gemini returns { pageNum, text } — no blocks/font metadata.
    // Build a simple but clean DOCX from the raw text lines.
    if (!blocks.length && pages[pi].text) {
      const rawLines = (pages[pi].text || '').split('\n');
      for (const rawLine of rawLines) {
        const text = rawLine.trim();
        if (!text) { allChildren.push(new Paragraph({ children: [], spacing: { after: 40 } })); continue; }
        // Heuristic heading detection: ALL-CAPS, Roman numeral sections, or short bold-looking lines
        const looksLikeHeading =
          (text.length <= 80 && text === text.toUpperCase() && /[A-ZČĆŽŠĐ]/.test(text)) ||
          /^(I{1,3}|IV|V{1,3}I{0,3}|IX|X{1,3})\.\s+\S/.test(text);
        if (looksLikeHeading) {
          allChildren.push(new Paragraph({
            children: [new TextRun({ text, bold: true, color: NAVY, size: 22 })],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 280, after: 100 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
          }));
        } else {
          allChildren.push(new Paragraph({
            children: [new TextRun({ text, color: DARK })],
            spacing: { after: 60 },
          }));
        }
      }
      if (pi < pages.length - 1)
        allChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));
      continue; // skip MuPDF block processing for this page
    }


    // MuPDF asJSON returns bbox as [x0, y0, x1, y1] array
    const bboxObj = (bb) => {
      if (!bb) return { x: 0, y: 0, w: 0, h: 0 };
      if (Array.isArray(bb)) return { x: bb[0], y: bb[1], w: bb[2] - bb[0], h: bb[3] - bb[1] };
      return { x: bb.x ?? 0, y: bb.y ?? 0, w: bb.w ?? 0, h: bb.h ?? 0 }; // legacy object format
    };

    // ── TEMPORARY DEBUG: log raw MuPDF structure to browser console ──────────
    if (pi === 0) {
      console.log('[PDF-DEBUG] Page keys:', Object.keys(pages[0]));
      console.log('[PDF-DEBUG] blocks count:', blocks.length);
      if (blocks[0]) console.log('[PDF-DEBUG] block[0]:', JSON.stringify(blocks[0]).slice(0, 1000));
      if (blocks[1]) console.log('[PDF-DEBUG] block[1]:', JSON.stringify(blocks[1]).slice(0, 500));
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Each line: { text, font, x, y, w, h, blockW }
    const allLines = [];
    for (const block of blocks) {
      if (block.type !== 'text') continue;
      const blockBbox = bboxObj(block.bbox);
      for (const line of block.lines || []) {
        const lineBbox = bboxObj(line.bbox);
        // Collect full text and dominant font from spans
        let text = '';
        let font = line.font || {};
        if (line.spans && line.spans.length > 0) {
          text = line.spans.map(s => s.text || '').join('');
          // Use font from largest/first span
          const spanWithFont = line.spans.find(s => s.font) || line.spans[0];
          if (spanWithFont?.font) font = spanWithFont.font;
          else if (spanWithFont?.size) font = { size: spanWithFont.size, name: spanWithFont.family || '' };
        } else {
          text = line.text || '';
        }
        if (!text.trim()) continue;

        allLines.push({
          text:   text.trim(),
          font:   font,
          x:      lineBbox.x || blockBbox.x,
          y:      lineBbox.y || blockBbox.y,  // top of line (not baseline)
          w:      lineBbox.w || blockBbox.w,
          h:      Math.max(lineBbox.h, 1),
          blockW: blockBbox.w,
        });
      }
    }

    // Skip header/footer lines (very top or very bottom of page)
    const pageH = pages[pi].pageHeight || 842;
    const margin = 20;
    const bodyLines = allLines.filter(l => l.y > margin && l.y < pageH - margin);

    // Body font size (mode) — use 'size' from font object
    const sizes = bodyLines.map(l => {
      const s = l.font?.size || 0;
      return Math.round(s);
    }).filter(s => s > 0);
    const sizeCounts = sizes.reduce((a, s) => { a[s] = (a[s] || 0) + 1; return a; }, {});
    const bodySize = sizes.length ? Number(Object.entries(sizeCounts).sort((a, b) => b[1] - a[1])[0][0]) : 10;

    // ── Group lines into visual rows by Y-overlap ───────────────────────────
    // Since we now use lineBbox.y (top), overlap detection is robust.
    const tol = Math.max(bodySize * 0.6, 4); // lines within half a line-height = same row
    const yGroups = [];
    for (const line of bodyLines) {
      const lineTop = line.y;
      const lineBot = line.y + line.h;
      let placed = false;
      for (const g of yGroups) {
        // Check if this line overlaps the group's vertical range
        const overlapTop = Math.max(g.top, lineTop);
        const overlapBot = Math.min(g.bot, lineBot);
        if (overlapBot > overlapTop || Math.abs(g.y - lineTop) <= tol) {
          g.lines.push(line);
          g.y = g.lines.reduce((s, l) => s + l.y, 0) / g.lines.length;
          g.top = Math.min(g.top, lineTop);
          g.bot = Math.max(g.bot, lineBot);
          placed = true; break;
        }
      }
      if (!placed) yGroups.push({ y: lineTop, top: lineTop, bot: lineBot, lines: [line] });
    }
    yGroups.sort((a, b) => a.y - b.y);

    // ── Classify each Y-group and build DOCX elements ───────────────────────
    // "Signature row" = a row with 2-3 columns where at least one cell contains (potpis)
    const isSigRow = (lines) => lines.some(l => /\(potpis|\(pot\./i.test(l.text));
    // Checkbox patterns: Unicode checkbox chars OR Zapf Dingbats chars (u+0067='g'=✓ in ZapfDingbats)
    const CB_CHARS_RE = /^[✓✔☑☒☐□✗✘]/;

    // Accumulate consecutive multi-column rows into tableAcc for table rendering
    let tableAcc = [];
    const flushTable = () => {
      if (!tableAcc.length) return;
      // ANY row with 2+ cols builds a table; even single-row (signature / multi-col)
      if (tableAcc[0].length >= 2 || tableAcc.length >= 2) {
        buildTable(tableAcc);
      } else {
        // Truly single-col single-row → paragraph
        for (const row of tableAcc) for (const ln of row) emitLine(ln);
      }
      tableAcc = [];
    };

    const buildTable = (rows) => {
      const hasSigLine = rows.some(r => isSigRow(r));

      // Find distinct X grid anchors across all rows in the table group
      let allXs = rows.flatMap(r => r.map(l => l.x || 0));
      allXs.sort((a, b) => a - b);
      
      const colStarts = [];
      for (const x of allXs) {
        if (!colStarts.length || x - colStarts[colStarts.length - 1] > 20) {
           colStarts.push(x);
        }
      }
      if (!colStarts.length) colStarts.push(0);
      const numCols = colStarts.length;

      const minLeft = colStarts[0] || 0;
      const rightEdge = Math.max(...rows.flatMap(r => r.map(l => (l.x || 0) + (l.blockW || 100))), minLeft + 100);
      const totalW = Math.max(rightEdge - minLeft, 1);

      const colWidthsPct = [];
      let usedPct = 0;
      for (let ci = 0; ci < numCols - 1; ci++) {
        const pct = Math.max(Math.round(((colStarts[ci + 1] - colStarts[ci]) / totalW) * 100), 2);
        colWidthsPct.push(pct);
        usedPct += pct;
      }
      colWidthsPct.push(Math.max(100 - usedPct, 2));

      const tableRows = rows.map(row => {
        // Map lines into geographic grid cells
        const mappedLines = Array(numCols).fill(null);
        for (const ln of row) {
          let bestCi = 0, bestDiff = Infinity;
          for (let ci = 0; ci < numCols; ci++) {
            const diff = Math.abs((ln.x || 0) - colStarts[ci]);
            if (diff < bestDiff) { bestDiff = diff; bestCi = ci; }
          }
          if (mappedLines[bestCi]) mappedLines[bestCi].text += ' ' + ln.text;
          else mappedLines[bestCi] = { ...ln };
        }

        // Is this row a signature-label row? (contains "(potpis")
        const thisRowIsSig = isSigRow(row);

        const cells = Array.from({ length: numCols }, (_, ci) => {
          const ln = mappedLines[ci];
          const widthSpec = { size: colWidthsPct[ci], type: WidthType.PERCENTAGE };
          // Signature cells get a top border (the signature line drawn ABOVE the name in the PDF)
          const borders = hasSigLine && !thisRowIsSig
            ? { top: thin(), bottom: none(), left: none(), right: none() }
            : { top: none(), bottom: thin(), left: none(), right: none() };

          if (!ln) {
            return new TableCell({ children: [new Paragraph({ children: [] })], width: widthSpec, borders, margins: { top: 40, bottom: 40, left: 100, right: 100 } });
          }

          const bold = (ln.font?.weight === 'bold') || (ln.font?.name || '').toLowerCase().includes('bold') || (ln.font?.name || '').toLowerCase().includes('semibold');
          const italic = (ln.font?.style === 'italic') || (ln.font?.name || '').toLowerCase().includes('italic');
          const size = Math.max(Math.round((ln.font?.size || bodySize) * 2 * 0.75), 18);
          const isSmall = (ln.font?.size || bodySize) < bodySize * 0.85;
          const color = bold ? NAVY : (isSmall ? GRAY : DARK);

          const runs = CB_CHARS_RE.test(ln.text)
            ? [new TextRun({ text: ln.text, font: 'Segoe UI Symbol', size, color })]
            : [new TextRun({ text: ln.text, bold, italics: italic, size, color })];

          return new TableCell({
            width: widthSpec,
            children: [new Paragraph({ children: runs })],
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            borders,
          });
        });
        return new TableRow({ children: cells });
      });

      allChildren.push(
        new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: { top: none(), bottom: none(), left: none(), right: none(), insideH: thin(), insideV: none() },
        }),
        new Paragraph({ children: [], spacing: { after: 80 } })
      );
    };

    const emitLine = (ln) => {
      const text = ln.text;
      const bold = ln.font.weight === 'bold' || (ln.font.name || '').toLowerCase().includes('bold') || (ln.font.name || '').toLowerCase().includes('semibold') || (ln.font.name || '').toLowerCase().includes('black');
      const italic = ln.font.style === 'italic' || (ln.font.name || '').toLowerCase().includes('italic');
      const size = ln.font.size || bodySize;
      const halfPt = Math.max(Math.round(size * 2 * 0.75), 16);
      const isLarger = size > bodySize * 1.2;
      const isMuchLarger = size > bodySize * 1.5;
      const isHead = isHeading(text, bold, size, bodySize);
      const isSmall = size < bodySize * 0.85;
      const blockCX = (ln.x || 0) + (ln.w || ln.blockW || 0) / 2;
      const blockWide = (ln.w || ln.blockW || 0) > pageWidth * 0.55;
      const isCentered = !blockWide && Math.abs(blockCX - pageCenterX) < pageWidth * 0.08;
      const color = isHead || isMuchLarger ? NAVY : (isSmall ? GRAY : DARK);

      let run;
      if (CB_RE.test(text)) {
        run = new TextRun({ text, font: 'Segoe UI Symbol', size: halfPt, color });
      } else {
        run = new TextRun({ text, bold: bold || isHead || isMuchLarger, italics: italic, size: halfPt, color });
      }

      if (isHead) {
        allChildren.push(new Paragraph({
          children: [run],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 100 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: NAVY, space: 4 } },
        }));
      } else if (isMuchLarger) {
        allChildren.push(new Paragraph({
          children: [run],
          spacing: { before: 160, after: 80 },
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
      } else if (isLarger || bold) {
        allChildren.push(new Paragraph({
          children: [run],
          spacing: { before: 100, after: 40 },
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
      } else {
        allChildren.push(new Paragraph({
          children: [run],
          spacing: { after: isSmall ? 20 : 60 },
          alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
        }));
      }
    };

    for (const g of yGroups) {
      const { lines } = g;
      // Sort lines within group by x
      lines.sort((a, b) => (a.x || 0) - (b.x || 0));

      // Checkbox row: first element is a checkbox character followed by text
      // Check widget state to render ✓ or □ correctly
      const firstIsCheckbox = lines.length >= 1 && CB_CHARS_RE.test(lines[0].text.trim()[0]);
      if (firstIsCheckbox && lines.length >= 1) {
        flushTable();
        const cbLine = lines[0];
        const textLine = lines.length > 1 ? lines[1] : null;
        // Determine if this checkbox is checked via widget data or by the extracted character
        const widgetState = isWidgetChecked(cbLine.x, cbLine.y);
        const checkedChar = (widgetState === true || /^[✓✔☑]/.test(cbLine.text)) ? '\u2611' : '\u2610'; // ☑ or ☐
        
        const sz = Math.max(Math.round((cbLine.font?.size || bodySize) * 2 * 0.75), 18);
        const runs = [new TextRun({ text: checkedChar + '  ', font: 'Segoe UI Symbol', size: sz })];
        if (textLine) {
          const bold2 = (textLine.font?.name || '').toLowerCase().includes('bold');
          runs.push(new TextRun({ text: textLine.text, bold: bold2, size: sz, color: DARK }));
        } else if (cbLine.text.length > 1) {
          // Checkbox char + text in same string
          runs.push(new TextRun({ text: cbLine.text.replace(/^[✓✔☑☒☐□✗✘\u2610-\u2612]\s*/, ''), size: sz, color: DARK }));
        }
        allChildren.push(new Paragraph({ children: runs, spacing: { after: 40 } }));
        continue;
      }

      // Multi-column row (label | value or signature)
      if (lines.length >= 2) {
        tableAcc.push(lines);
        continue;
      }

      // Single line = paragraph
      flushTable();
      emitLine(lines[0]);
    }
    flushTable();

    if (pi < pages.length - 1)
      allChildren.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

  const doc = new WDoc({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 20, color: DARK }, paragraph: { spacing: { line: 276 } } },
        heading2: { run: { bold: true, color: NAVY, size: 22, font: 'Calibri' } },
      },
    },
    sections: [{ children: allChildren }],
  });
  return Packer.toBlob(doc);
}





async function convertPdfToDocxMuPDF(dataUri) {
  const base64Data = dataUri.split(',')[1];
  const { pages } = await apiParsePdf(base64Data, 'document.pdf');
  return buildDocxFromPages(pages);
}

export default function ConverterPage() {
  const { lang, t } = useLanguage();
  const { alert, DialogRenderer } = useDialog();
  const [activeTab, setActiveTab] = useState('convert'); // 'convert' | 'merge'
  const [mergeFiles, setMergeFiles] = useState([]); // array of { id, name, arrayBuffer }
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(null);  // loaded.htmlBody = raw mammoth HTML
  const [processing, setProcessing] = useState('');
  const [archiveSearch, setArchiveSearch] = useState('');
  const fileInputRef = useRef(null);
  const blobUrlsRef = useRef([]);

  // Same form collections as the Digital Archive page (archive/page.js)
  const FORM_SOURCES = [
    { col: 'requests',      label: 'Zahtjevnica' },
    { col: 'formsOir1',     label: 'Obrazac OIR-1' },
    { col: 'formsRo1',      label: 'Obrazac RO-1' },
    { col: 'formsRo2',      label: 'Obrazac RO-2' },
    { col: 'referralsNr1',  label: 'Lj. uputnica (NR1)' },
    { col: 'referralsRa1',  label: 'Lj. uputnica (RA1)' },
    { col: 'employerDocs',  label: 'Dokumentacija za poslodavca' },
    { col: 'certificates',  label: 'Uvjerenje radnika' },
  ];

  const readArchive = () => {
    if (typeof window === 'undefined') return [];
    
    // 1. All digitalArchive items (with or without binary data)
    const da = getRawAll(COLLECTIONS.DIGITAL_ARCHIVE).map(f => ({
      ...f,
      name: f.name || f.naziv || 'Dokument',
      hasData: !!(f.data?.startsWith?.('data:')),
    }));
    const seen = new Set(da.map(f => f.id));
    
    const docs = [];

    // 2. Form/referral generated docs — exactly mirroring archive/page.js FORM_SOURCES
    FORM_SOURCES.forEach(({ col, label }) => {
      try {
        const recs = getRawAll(col);
        recs.forEach(r => {
          const fName = r.docName || r.attachedFileName || r.fileName || r.datotekaIme;
          const fData = r.docData || r.attachedFileData || r.fileData || r.datotekaSadrzaj;
          if (fName && fData) {
            const uid = `form-${col}-${r.id}`;
            if (seen.has(uid)) return;
            seen.add(uid);
            docs.push({
              id: uid,
              name: fName,
              data: fData,
              hasData: true,
              category: label.includes('Uvjerenje') ? 'Certifikati' : 'Obrasci',
              description: r.ime ? `${r.ime}` : label,
              _sourceLabel: label,
            });
          }
        });
      } catch { /* ignore */ }
    });

    // 3. Aggregate fleet vehicle documents (nested inside vehicle records)
    try {
      const vehicles = getRawAll('vehicles');
      vehicles.forEach(v => {
        const vDocs = v.dokumenti || [];
        vDocs.forEach(d => {
          if (d.naziv && d.docData) {
            const uid = `fleet-doc-${v.id}-${d.id}`;
            if (seen.has(uid)) return;
            seen.add(uid);
            docs.push({
              id: uid,
              name: d.naziv,
              data: d.docData,
              hasData: true,
              category: d.kategorija === 'Osiguranje' ? 'Ugovori' : d.kategorija === 'Tehnički pregled' ? 'Certifikati' : 'Ostalo',
              description: `${v.registracija || 'Vozilo'} — ${d.kategorija || 'Ostalo'}`,
              _sourceLabel: 'Vozni park',
            });
          }
        });
      });
    } catch { /* ignore */ }

    // 4. Aggregate fleet-documents module docs
    try {
      const fleetDocs = getRawAll('fleetDocuments');
      fleetDocs.forEach(fd => {
        const fName = fd.docName || fd.attachedFileName || fd.fileName || fd.datotekaIme;
        const fData = fd.docData || fd.attachedFileData || fd.fileData || fd.datotekaSadrzaj;
        if (fName && fData) {
          const uid = `fleet-fdoc-${fd.id}`;
          if (seen.has(uid)) return;
          seen.add(uid);
          docs.push({
            id: uid,
            name: fName,
            data: fData,
            hasData: true,
            category: 'Ostalo',
            description: fd.naziv || fd.ime || 'Flota dokument',
            _sourceLabel: 'Flota dokumenti',
          });
        }
      });
    } catch { /* ignore */ }

    // 5. Aggregate fleet-orders travel orders
    try {
      const fleetOrders = getRawAll('fleetOrders');
      fleetOrders.forEach(fo => {
        const fName = fo.docName || fo.attachedFileName || fo.fileName || fo.datotekaIme;
        const fData = fo.docData || fo.attachedFileData || fo.fileData || fo.datotekaSadrzaj;
        if (fName && fData) {
          const uid = `fleet-order-${fo.id}`;
          if (seen.has(uid)) return;
          seen.add(uid);
          docs.push({
            id: uid,
            name: fName,
            data: fData,
            hasData: true,
            category: 'Obrasci',
            description: fo.opis || fo.naziv || 'Putni nalog',
            _sourceLabel: 'Putni nalozi',
          });
        }
      });
    } catch { /* ignore */ }

    return [...da, ...docs];
  };

  const [archiveFiles, setArchiveFiles] = useState([]); // populated by useEffect below

  // useEffect runs CLIENT-SIDE ONLY.
  // useState lazy init runs on server too (returns []) so we MUST load here.
  useEffect(() => {
    setArchiveFiles(readArchive()); // load immediately on mount
    const onFocus = () => setArchiveFiles(readArchive()); // refresh when tab regains focus
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const { sorted: filteredArchive } = useSortedList(
    archiveFiles.filter(f =>
      !archiveSearch || (f.name || f.naziv || '').toLowerCase().includes(archiveSearch.toLowerCase())
    ), 'name'
  );


  const cleanup = () => {
    blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    blobUrlsRef.current = [];
  };

  const loadFile = useCallback(async (arrayBuffer, name, originalDataUri) => {
    const ext = getExt(name);
    cleanup();
    if (isWordExt(ext)) {
      setProcessing('converting');
      try {
        const { blobUrl, body } = await convertDocxToBlob(arrayBuffer, name);
        blobUrlsRef.current.push(blobUrl);
        setLoaded({ name, data: originalDataUri, iframeSrc: blobUrl, htmlBody: body, ext });
      } catch (e) {
        console.error(e);
        await alert(lang === 'bs' ? 'Greška pri čitanju Word dokumenta.' : 'Error reading Word document.');
      } finally {
        setProcessing('');
      }
    } else {
      // PDF / other — convert data URI to blob URL (Chrome blocks data: URIs in iframes)
      const blobUrl = originalDataUri ? dataUriToBlobUrl(originalDataUri) : URL.createObjectURL(new Blob([arrayBuffer]));
      blobUrlsRef.current.push(blobUrl);
      setLoaded({ name, data: originalDataUri, iframeSrc: blobUrl, ext });
    }
  }, [lang, alert]);

  const loadFromFile = async (files) => {
    const fileList = Array.from(files);
    
    if (activeTab === 'merge') {
      const pdfFiles = fileList.filter(f => getExt(f.name) === 'pdf');
      if (pdfFiles.length === 0) return alert(lang === 'bs' ? 'Samo PDF datoteke se mogu spajati.' : 'Only PDF files can be merged.');
      
      const newMergeFiles = [];
      for (const file of pdfFiles) {
        if (file.size > 30 * 1024 * 1024) continue;
        const arrayBuffer = await file.arrayBuffer();
        newMergeFiles.push({ id: Math.random().toString(36).substr(2, 9), name: file.name, arrayBuffer });
      }
      setMergeFiles(prev => [...prev, ...newMergeFiles]);
      return;
    }

    // Convert mode (single file)
    const file = fileList[0];
    if (file.size > 30 * 1024 * 1024) {
      await alert(lang === 'bs' ? 'Datoteka mora biti manja od 30MB!' : 'File must be under 30MB!');
      return;
    }
    const arrayBuffer = await file.arrayBuffer();
    const dataUri = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
    await loadFile(arrayBuffer, file.name, dataUri);
  };

  const loadFromArchive = async (file) => {
    if (!file.hasData && !file.data?.startsWith?.('data:')) {
      await alert(
        lang === 'bs'
          ? 'Sadržaj ove datoteke nije pohranjen u arhivi (samo metapodaci). Otvorite datoteku direktno da biste je konvertirali.'
          : 'This file has no stored content (metadata only). Open the file directly to convert it.'
      );
      return;
    }
    const arrayBuffer = dataUriToBuffer(file.data);
    
    if (activeTab === 'merge') {
      if (getExt(file.name) !== 'pdf') return alert(lang === 'bs' ? 'Samo PDF datoteke se mogu spajati.' : 'Only PDF files can be merged.');
      setMergeFiles(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), name: file.name, arrayBuffer }]);
      return;
    }

    // Convert mode
    await loadFile(arrayBuffer, file.name, file.data);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) loadFromFile(e.dataTransfer.files);
  };


  const openInTab = () => {
    if (!loaded?.iframeSrc) return;
    window.open(loaded.iframeSrc, '_blank');
  };

  const printDoc = () => {
    if (!loaded?.iframeSrc) return;
    const w = window.open(loaded.iframeSrc, '_blank');
    if (w) w.addEventListener('load', () => { w.focus(); w.print(); });
  };

  const handleConvertWordToPdf = async () => {
    if (!loaded) return;
    setProcessing('word2pdf');
    try {
      const body = loaded.htmlBody || '';
      if (!body) throw new Error('Reload the document first');

      // ── Render in a HIDDEN IFRAME (isolated context, no visual interference) ──
      // The iframe is off-screen to the LEFT so it never overlaps the visible UI.
      // Its rendering context is completely separate from the main page.
      const fullHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:50px 60px;background:#fff!important;color:#111!important;
    font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.6;
    width:794px;max-width:794px}
  h1,h2,h3,h4,h5,h6{color:#1a2e50!important;page-break-after:avoid;break-after:avoid}
  table{border-collapse:collapse;width:100%;margin:10px 0}
  td,th{border:1px solid #ccc;padding:5px 8px}
  p{margin:0 0 8px}img{max-width:100%}
</style></head><body>${body}</body></html>`;

      const iframe = document.createElement('iframe');
      iframe.style.cssText = [
        'position:fixed', 'left:-9999px', 'top:0',
        'width:794px', 'height:1123px',
        'border:none', 'pointer-events:none',
      ].join(';');
      // srcdoc = same-origin → html2canvas can access contentDocument
      iframe.srcdoc = fullHtml;
      document.body.appendChild(iframe);

      // Wait for iframe to load content + settle
      await new Promise(r => {
        iframe.addEventListener('load', r, { once: true });
        setTimeout(r, 2000); // fallback
      });
      await new Promise(r => setTimeout(r, 400));

      const iframeDoc  = iframe.contentDocument;
      const iframeBody = iframeDoc.body;

      // Expand iframe to full document height so nothing is clipped
      const contentH = iframeBody.scrollHeight;
      iframe.style.height = contentH + 'px';
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // ── Record heading Y positions inside iframe for smart page breaks ──
      const SCALE = 2;
      const bodyTop = iframeBody.getBoundingClientRect().top;
      const headingYsCanvas = [];
      for (const h of iframeBody.querySelectorAll('h1,h2,h3,h4,h5,h6')) {
        const relY = h.getBoundingClientRect().top - bodyTop;
        if (relY > 0) headingYsCanvas.push(Math.round(relY * SCALE));
      }
      headingYsCanvas.sort((a, b) => a - b);

      // ── Capture iframe body to canvas (no main-page interference) ──
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(iframeBody, {
        scale: SCALE,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });

      document.body.removeChild(iframe);

      // ── Smart page breaks: prefer to break just before each heading ──
      const findBreakY = (targetY, radiusPx) => {
        const windowStart = targetY - radiusPx * 2;
        const windowEnd   = targetY + Math.round(radiusPx * 0.3);
        let bestHeadingY = null;
        for (const hY of headingYsCanvas) {
          if (hY >= windowStart && hY <= windowEnd) bestHeadingY = hY;
        }
        if (bestHeadingY !== null) return Math.max(0, bestHeadingY - 8);
        // Fallback: find whitest row scanning backward
        const ctx  = canvas.getContext('2d');
        const from = Math.max(0, targetY - radiusPx);
        const to   = Math.min(canvas.height - 1, targetY);
        let bestY = targetY, bestWhite = -1;
        for (let y = to; y >= from; y--) {
          const row = ctx.getImageData(0, y, canvas.width, 1).data;
          let white = 0;
          for (let i = 0; i < row.length; i += 4) {
            if (row[i] >= 240 && row[i+1] >= 240 && row[i+2] >= 240) white++;
          }
          if (white > bestWhite) { bestWhite = white; bestY = y; }
        }
        return bestY;
      };

      // ── Build PDF ──
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const A4W = 210, A4H = 297;
      const pxPerMm = canvas.width / A4W;
      const nominalPageHPx = A4H * pxPerMm;

      let startY = 0, pageNum = 0;
      while (startY < canvas.height) {
        if (pageNum > 0) pdf.addPage();
        const nomBottom = startY + nominalPageHPx;
        const breakY = nomBottom >= canvas.height
          ? canvas.height
          : findBreakY(Math.round(nomBottom), Math.round(pxPerMm * 45));
        const sliceH = breakY - startY;
        if (sliceH < 2) break; // safety
        const slice  = document.createElement('canvas');
        slice.width  = canvas.width;
        slice.height = Math.ceil(sliceH);
        slice.getContext('2d').drawImage(
          canvas, 0, Math.floor(startY), canvas.width, Math.ceil(sliceH),
          0, 0, canvas.width, Math.ceil(sliceH)
        );
        pdf.addImage(slice.toDataURL('image/png'), 'PNG', 0, 0, A4W, Math.min(sliceH / pxPerMm, A4H));
        startY = breakY;
        pageNum++;
      }

      pdf.save(loaded.name.replace(/\.(docx|doc)$/i, '.pdf'));
    } catch (e) {
      console.error('[word2pdf]', e);
      await alert(lang === 'bs' ? `Greška: ${e?.message || e}` : `Error: ${e?.message || e}`);
    } finally {
      setProcessing('');
    }
  };


  const downloadOriginal = () => {
    if (!loaded?.data) return;
    const a = document.createElement('a');
    a.href = loaded.data;
    a.download = loaded.name;
    a.click();
  };

  const handleConvertPdfToWord = async () => {
    if (!loaded?.data) return;
    setProcessing('pdf2word');
    try {
      const blob = await convertPdfToDocxMuPDF(loaded.data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = loaded.name.replace(/\.pdf$/i, '.docx');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error('[pdf2word]', e);
      const msg = e?.message || String(e) || 'Unknown error';
      await alert(lang === 'bs' ? `Greška: ${msg}` : `Error: ${msg}`);
    } finally {
      setProcessing('');
    }
  };

  const handleMerge = async () => {
    if (mergeFiles.length < 2) return alert(lang === 'bs' ? 'Odaberite barem 2 PDF datoteke za spajanje.' : 'Select at least 2 PDF files to merge.');
    setProcessing('merging');
    try {
      const mergedPdf = await PDFDocument.create();
      for (const file of mergeFiles) {
        const pdfDoc = await PDFDocument.load(file.arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_${new Date().getTime()}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMergeFiles([]);
    } catch (e) {
      console.error('[pdf-merge]', e);
      await alert(lang === 'bs' ? `Greška pri spajanju: ${e?.message || e}` : `Merge error: ${e?.message || e}`);
    } finally {
      setProcessing('');
    }
  };

  const moveMergeFile = (index, direction) => {
    const newFiles = [...mergeFiles];
    if (direction === 'up' && index > 0) {
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
    } else if (direction === 'down' && index < newFiles.length - 1) {
      [newFiles[index + 1], newFiles[index]] = [newFiles[index], newFiles[index + 1]];
    }
    setMergeFiles(newFiles);
  };

  const removeMergeFile = (index) => {
    setMergeFiles(prev => prev.filter((_, i) => i !== index));
  };

  const close = () => { cleanup(); setLoaded(null); };

  const isWord = loaded && isWordExt(loaded.ext);
  const isPdf = loaded && loaded.ext === 'pdf';

  return (
    <div className="animate-fadeIn">
      <DialogRenderer />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.6rem' }}>🔄</span>
          <div>
            <h1 style={{ margin: 0 }}>{t('converter')}</h1>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {lang === 'bs' ? 'PDF i Word dokumenti — pregled, ispis, konverzija i spajanje' : 'PDF and Word documents — preview, print, convert and merge'}
            </p>
          </div>
        </div>
        
        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-card)', padding: 4, borderRadius: 10, border: '1px solid var(--border)' }}>
          <button onClick={() => setActiveTab('convert')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, border: 'none', background: activeTab === 'convert' ? 'var(--primary)' : 'transparent', color: activeTab === 'convert' ? '#fff' : 'var(--text)', cursor: 'pointer', transition: 'all 0.2s' }}>
            {lang === 'bs' ? 'Konverzija' : 'Conversion'}
          </button>
          <button onClick={() => setActiveTab('merge')} style={{ padding: '8px 16px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 600, border: 'none', background: activeTab === 'merge' ? 'var(--primary)' : 'transparent', color: activeTab === 'merge' ? '#fff' : 'var(--text)', cursor: 'pointer', transition: 'all 0.2s' }}>
            {lang === 'bs' ? 'Spajanje PDF' : 'Merge PDF'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Convert Tab Drop Zone */}
          {activeTab === 'convert' && !loaded && !processing && (
            <div className="card"
              style={{ border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)', background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent', transition: 'all 0.2s', cursor: 'pointer' }}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '3rem', marginBottom: 12 }}>{dragging ? '📂' : '🔄'}</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                  {lang === 'bs' ? 'Prevuci PDF ili Word dokument ovdje' : 'Drag a PDF or Word document here'}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
                  {lang === 'bs' ? 'ili kliknite da odaberete datoteku' : 'or click to select a file'}
                </div>
                <div style={{ display: 'flex', gap: 24, justifyContent: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>📕 PDF → <strong style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'pregled + preuzmi kao Word' : 'preview + download as Word'}</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>📘 Word → <strong style={{ color: 'var(--primary)' }}>{lang === 'bs' ? 'pregled + spremi kao PDF' : 'preview + save as PDF'}</strong></span>
                </div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" multiple={activeTab === 'merge'} style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) loadFromFile(e.target.files); }} />
              </div>
            </div>
          )}
          
          {/* Merge Tab UI */}
          {activeTab === 'merge' && !processing && (
            <div className="card">
              <div className="card-body">
                <div style={{ marginBottom: 20, textAlign: 'center', padding: '30px 20px', border: dragging ? '2px solid var(--primary)' : '2px dashed var(--border)', borderRadius: 12, background: dragging ? 'rgba(0,191,166,0.04)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s' }}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>{dragging ? '📂' : '📑'}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                    {lang === 'bs' ? 'Prevuci PDF datoteke ovdje' : 'Drag PDF files here'}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {lang === 'bs' ? 'ili kliknite za odabir' : 'or click to select'}
                  </div>
                  <input ref={fileInputRef} type="file" accept=".pdf" multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.length) loadFromFile(e.target.files); setDragging(false); }} />
                </div>

                {mergeFiles.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{lang === 'bs' ? 'Odabrane datoteke (' + mergeFiles.length + ')' : 'Selected files (' + mergeFiles.length + ')'}</span>
                      <button className="btn btn-primary btn-sm" onClick={handleMerge} disabled={mergeFiles.length < 2}>
                        📑 {lang === 'bs' ? 'Spoji PDFove' : 'Merge PDFs'}
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {mergeFiles.map((file, i) => (
                        <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8 }}>
                          <span style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 700, opacity: 0.5 }}>{i + 1}.</span>
                          <span style={{ fontSize: '1.2rem' }}>📕</span>
                          <span style={{ flex: 1, fontWeight: 500, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                          
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-icon btn-sm" disabled={i === 0} onClick={() => moveMergeFile(i, 'up')} title={lang === 'bs' ? 'Pomakni gore' : 'Move up'}>↑</button>
                            <button className="btn btn-ghost btn-icon btn-sm" disabled={i === mergeFiles.length - 1} onClick={() => moveMergeFile(i, 'down')} title={lang === 'bs' ? 'Pomakni dolje' : 'Move down'}>↓</button>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => removeMergeFile(i)} title={lang === 'bs' ? 'Ukloni' : 'Remove'}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Processing spinner */}
          {processing && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 600 }}>
                  {processing === 'converting'
                    ? (lang === 'bs' ? 'Konvertovanje Word dokumenta...' : 'Converting Word document...')
                    : processing === 'merging' 
                      ? (lang === 'bs' ? 'Spajanje PDF datoteka...' : 'Merging PDF files...')
                      : (lang === 'bs' ? 'Konvertovanje PDF-a u Word (MuPDF)...' : 'Converting PDF to editable Word (MuPDF)...')}
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  {lang === 'bs' ? 'Ovo može potrajati nekoliko sekundi.' : 'This may take a few seconds.'}
                </div>
              </div>
            </div>
          )}

          {/* Document viewer (Convert Mode Only) */}
          {activeTab === 'convert' && loaded && !processing && (
            <div className="card">
              <div className="card-body" style={{ padding: 0 }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{getIcon(loaded.name)}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {loaded.name}
                    {isWord && <span style={{ marginLeft: 8, fontSize: '0.7rem', background: 'rgba(0,191,166,0.12)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 8, fontWeight: 700 }}>Word → HTML</span>}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={openInTab}>👁 {lang === 'bs' ? 'Otvori' : 'Open'}</button>
                  {isPdf && <button className="btn btn-primary btn-sm" onClick={handleConvertPdfToWord} disabled={!!processing}>📘 {lang === 'bs' ? 'Konvertuj u Word' : 'Convert to Word'}</button>}
                  {isWord && <button className="btn btn-primary btn-sm" onClick={handleConvertWordToPdf} disabled={!!processing}>📥 {lang === 'bs' ? 'Konvertuj u PDF' : 'Convert to PDF'}</button>}
                  {isWord && <button className="btn btn-ghost btn-sm" onClick={printDoc}>🖨️ {lang === 'bs' ? 'Ispiši' : 'Print'}</button>}
                  {isPdf && <button className="btn btn-ghost btn-sm" onClick={printDoc}>🖨️ {lang === 'bs' ? 'Ispiši' : 'Print'}</button>}
                  <button className="btn btn-ghost btn-sm" onClick={downloadOriginal}>⬇️ {lang === 'bs' ? 'Preuzmi original' : 'Download'}</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={close}>✕</button>
                </div>

                {isWord && (
                  <div style={{ padding: '5px 14px', background: 'rgba(0,191,166,0.06)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {lang === 'bs' ? '"Konvertuj u PDF" automatski preuzima PDF. "Ispiši" otvara dijaloški okvir za ispis.' : '"Convert to PDF" auto-downloads a PDF. "Print" opens the print dialog.'}
                  </div>
                )}
                {isPdf && (
                  <div style={{ padding: '5px 14px', background: 'rgba(99,102,241,0.05)', borderBottom: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    💡 {lang === 'bs' ? 'Konverzija putem MuPDF (WASM) — editabilni tekst + tabele, bez vanjskog servisa.' : 'Conversion via MuPDF (WASM) — editable text + tables, no external service.'}
                  </div>
                )}


                {/* Iframe preview — no sandbox so PDFs work, explicit white bg */}
                <iframe
                  key={loaded.iframeSrc}
                  src={loaded.iframeSrc}
                  style={{ width: '100%', height: '72vh', border: 'none', display: 'block', background: '#ffffff' }}
                  title={loaded.name}
                />
              </div>
            </div>
          )}
        </div>

        {/* Archive picker */}
        <div>
          <div className="card">
            <div className="card-body">
              <div style={{ fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                🗄️ {lang === 'bs' ? 'Iz Digitalne Arhive' : 'From Digital Archive'}
              </div>
              <div className="search-bar" style={{ marginBottom: 12 }}>
                <input placeholder={lang === 'bs' ? 'Pretraži arhivu...' : 'Search archive...'}
                  value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-body)', fontSize: '0.85rem', flex: 1, width: '100%' }} />
                {archiveSearch && <button className="btn btn-ghost btn-sm" onClick={() => setArchiveSearch('')}>✕</button>}
              </div>
              {filteredArchive.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {lang === 'bs' ? 'Nema datoteka u arhivi' : 'No files in archive'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '74vh', overflowY: 'auto' }}>
                  {filteredArchive.map(file => {
                      const noData = !file.hasData && !file.data?.startsWith?.('data:');
                      return (
                        <button key={file.id} onClick={() => loadFromArchive(file)}
                          title={noData ? (lang === 'bs' ? 'Datoteka bez pohranjenog sadržaja' : 'No stored file content') : file.name}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: loaded?.name === file.name ? 'rgba(0,191,166,0.08)' : 'var(--bg-card)', cursor: noData ? 'not-allowed' : 'pointer', textAlign: 'left', fontSize: '0.82rem', fontFamily: 'var(--font-body)', color: noData ? 'var(--text-muted)' : 'var(--text)', opacity: noData ? 0.6 : 1, transition: 'all 0.15s' }}>
                          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{noData ? '🔒' : getIcon(file.name)}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                          {!noData && isWordExt(getExt(file.name)) && <span style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, flexShrink: 0 }}>WD</span>}
                          {noData && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', flexShrink: 0 }}>no file</span>}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
