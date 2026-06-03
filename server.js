const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.YOUTUBE_API_KEY;

// OAuth endpoints для Claude
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const base = 'https://youtube-mcp-lkmc.onrender.com';
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/auth`,
    token_endpoint: `${base}/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code']
  });
});

app.get('/auth', (req, res) => {
  const { redirect_uri, state } = req.query;
  res.redirect(`${redirect_uri}?code=ok&state=${state}`);
});

app.post('/token', (req, res) => {
  res.json({ access_token: 'ok', token_type: 'bearer' });
});

// MCP endpoint
app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;

  if (method === 'tools/list') {
    return res.json({
      tools: [
        {
          name: 'analyze_channel',
          description: 'Analyze a YouTube channel',
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
              maxResults: { type: 'number', description: 'Number of results' }
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
        let channelId = args.channel;
        const handle = channelId.split('@').pop().split('?')[0];
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${API_KEY}`
        );
        const searchData = await searchRes.json();
        channelId = searchData.items?.[0]?.snippet?.channelId;

        const statsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${API_KEY}`
        );
        const statsData = await statsRes.json();
        const channel = statsData.items?.[0];

        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video&key=${API_KEY}`
        );
        const videosData = await videosRes.json();

        const result = {
          name: channel?.snippet?.title,
          subscribers: channel?.statistics?.subscriberCount,
          totalViews: channel?.statistics?.viewCount,
          videoCount: channel?.statistics?.videoCount,
          recentVideos: videosData.items?.map(v => ({
            title: v.snippet.title,
            published: v.snippet.publishedAt
          }))
        };

        return res.json({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        });
      } catch (e) {
        return res.json({
          content: [{ type: 'text', text: `Error: ${e.message}` }]
        });
      }
    }

    if (name === 'search_channels') {
      try {
        const searchRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(args.query)}&maxResults=${args.maxResults || 5}&key=${API_KEY}`
        );
        const searchData = await searchRes.json();
        const channels = searchData.items?.map(item => ({
          name: item.snippet.channelTitle,
          channelId: item.snippet.channelId,
          description: item.snippet.description
        }));
        return res.json({
          content: [{ type: 'text', text: JSON.stringify(channels, null, 2) }]
        });
      } catch (e) {
        return res.json({
          content: [{ type: 'text', text: `Error: ${e.message}` }]
        });
      }
    }
  }

  res.json({ error: 'Unknown method' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
