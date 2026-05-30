exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DB_ID = 'dfdee845625c48dbbdf60bd92b1f8975';

  try {
    const { hakbun, name, category, content, datetime } = JSON.parse(event.body);

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: DB_ID },
        properties: {
          '제목': { title: [{ text: { content: `[${category}] ${name} 학생 민원` } }] },
          '학번':  { rich_text: [{ text: { content: hakbun } }] },
          '이름':  { rich_text: [{ text: { content: name } }] },
          '분류':  { select: { name: category } },
          '내용':  { rich_text: [{ text: { content: content } }] },
          '접수일시': { rich_text: [{ text: { content: datetime } }] },
          '처리상태': { select: { name: '접수됨' } }
        }
      })
    });

    if (!res.ok) throw new Error(await res.text());
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ success: false, error: e.message }) };
  }
};
