exports.handler = async () => {
  const NOTION_TOKEN = process.env.NOTION_NOTICES_TOKEN;
  const DB_ID = 'aa5b79d4-4f7a-49d5-b1e7-1618490a29e7';

  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
        'notion-version': '2022-06-28'
      },
      body: JSON.stringify({
        sorts: [
          { property: '고정', direction: 'descending' },
          { property: '날짜', direction: 'descending' }
        ]
      })
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data })
      };
    }

    const notices = data.results.map(page => ({
      id: page.id,
      title: page.properties['제목']?.title?.[0]?.text?.content || '(제목 없음)',
      content: page.properties['내용']?.rich_text?.[0]?.text?.content || '',
      category: page.properties['카테고리']?.select?.name || '기타',
      importance: page.properties['중요도']?.select?.name || '🟢 안내',
      date: page.properties['날짜']?.date?.start || '',
      pinned: page.properties['고정']?.checkbox || false
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notices)
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message })
    };
  }
};
