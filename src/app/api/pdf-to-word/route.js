import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request) {
  let tmpPdf = null;
  let tmpDocx = null;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const filename = form.get('filename') || 'document.pdf';
    const buffer = Buffer.from(await file.arrayBuffer());

    const tmpDir = os.tmpdir();
    const id = `eznr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    tmpPdf = path.join(tmpDir, `${id}.pdf`);
    tmpDocx = path.join(tmpDir, `${id}.docx`);

    await fs.writeFile(tmpPdf, buffer);

    const scriptPath = path.join(process.cwd(), 'scripts', 'pdf2word.py');

    try {
      await execAsync(`python "${scriptPath}" "${tmpPdf}" "${tmpDocx}"`, { timeout: 60000 });
    } catch (execErr) {
      const msg = execErr.stderr || execErr.message || '';
      if (msg.includes('pdf2docx') || msg.includes('No module')) {
        return NextResponse.json(
          { error: 'pdf2docx not installed', setupRequired: true },
          { status: 503 }
        );
      }
      throw new Error(msg || 'Conversion failed');
    }

    const docxBuffer = await fs.readFile(tmpDocx);
    const docxName = filename.replace(/\.pdf$/i, '.docx');

    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${docxName}"`,
      },
    });
  } catch (e) {
    console.error('[pdf2word]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    if (tmpPdf) fs.unlink(tmpPdf).catch(() => {});
    if (tmpDocx) fs.unlink(tmpDocx).catch(() => {});
  }
}
