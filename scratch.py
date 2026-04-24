import sys
filePath = r'c:\Users\zzida\Desktop\znrba\app\src\app\dashboard\equipment\page.js'
with open(filePath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    '<div className="card-body">\n                    <div style={{ display: \'flex\', gap: 12, marginBottom: 16, alignItems: \'center\', flexWrap: \'wrap\' }}>',
    '<div className="card-body" style={{ padding: 0 }}>\n                    <div className="scrollable-toolbar" style={{ padding: \'8px 16px\', display: \'flex\', gap: 14, alignItems: \'center\' }}>'
)
# Add fallback for \r\n
content = content.replace(
    '<div className="card-body">\n                    <div style={{ display: \'flex\', gap: 12, marginBottom: 16, alignItems: \'center\', flexWrap: \'wrap\' }}>'.replace('\n', '\r\n'),
    '<div className="card-body" style={{ padding: 0 }}>\n                    <div className="scrollable-toolbar" style={{ padding: \'8px 16px\', display: \'flex\', gap: 14, alignItems: \'center\' }}>'.replace('\n', '\r\n')
)

with open(filePath, 'w', encoding='utf-8') as f:
    f.write(content)
