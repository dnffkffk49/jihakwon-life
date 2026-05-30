const https = require('https');

exports.handler = async () => {
  const NOTION_TOKEN = process.env.NOTION_NOTICES_TOKEN;
  const DB_ID = 'aa5b79d4-4f7a-49d5-b1e7-1618490a29e7';

  const body = JSON.stringify({
    sorts: [
      { property: '고정', direction: 'descending' },
      { property: '날짜', direction: 'descending' }
    ]
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/databases/${DB_ID}/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            resolve({ statusCode: res.statusCode, body: data });
            return;
          }
          const notices = parsed.results.map(page => ({
            id: page.id,
            title: page.properties['제목']?.title?.[0]?.text?.content || '(제목 없음)',
            content: page.properties['내용']?.rich_text?.[0]?.text?.content || '',
            category: page.properties['카테고리']?.select?.name || '기타',
            importance: page.properties['중요도']?.select?.name || '🟢 안내',
            date: page.properties['날짜']?.date?.start || '',
            pinned: page.properties['고정']?.checkbox || false
          }));
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notices)
          });
        } catch (e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: e.message }) });
    });

    req.write(body);
    req.end();
  });
};
