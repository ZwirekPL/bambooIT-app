/**
 * Seed: 18 blog articles from "posty na bloga.md"
 * Run: cd packages/database && npx ts-node --transpile-only prisma/seed-blog-articles.ts
 * Idempotent — upserts on slug.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ParsedPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  readTime: number;
  faq: { question: string; answer: string }[];
}

function parseMarkdownFile(filePath: string): ParsedPost[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  // Find post boundaries: lines matching "N\. Title"
  const postStarts: { index: number; num: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^(\d+)\\\.\s+(.+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      // Only full posts (1-18 have content, 19+ are just titles)
      if (num >= 1 && num <= 18) {
        postStarts.push({ index: i, num });
      }
    }
  }

  // Some lines inside posts also match "N. " pattern (e.g., "1. Zwiększ ilość białka")
  // Filter: only keep entries where next line is empty and line after that is "Kategoria:"
  const validStarts = postStarts.filter(({ index }) => {
    // Check if within next few lines there's a "Kategoria:" line
    for (let j = index + 1; j < Math.min(index + 5, lines.length); j++) {
      if (lines[j].startsWith('Kategoria:')) return true;
    }
    return false;
  });

  const posts: ParsedPost[] = [];

  for (let p = 0; p < validStarts.length; p++) {
    const startLine = validStarts[p].index;
    const endLine = p + 1 < validStarts.length
      ? validStarts[p + 1].index
      : lines.length;

    const block = lines.slice(startLine, endLine);
    const post = parsePostBlock(block);
    if (post) posts.push(post);
  }

  return posts;
}

function parsePostBlock(block: string[]): ParsedPost | null {
  // Extract metadata
  let title = '';
  let category = '';
  let slug = '';
  let seoTitle = '';
  let metaDesc = '';

  // First line: "N\. Title"
  const titleMatch = block[0].match(/^\d+\\\.\s+(.+)/);
  if (!titleMatch) return null;
  title = titleMatch[1];

  // Find metadata lines
  for (let i = 1; i < Math.min(15, block.length); i++) {
    const line = block[i].trim();
    if (line.startsWith('Kategoria:')) category = line.replace('Kategoria:', '').trim();
    if (line.startsWith('Slug:')) slug = line.replace('Slug:', '').trim();
    if (line.startsWith('SEO Title:')) seoTitle = line.replace('SEO Title:', '').trim();
    if (line.startsWith('Meta description:')) metaDesc = line.replace('Meta description:', '').trim();
  }

  if (!slug || !category) return null;

  // Find where content starts (after Meta description line)
  let contentStartIdx = 0;
  for (let i = 0; i < Math.min(15, block.length); i++) {
    if (block[i].trim().startsWith('Meta description:')) {
      contentStartIdx = i + 1;
      break;
    }
  }

  // Skip empty lines after meta
  while (contentStartIdx < block.length && block[contentStartIdx].trim() === '') {
    contentStartIdx++;
  }

  // Skip the repeated title line
  if (contentStartIdx < block.length) {
    const possibleTitle = block[contentStartIdx].trim();
    if (possibleTitle === title || possibleTitle === seoTitle || possibleTitle.includes(title.substring(0, 20))) {
      contentStartIdx++;
    }
  }

  // Skip "Wstęp" line if present
  if (contentStartIdx < block.length && block[contentStartIdx].trim() === 'Wstęp') {
    contentStartIdx++;
  }

  // Skip empty lines
  while (contentStartIdx < block.length && block[contentStartIdx].trim() === '') {
    contentStartIdx++;
  }

  // Collect remaining lines
  const contentLines = block.slice(contentStartIdx);

  // Find "Spis treści" section and extract header names
  let spisStartIdx = -1;
  const headers: string[] = [];

  for (let i = 0; i < contentLines.length; i++) {
    if (contentLines[i].trim() === 'Spis treści') {
      spisStartIdx = i;
      // Collect headers: non-empty lines until we see "FAQ" or "CTA" in the TOC
      for (let j = i + 1; j < contentLines.length; j++) {
        const line = contentLines[j].trim();
        if (line === '') continue;
        if (line === 'FAQ' || line === 'CTA') break;
        headers.push(line);
      }
      break;
    }
  }

  // Find the end of the Spis treści section: the second occurrence of headers[0]
  // (first is in TOC, second is the actual section header in content)
  let spisEndIdx = -1;
  if (spisStartIdx !== -1 && headers.length > 0) {
    let occurrences = 0;
    for (let i = spisStartIdx + 1; i < contentLines.length; i++) {
      if (contentLines[i].trim() === headers[0]) {
        occurrences++;
        if (occurrences === 2) {
          spisEndIdx = i;
          break;
        }
      }
    }
    // If no second occurrence found, try to find end by looking for "FAQ" line in TOC
    // and then the next non-empty line after blank lines
    if (spisEndIdx === -1) {
      for (let i = spisStartIdx + 1; i < contentLines.length; i++) {
        if (contentLines[i].trim() === 'FAQ') {
          // Skip blank lines after FAQ in TOC
          for (let j = i + 1; j < contentLines.length; j++) {
            if (contentLines[j].trim() !== '') {
              spisEndIdx = j;
              break;
            }
          }
          break;
        }
      }
    }
  }

  // Find FAQ Q&A section and CTA (search from end)
  let faqStartIdx = -1;
  let ctaStartIdx = -1;
  for (let i = contentLines.length - 1; i >= 0; i--) {
    if (contentLines[i].trim() === 'CTA') ctaStartIdx = i;
    if (contentLines[i].trim() === 'FAQ' && i < (ctaStartIdx === -1 ? contentLines.length : ctaStartIdx)) {
      // Verify this is the Q&A FAQ (not the TOC entry): next non-empty line should end with "?"
      for (let j = i + 1; j < contentLines.length; j++) {
        const nextLine = contentLines[j].trim();
        if (nextLine === '') continue;
        if (nextLine.endsWith('?')) {
          faqStartIdx = i;
        }
        break;
      }
      if (faqStartIdx !== -1) break;
    }
  }

  // Parse FAQ Q&A pairs
  const faq: { question: string; answer: string }[] = [];
  if (faqStartIdx !== -1) {
    const faqEnd = ctaStartIdx !== -1 ? ctaStartIdx : contentLines.length;
    const faqLines = contentLines.slice(faqStartIdx + 1, faqEnd)
      .map(l => l.trim())
      .filter(l => l !== '');

    let currentQ = '';
    for (const line of faqLines) {
      if (line.endsWith('?')) {
        currentQ = line;
      } else if (currentQ) {
        faq.push({ question: currentQ, answer: line });
        currentQ = '';
      }
    }
  }

  // Build body: intro (before Spis treści) + content (after Spis treści)
  const bodyEndIdx = faqStartIdx !== -1 ? faqStartIdx : contentLines.length;

  const cleanedBody: string[] = [];

  // Add intro (before Spis treści)
  const introEnd = spisStartIdx !== -1 ? spisStartIdx : bodyEndIdx;
  for (let i = 0; i < introEnd; i++) {
    cleanedBody.push(contentLines[i]);
  }

  // Add content (after Spis treści, skip the TOC block itself)
  const contentStart = spisEndIdx !== -1 ? spisEndIdx : introEnd;
  for (let i = contentStart; i < bodyEndIdx; i++) {
    const line = contentLines[i].trim();
    // Convert section headers to ## Markdown
    if (headers.includes(line)) {
      cleanedBody.push('');
      cleanedBody.push(`## ${line}`);
      cleanedBody.push('');
    } else {
      cleanedBody.push(contentLines[i]);
    }
  }

  // Build final markdown content
  let content = cleanedBody.join('\n').trim();

  // Clean up excessive empty lines
  content = content.replace(/\n{3,}/g, '\n\n');

  // Estimate read time (words / 200)
  const wordCount = content.split(/\s+/).length;
  const readTime = Math.max(5, Math.ceil(wordCount / 200));

  // Use metaDesc as excerpt
  const excerpt = metaDesc || title;

  return {
    slug,
    title: seoTitle || title,
    excerpt,
    content,
    category,
    author: 'Zespół e-dietetyk.com',
    readTime,
    faq,
  };
}

async function main() {
  const mdPath = path.resolve(
    __dirname,
    '../../../apps/web/public/blog/images/posty na bloga.md'
  );

  if (!fs.existsSync(mdPath)) {
    console.error(`File not found: ${mdPath}`);
    process.exit(1);
  }

  console.log('Parsing blog posts from markdown file...');
  const posts = parseMarkdownFile(mdPath);
  console.log(`Found ${posts.length} posts to seed.`);

  for (const post of posts) {
    console.log(`  Upserting: ${post.slug} (${post.category})`);

    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        author: post.author,
        readTime: post.readTime,
        faq: post.faq.length > 0 ? post.faq : undefined,
        published: true,
      },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        author: post.author,
        readTime: post.readTime,
        publishedAt: new Date(),
        published: true,
        faq: post.faq.length > 0 ? post.faq : undefined,
      },
    });
  }

  console.log(`\nDone! ${posts.length} blog posts upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
