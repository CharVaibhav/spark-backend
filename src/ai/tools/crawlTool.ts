import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { PlaywrightCrawler, Configuration } from 'crawlee';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';

export const crawlTool = createTool({
  id: 'crawl-tool',
  description: 'A tool to crawl a webpage URL using Playwright and extract its title and main text content. Perfect for scraping deep-web data, competitors, or Reddit.',
  inputSchema: z.object({
    url: z.string().url().describe('The full URL of the website to crawl'),
  }),
  outputSchema: z.object({
    title: z.string(),
    content: z.string(),
    error: z.string().optional(),
  }),
  execute: async ({ url }) => {
    let pageTitle = '';
    let pageContent = '';
    let errorMessage = '';

    // Each crawl gets its own isolated temp directory — prevents lock conflicts
    // when the agent calls this tool multiple times in parallel.
    const uniqueStorageDir = join(tmpdir(), `crawlee-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    const config = new Configuration({
      storageClientOptions: {
        localDataDirectory: uniqueStorageDir,
      },
    });

    const crawler = new PlaywrightCrawler({
      requestHandler: async ({ page, request, log }) => {
        log.info(`Processing ${request.url}...`);
        try {
          pageTitle = await page.title();
          pageContent = await page.evaluate(() => document.body.innerText);
        } catch (error: any) {
          log.error(`Error processing page: ${error.message}`);
          errorMessage = error.message;
        }
      },
      maxRequestsPerCrawl: 1,
      headless: true,
      // Suppress verbose crawlee logs for cleaner output
      requestHandlerTimeoutSecs: 30,
    }, config);

    try {
      await crawler.run([url]);
    } catch (e: any) {
      errorMessage = e.message;
    } finally {
      // Clean up the temp storage directory after each crawl
      await rm(uniqueStorageDir, { recursive: true, force: true }).catch(() => {});
    }

    return {
      title: pageTitle,
      content: pageContent ? pageContent.substring(0, 10000) : '',
      ...(errorMessage && { error: errorMessage }),
    };
  },
});
