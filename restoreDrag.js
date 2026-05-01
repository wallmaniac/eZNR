const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AIAssistant.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add drag handlers back to the button
content = content.replace(
    /onClick=\{handleOpen\}/,
    `onMouseDown={onFabMouseDown}
                    onTouchStart={onFabTouchStart}
                    onTouchMove={onFabTouchMove}
                    onTouchEnd={onFabTouchEnd}`
);

// 2. Update the button's style to use fabPos.y, and change hover to be aware of drag
content = content.replace(
    /style=\{\{\s*\.\.\.fabStyles\.fab,\s*right: 0,\s*top: 'auto',\s*bottom: isMobileScreen \? '120px' : '100px',\s*transform: 'none',\s*animation: pulseAnimation \? 'aiPulse 2s ease-in-out infinite' : 'none',\s*\}\}/,
    `style={{
        ...fabStyles.fab,
        right: 0,
        top: fabPos && fabPos.y !== undefined ? fabPos.y : 'auto',
        bottom: fabPos && fabPos.y !== undefined ? 'auto' : (isMobileScreen ? '120px' : '100px'),
        transform: 'none',
        transition: dragRef.current && dragRef.current.dragging ? 'none' : 'transform 0.2s, filter 0.2s, top 0.2s',
        animation: pulseAnimation ? 'aiPulse 2s ease-in-out infinite' : 'none',
    }}`
);

// 3. Ensure the drag handler (handleDragMove) bounds the Y correctly and ignores X
content = content.replace(
    /const handleDragMove = useCallback\(\(clientX, clientY\) => \{[\s\S]*?\}, \[\]\);/,
    `const handleDragMove = useCallback((clientX, clientY) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        const dy = clientY - d.currentY;
        d.currentX = clientX;
        d.currentY = clientY;

        setFabPos(prev => {
            const cur = prev || { y: window.innerHeight - (window.innerWidth < 768 ? 120 : 100) };
            const vh = window.innerHeight;
            const isMob = window.innerWidth < 768;
            const minY = 60;
            const maxY = isMob ? vh - 120 : vh - 60;
            return {
                x: 0,
                y: Math.max(minY, Math.min(cur.y + dy, maxY)),
            };
        });
    }, []);`
);

// 4. Update handleDragEnd to snap only Y if needed (or just save Y)
content = content.replace(
    /const handleDragEnd = useCallback\(\(\) => \{[\s\S]*?\}, \[\]\);/,
    `const handleDragEnd = useCallback(() => {
        const d = dragRef.current;
        d.dragging = false;
        const dist = Math.abs(d.currentX - d.startX) + Math.abs(d.currentY - d.startY);

        if (dist > 15) {
            setFabPos(prev => {
                if (!prev) return prev;
                const vh = window.innerHeight;
                const isMob = window.innerWidth < 768;
                const snapped = {
                    x: 0,
                    y: Math.max(60, Math.min(prev.y, isMob ? vh - 120 : vh - 60)),
                };
                try { localStorage.setItem('eznr_zia_position', JSON.stringify(snapped)); } catch {}
                return snapped;
            });
        }
    }, []);`
);

// 5. Update the close button position
content = content.replace(
    /bottom: isMobileScreen \? 75 : 20,\s*right: isMobileScreen \? 12 : 20,/,
    `bottom: isMobileScreen ? 75 : 30,
        right: isMobileScreen ? 12 : 30,`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Drag and close button updated.');
