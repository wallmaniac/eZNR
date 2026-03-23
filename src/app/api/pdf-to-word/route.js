import { NextResponse } from 'next/server';
import path from 'path';
import os from 'os';

// PYTHON_CONVERTER_URL = external service (Railway/Render) e.g. https://my-app.railway.app
// If not set → use local Python subprocess (dev only)
const EXTERNAL_URL = process.env.PYTHON_CONVERTER_URL;

async function convertViaExternal(buffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), filename);
  const resp = await fetch(`${EXTERNAL_URL}/convert/pdf-to-word`, {
    method: 'POST',
    body: form,
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => resp.status.toString());
    throw new Error(`Remote converter error: ${txt}`);
  }
  return resp.arrayBuffer();
}

async function convertViaLocalPython(buffer, filename) {
  // Dynamic import — only available in Node.js, not Edge runtime
  const { exec } = await import('child_process');
  const { promises: fs } = await import('fs');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  const id = `eznr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tmpDir = os.tmpdir();
  const tmpPdf = path.join(tmpDir, `${id}.pdf`);
  const tmpDocx = path.join(tmpDir, `${id}.docx`);

  try {
    await fs.writeFile(tmpPdf, Buffer.from(buffer));
    const scriptPath = path.join(process.cwd(), 'scripts', 'pdf2word.py');
    await execAsync(`python "${scriptPath}" "${tmpPdf}" "${tmpDocx}"`, { timeout: 60000 });
    const docxBuf = await fs.readFile(tmpDocx);
    return docxBuf.buffer;
  } catch (e) {
    const msg = e.stderr || e.message || '';
    if (msg.includes('pdf2docx') || msg.includes('No module')) {
      const err = new Error(msg);
      err.setupRequired = true;
      throw err;
    }
    throw e;
  } finally {
    const { promises: fs2 } = await import('fs');
    fs2.unlink(tmpPdf).catch(() => {});
    fs2.unlink(tmpDocx).catch(() => {});
  }
}

export async function POST(request) {
  let buffer, filename;
  try {
    const form = await request.formData();
    const file = form.get('file');
    filename = form.get('filename') || 'document.pdf';
    buffer = await file.arrayBuffer();
  } catch {
    return NextResponse.json({ error: 'Could not read uploaded file' }, { status: 400 });
  }

  try {
    const docxBuffer = EXTERNAL_URL
      ? await convertViaExternal(buffer, filename)
      : await convertViaLocalPython(buffer, filename);

    const docxName = filename.replace(/\.pdf$/i, '.docx');
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${docxName}"`,
      },
    });
  } catch (e) {
    console.error('[pdf2word]', e);
    if (e.setupRequired) {
      return NextResponse.json({ error: 'pdf2docx not installed', setupRequired: true }, { status: 503 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
