import fs from 'fs';
import path from 'path';
import { parseString } from 'xml2js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const XML_FILE = process.argv[2] || path.join(__dirname, '..', '..', 'Downloads', 'thegroomingfiles.WordPress.2026-01-08.xml');
const PAGES_DIR = path.join(__dirname, '..', 'src', 'content', 'pages');

function htmlToMarkdown(html) {
  if (!html) return '';
  let md = html;
  md = md.replace(/<!-- \/?wp:[^>]+-->/g, '');
  md = md.replace(/<!--[^>]*-->/g, '');
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    return content.split('\n').map(line => '> ' + line.trim()).join('\n') + '\n\n';
  });
  md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
  md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<hr[^>]*\/?>/gi, '\n---\n\n');
  md = md.replace(/<figure[^>]*>([\s\S]*?)<\/figure>/gi, '$1');
  md = md.replace(/<figcaption[^>]*>(.*?)<\/figcaption>/gi, '*$1*\n\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function getCDATA(item, field) {
  if (!item[field]) return '';
  const val = item[field][0];
  if (typeof val === 'string') return val;
  if (val && val._) return val._;
  return '';
}

async function importPages() {
  console.log('Importing WordPress pages...');

  const xmlContent = fs.readFileSync(XML_FILE, 'utf-8');

  parseString(xmlContent, { explicitArray: true }, (err, result) => {
    if (err) {
      console.error('Error:', err);
      process.exit(1);
    }

    const items = result.rss.channel[0].item || [];

    // Get published pages
    const pages = items.filter(item => {
      const postType = getCDATA(item, 'wp:post_type');
      const status = getCDATA(item, 'wp:status');
      return postType === 'page' && status === 'publish';
    });

    console.log(`Found ${pages.length} published pages`);

    if (!fs.existsSync(PAGES_DIR)) {
      fs.mkdirSync(PAGES_DIR, { recursive: true });
    }

    pages.forEach(page => {
      const title = getCDATA(page, 'title') || 'Untitled';
      const content = getCDATA(page, 'content:encoded');
      const postName = getCDATA(page, 'wp:post_name');
      const pubDate = getCDATA(page, 'wp:post_date');

      if (!content || content.trim().length < 20) return;

      const slug = postName || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const markdownContent = htmlToMarkdown(content);

      const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
pubDate: "${pubDate}"
---

${markdownContent}
`;

      const filepath = path.join(PAGES_DIR, `${slug}.md`);
      fs.writeFileSync(filepath, fileContent);
      console.log(`Imported: ${title} -> ${slug}.md`);
    });

    console.log('\nPages imported!');
  });
}

importPages();
