import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// ── Exa Search Tool ──────────────────────────────────────────────────────────
// Replaces the "Basic" DuckDuckGo keyword search with a "Neural" search.
// It understands the semantics of the idea and finds high-signal URLs
// (startups, repos, docs) instead of just SEO-bloated blogs.

async function callExa(query: string, location?: string) {
  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    throw new Error('EXA_API_KEY not found in environment. Please add it to your .env file.');
  }

  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query,
      type: 'auto',
      numResults: 5,
      ...(location && { userLocation: location }),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Exa API error: ${err}`);
  }

  const data = await response.json();
  return data.results || [];
}

export const searchTool = createTool({
  id: 'search-tool',
  description: `Uses Exa's Neural Search to find high-signal URLs for a product idea.
    It understands intent and surfaces competitive landscapes, technical prior art, 
    and niche market signals across both Global and Indian ecosystems.
    CALL THIS FIRST to get the most relevant 10-15 URLs for the researchAgent to crawl.`,
  inputSchema: z.object({
    idea: z.string().describe('The product idea to research semantically'),
  }),
  outputSchema: z.object({
    keywords: z.string().describe('The autoprompt query used'),
    urls: z.array(z.object({
      url:   z.string(),
      title: z.string().optional(),
      score: z.number().optional(),
      label: z.string().optional(),
    })).describe('Semantically relevant URLs surfaced by Exa'),
  }),

  execute: async ({ idea }) => {
    console.log(`\n[ExaSearch] Analysing idea: "${idea.substring(0, 50)}..."`);
    
    const results: any[] = [];
    const seenUrls = new Set<string>();

    try {
      // 1. Global Neural Search (Competitive Landscape)
      console.log(`[ExaSearch] 🌍 Firing Global Neural Search...`);
      const globalResults = await callExa(`Here is a high-signal landing page or technical documentation for a project like this: ${idea}`);
      
      // 2. India-Bias Search (Regional Ecosystem)
      console.log(`[ExaSearch] 🇮🇳 Firing India-Biased Neural Search...`);
      const indiaResults = await callExa(`Current startups and companies in India solving this exact problem or operating in this niche: ${idea}`, 'IN');

      // 3. Community/Prior Art Search
      console.log(`[ExaSearch] 💬 Looking for prior art and community discussions...`);
      const devResults = await callExa(`Discussions, reviews, or open-source projects for: ${idea}. Site:reddit.com OR site:github.com`);

      const allRaw = [
        ...globalResults.map((r: any) => ({ ...r, label: '🌍 Global' })),
        ...indiaResults.map((r: any) => ({ ...r, label: '🇮🇳 India' })),
        ...devResults.map((r: any) => ({ ...r, label: '💬 Community' }))
      ];

      for (const res of allRaw) {
        if (!seenUrls.has(res.url)) {
          seenUrls.add(res.url);
          results.push({
            url: res.url,
            title: res.title,
            score: res.score,
            label: res.label,
          });
        }
      }

      console.log(`[ExaSearch] ✅ Surfaced ${results.length} high-signal URLs.\n`);

      return {
        keywords: idea,
        urls: results,
      };

    } catch (error: any) {
      console.error(`[ExaSearch] Error: ${error.message}`);
      throw error;
    }
  },
});
