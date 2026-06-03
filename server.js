const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.YOUTUBE_API_KEY;

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;

  if (method === 'initialize') {
    return res.json({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'youtube-mcp', version: '1.0.0' }
    });
  }

  if (method === 'tools/list') {
    return res.json({
      tools: [
        {
          name: 'analyze_channel',
          description: 'Analyze a YouTube channel by URL or handle',
          inputSchema: {
            type: 'object',
            properties: {
              channel: { type: 'string', description: 'Channel URL or @handle' }
            },
            required: ['channel']
          }
        },
        {
          name: 'search_channels',
          description: 'Search YouTube channels by keyword',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              maxResults: { type: 'number' }
            },
            required: ['query']
          }
        }
      ]
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;

    if (name === 'analyze_channel') {
      try {
        const handle = args.channel.split('@').pop().split('?')[0];
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${API_KEY}`
        );
        const searchData = await searchRes.json();
        const channelId = searchData.items?.[0]?.snippet?.channelId;

        const statsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${API_KEY}`
        );
        const statsData = await statsRes.json();
        const channel = statsData.items?.[0];

        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video&key=${API_KEY}`
        );
        const videosData = await videosRes.json();

        return res.json({
          content: [{ type: 'text', text: JSON.stringify({
            name: channel?.snippet?.title,
            subscribers: channel?.statistics?.subscriberCount,
            totalViews: channel?.statistics?.viewCount,
            videoCount: channel?.statistics?.videoCount,
            recentVideos: videosData.items?.map(v => ({
              title: v.snippet.title,
              published: v.snippet.publishedAt
            }))
          }, null, 2) }]
        });
      } catch (e) {
        return res.json({ content: [{ type: 'text', text: `Error: ${e.message}` }] });
      }
    }

    if (name === 'search_channels') {
      try {
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(args.query)}&maxResults=${args.maxResults || 5}&key=${API_KEY}`
        );
        const searchData = await searchRes.json();
        return res.json({
          content: [{ type: 'text', text: JSON.stringify(
            searchData.items?.map(i => ({
              name: i.snippet.channelTitle,
              channelId: i.snippet.channelId,
              description: i.snippet.description
            })), null, 2
          ) }]
        });
      } catch (e) {
        return res.json({ content: [{ type: 'text', text: `Error: ${e.message}` }] });
      }
    }
  }

  res.json({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
