import fs from 'fs';
import path from 'path';
import { parseString } from 'xml2js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const XML_FILE = process.argv[2] || path.join(__dirname, '..', '..', 'Downloads', 'thegroomingfiles.WordPress.2026-01-08.xml');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'content', 'articles');

// Helper to convert WordPress HTML/Gutenberg to Markdown
function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;

  // Remove WordPress Gutenberg comments
  md = md.replace(/<!-- \/?wp:[^>]+-->/g, '');
  md = md.replace(/<!--[^>]*-->/g, '');

  // Convert headings
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');

  // Convert paragraphs
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/p>/gi, '\n\n');

  // Convert line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');

  // Convert bold and italic
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Convert images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // Convert blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    return content.split('\n').map(line => '> ' + line.trim()).join('\n') + '\n\n';
  });

  // Convert lists
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Convert horizontal rules
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');

  // Remove figure/figcaption but keep content
  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '$1');
  md = md.replace(/<figcaption[^>]*>(.*?)<\/figcaption>/gi, '*$1*\n\n');

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.trim();

  return md;
}

// Create slug from title
function createSlug(title, postName, postId) {
  if (postName && postName.trim()) {
    return postName.trim();
  }
  if (title && title.trim()) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60);
  }
  return `post-${postId}`;
}

// Extract text content from CDATA
function getCDATA(item, field) {
  if (!item[field]) return '';
  const val = item[field][0];
  if (typeof val === 'string') return val;
  if (val && val._) return val._;
  return '';
}

// Main import function
async function importWordPress() {
  console.log('Reading WordPress XML export...');
  console.log(`File: ${XML_FILE}`);

  if (!fs.existsSync(XML_FILE)) {
    console.error(`Error: File not found: ${XML_FILE}`);
    console.log('\nUsage: node scripts/import-wordpress.js [path-to-xml-file]');
    process.exit(1);
  }

  const xmlContent = fs.readFileSync(XML_FILE, 'utf-8');

  parseString(xmlContent, { explicitArray: true }, (err, result) => {
    if (err) {
      console.error('Error parsing XML:', err);
      process.exit(1);
    }

    const channel = result.rss.channel[0];
    const items = channel.item || [];

    console.log(`Found ${items.length} total items`);

    // Filter to published posts only
    const posts = items.filter(item => {
      const postType = getCDATA(item, 'wp:post_type');
      const status = getCDATA(item, 'wp:status');
      return postType === 'post' && status === 'publish';
    });

    console.log(`Found ${posts.length} published posts`);

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    let imported = 0;
    let skipped = 0;

    posts.forEach((post, index) => {
      const title = getCDATA(post, 'title') || 'Untitled';
      const content = getCDATA(post, 'content:encoded');
      const postName = getCDATA(post, 'wp:post_name');
      const postId = getCDATA(post, 'wp:post_id');
      const pubDate = getCDATA(post, 'wp:post_date');

      // Skip posts without meaningful content
      if (!content || content.trim().length < 50) {
        skipped++;
        return;
      }

      // Skip untitled posts without content
      if (title === 'Untitled' && !content.trim()) {
        skipped++;
        return;
      }

      const slug = createSlug(title, postName, postId);

      // Extract categories
      const categories = (post.category || [])
        .filter(cat => cat.$ && cat.$.domain === 'category')
        .map(cat => (typeof cat === 'string' ? cat : cat._))
        .filter(Boolean);

      // Extract tags
      const tags = (post.category || [])
        .filter(cat => cat.$ && cat.$.domain === 'post_tag')
        .map(cat => (typeof cat === 'string' ? cat : cat._))
        .filter(Boolean);

      // Convert content to markdown
      const markdownContent = htmlToMarkdown(content);

      // Create excerpt from content
      const excerpt = markdownContent
        .replace(/[#*\[\]()]/g, '')
        .substring(0, 200)
        .trim()
        .replace(/\n/g, ' ') + '...';

      // Build frontmatter
      const frontmatter = {
        title: title.replace(/"/g, '\\"'),
        description: excerpt.replace(/"/g, '\\"'),
        pubDate: pubDate || new Date().toISOString(),
        author: 'Sophie Lewis',
        category: categories.length > 0 ? categories : ['Uncategorised'],
        tags: tags,
        draft: false,
      };

      // Create markdown file
      const fileContent = `---
title: "${frontmatter.title}"
description: "${frontmatter.description}"
pubDate: "${frontmatter.pubDate}"
author: "${frontmatter.author}"
category: ${JSON.stringify(frontmatter.category)}
tags: ${JSON.stringify(frontmatter.tags)}
draft: ${frontmatter.draft}
---

${markdownContent}
`;

      const filename = `${slug}.md`;
      const filepath = path.join(OUTPUT_DIR, filename);

      fs.writeFileSync(filepath, fileContent);
      imported++;

      if (imported % 10 === 0) {
        console.log(`Imported ${imported} articles...`);
      }
    });

    console.log(`\nImport complete!`);
    console.log(`- Imported: ${imported} articles`);
    console.log(`- Skipped: ${skipped} (empty or invalid)`);
    console.log(`\nArticles saved to: ${OUTPUT_DIR}`);
  });
}

importWordPress();
