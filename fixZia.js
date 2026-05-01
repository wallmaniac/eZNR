const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update useEffect
content = content.replace(
    /useEffect\(\(\) => \{\s*try \{\s*const saved = JSON\.parse\(localStorage\.getItem\('eznr_zia_position'\)\);\s*if \(saved[\s\S]*?\} catch \{ \/\* use default \*\/ \}\s*\}, \[\]\);/,
    `useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('eznr_zia_position'));
            if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const isMob = vw < 768;
                const minX = 0;
                const maxX = vw - 60; // 60 is approx width of the edge tab
                const minY = 60;
                const maxY = isMob ? vh - 120 : vh - 60;
                setFabPos({
                    x: saved.x < vw / 2 ? minX : maxX,
                    y: Math.max(minY, Math.min(saved.y, maxY)),
                });
            }
        } catch { /* use default */ }
    }, []);`
);

// 2. Update handleDragMove
content = content.replace(
    /const handleDragMove = useCallback\(\(clientX, clientY\) => \{[\s\S]*?\}, \[\]\);/,
    `const handleDragMove = useCallback((clientX, clientY) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        const dx = clientX - d.currentX;
        const dy = clientY - d.currentY;
        d.currentX = clientX;
        d.currentY = clientY;

        setFabPos(prev => {
            const cur = prev || { x: window.innerWidth - 60, y: window.innerHeight - 130 };
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const isMob = vw < 768;
            const minX = 0;
            const maxX = vw - 60;
            const minY = 60;
            const maxY = isMob ? vh - 120 : vh - 60;
            return {
                x: Math.max(minX, Math.min(cur.x + dx, maxX)),
                y: Math.max(minY, Math.min(cur.y + dy, maxY)),
            };
        });
    }, []);`
);

// 3. Update handleDragEnd
content = content.replace(
    /const handleDragEnd = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/,
    `const handleDragEnd = useCallback(() => {
        const d = dragRef.current;
        d.dragging = false;

        const dist = Math.abs(d.currentX - d.startX) + Math.abs(d.currentY - d.startY);

        if (dist > 15) {
            setFabPos(prev => {
                if (!prev) return prev;
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const isMob = vw < 768;
                
                const snapped = {
                    x: prev.x < vw / 2 ? 0 : vw - 60,
                    y: Math.max(60, Math.min(prev.y, isMob ? vh - 120 : vh - 60)),
                };
                try { localStorage.setItem('eznr_zia_position', JSON.stringify(snapped)); } catch {}
                return snapped;
            });
        }
    }, []);`
);

// 4. Update fabPosition default
content = content.replace(
    /const fabPosition = fabPos\s*\?\s*\{ position: 'fixed', left: fabPos\.x, top: fabPos\.y, bottom: 'auto', right: 'auto' \}\s*:\s*\{ position: 'fixed', bottom: 80, right: 16 \};/,
    `const fabPosition = fabPos
        ? { position: 'fixed', left: fabPos.x, top: fabPos.y, bottom: 'auto', right: 'auto' }
        : { position: 'fixed', bottom: 80, right: 0 };`
);

// 5. Update inline style
content = content.replace(
    /style=\{\{\s*\.\.\.fabStyles\.fab,\s*\.\.\.fabPosition,\s*animation: pulseAnimation \? 'aiPulse 2s ease-in-out infinite' : 'none',\s*transition: dragRef\.current\.dragging \? 'none' : 'all 0\.3s cubic-bezier\(0\.4, 0, 0\.2, 1\)',\s*touchAction: 'none',\s*cursor: 'grab',\s*\}\}/,
    `style={{
        ...fabStyles.fab,
        ...fabPosition,
        borderRadius: isFabLeft ? '0 24px 24px 0' : '24px 0 0 24px',
        borderLeft: isFabLeft ? '1px solid rgba(0, 191, 166, 0.3)' : 'none',
        borderRight: !isFabLeft ? '1px solid rgba(0, 191, 166, 0.3)' : 'none',
        animation: pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
        transition: dragRef.current.dragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        touchAction: 'none',
        cursor: 'grab',
    }}`
);

// 6. Update fabStyles.fab
content = content.replace(
    /fab: \{\s*position: 'fixed',\s*bottom: 24,\s*right: 24,\s*zIndex: 1001,\s*display: 'flex',\s*flexDirection: 'row',\s*alignItems: 'center',\s*justifyContent: 'center',\s*padding: '6px 14px',\s*borderRadius: 20,\s*background: 'rgba\(0, 191, 166, 0\.15\)',\s*backdropFilter: 'blur\(8px\)',\s*WebkitBackdropFilter: 'blur\(8px\)',\s*border: '1px solid rgba\(0, 191, 166, 0\.3\)',\s*color: '#009985',\s*cursor: 'grab',\s*boxShadow: '0 4px 16px rgba\(0,191,166,0\.2\)',\s*transition: 'transform 0\.2s, box-shadow 0\.2s',\s*gap: 6,\s*whiteSpace: 'nowrap',\s*\}/,
    `fab: {
        position: 'fixed',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 12px',
        background: 'rgba(0, 191, 166, 0.15)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid rgba(0, 191, 166, 0.3)',
        borderBottom: '1px solid rgba(0, 191, 166, 0.3)',
        color: '#009985',
        cursor: 'grab',
        boxShadow: '0 4px 16px rgba(0,191,166,0.2)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        gap: 6,
        whiteSpace: 'nowrap',
    }`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done!');
