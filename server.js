const express = require('express');
const app = express();
app.use(express.json());

const API_KEY = process.env.YOUTUBE_API_KEY;

app.post('/mcp', async (req, res) => {
  const { method, params } = req.body;
  
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
          description: 'Search YouTube channels by keyword/niche',
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
        
        // Get channel by handle
        if (channelId.includes('@') || channelId.includes('youtube.com')) {
          const handle = channelId.split('@').pop().split('?')[0];
          const searchRes = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${handle}&key=${API_KEY}`
          );
          const searchData = await searchRes.json();
          channelId = searchData.items?.[0]?.snippet?.channelId;
        }

        // Get channel stats
        const statsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet,brandingSettings&id=${channelId}&key=${API_KEY}`
        );
        const statsData = await statsRes.json();
        const channel = statsData.items?.[0];

        // Get recent videos
        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=5&type=video&key=${API_KEY}`
        );
        const videosData = await videosRes.json();

        const result = {
          name: channel?.snippet?.title,
          description: channel?.snippet?.description,
          subscribers: channel?.statistics?.subscriberCount,
          totalViews: channel?.statistics?.viewCount,
          videoCount: channel?.statistics?.videoCount,
          country: channel?.snippet?.country,
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
app.listen(PORT, () => console.log(`YouTube MCP server running on port ${PORT}`));
