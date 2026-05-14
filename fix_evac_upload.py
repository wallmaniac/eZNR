import re

def process_file(filepath, is_drills):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Add upload state logic
    if is_drills:
        content = content.replace("const handleSave = async () => {", "const [uploadingDoc, setUploadingDoc] = useState(false);\n    const [uploadProgress, setUploadProgress] = useState(0);\n\n    const handleSave = async () => {")
    else:
        content = content.replace("const handleSave = async () => {", "const [uploadingDoc, setUploadingDoc] = useState(false);\n    const [uploadProgress, setUploadProgress] = useState(0);\n\n    const handleSave = async () => {")

    # 2. Add storage hook
    content = content.replace("import { uploadDocument } from '@/lib/storageService';", "")
    content = content.replace("import { getAll, create, update, remove, COLLECTIONS, formatDate", "import { uploadDocument } from '@/lib/storageService';\nimport { getActiveCompanyId, getAll, create, update, remove, COLLECTIONS, formatDate")
    
    # 3. Change file input logic
    upload_block_old = r"""<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={e => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length === 0) return;
                                            
                                            const newDocs = [...(formData.documents || [])];
                                            let processed = 0;
                                            
                                            files.forEach(file => {
                                                if (file.size > 10 * 1024 * 1024) { alert(hr ? 'Maksimalna veličina fajla je 10MB!' : bs ? 'Maksimalna veličina fajla je 10MB!' : 'Max file size is 10MB!'); return; }
                                                const reader = new FileReader();
                                                reader.onload = () => { 
                                                    newDocs.push({ url: reader.result, name: file.name });
                                                    processed++;
                                                    if (processed === files.length) {
                                                        set('documents', newDocs);
                                                    }
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                            e.target.value = ''; // reset input
                                        }} style={{ fontSize: '0.85rem' }} />"""

    upload_block_new = r"""<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={async e => {
                                            const files = Array.from(e.target.files || []);
                                            if (files.length === 0) return;
                                            
                                            setUploadingDoc(true);
                                            setUploadProgress(0);
                                            const cid = getActiveCompanyId();
                                            const newDocs = [...(formData.documents || [])];
                                            
                                            try {
                                                for (let i = 0; i < files.length; i++) {
                                                    const file = files[i];
                                                    if (file.size > 15 * 1024 * 1024) { 
                                                        alert(hr ? `Fajl ${file.name} je prevelik (max 15MB)!` : bs ? `Fajl ${file.name} je prevelik (max 15MB)!` : `File ${file.name} is too large (max 15MB)!`); 
                                                        continue; 
                                                    }
                                                    
                                                    const res = await uploadDocument(file, cid, 'evacuations', (prog) => {
                                                        setUploadProgress(Math.round(((i / files.length) * 100) + (prog / files.length)));
                                                    });
                                                    newDocs.push({ url: res.url, name: file.name });
                                                }
                                                set('documents', newDocs);
                                            } catch (err) {
                                                console.error("Upload error", err);
                                                alert(bs ? "Greška prilikom uploada dokumenta!" : "Error uploading document!");
                                            } finally {
                                                setUploadingDoc(false);
                                                e.target.value = ''; // reset input
                                            }
                                        }} style={{ fontSize: '0.85rem' }} disabled={uploadingDoc} />
                                        {uploadingDoc && (
                                            <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--primary)' }}>
                                                {bs ? 'Učitavanje dokumenata...' : 'Uploading documents...'} {uploadProgress}%
                                            </div>
                                        )}"""

    content = content.replace(upload_block_old, upload_block_new)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation\page.js', False)
process_file(r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\evacuation-drills\page.js', True)
