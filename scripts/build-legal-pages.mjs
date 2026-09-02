// Builds the hosted Privacy Policy and Terms of Service pages from the same
// dictionary the in-app Legal screen reads, so the two copies cannot drift.
//
//   node scripts/build-legal-pages.mjs
//
// Output lands in docs/legal/ as .html and, when a Chrome or Edge binary can be
// found, .pdf rendered from that same html.
//
// Upload the **PDFs** to the `legal` storage bucket: Supabase serves an .html
// object from a public bucket as text/plain with nosniff, so an .html URL shows
// raw source rather than a page (see supabase/19_legal_docs.sql). The .html is
// what you deploy instead if you move to a real static host, where it is the
// better artefact — it reflows on a phone and a PDF does not.
//
// Then point EXPO_PUBLIC_PRIVACY_POLICY_URL / EXPO_PUBLIC_TERMS_URL at whatever
// you uploaded.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dict = JSON.parse(readFileSync(resolve(root, 'src/i18n/en.json'), 'utf8'));
const SUPPORT_EMAIL = 'support@rishtaandrang.app';

const PRIVACY_SECTIONS = [
  'whoWeAre', 'dataWeCollect', 'howWeUse', 'legalBasis', 'sharing', 'retention',
  'yourRights', 'security', 'ageLimit', 'changes', 'contact',
];
const TERMS_SECTIONS = [
  'eligibility', 'yourAccount', 'acceptableUse', 'prohibited', 'contentLicence',
  'safety', 'subscriptions', 'termination', 'disclaimers', 'liability',
  'disputes', 'changes',
];

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const fill = (s) => escapeHtml(s.replace(/\{email\}/g, SUPPORT_EMAIL));

// Blank lines separate paragraphs in the dictionary bodies.
const paragraphs = (body) =>
  fill(body).split(/\n\s*\n/).map((p) => `      <p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');

const linkEmail = (html) =>
  html.replace(new RegExp(SUPPORT_EMAIL, 'g'), `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`);

const STYLE = `
    :root { color-scheme: light dark; --ink: #1c1b1a; --muted: #5d5a56; --bg: #fbf9f6; --card: #fff; --line: #e6e0d8; --accent: #2f7f7d; }
    @media (prefers-color-scheme: dark) {
      :root { --ink: #ece9e4; --muted: #a9a49d; --bg: #14140f; --card: #1d1d18; --line: #33322c; --accent: #6fbdb8; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; }
    header { border-bottom: 1px solid var(--line); padding-bottom: 1.5rem; margin-bottom: 2rem; }
    h1 { font-size: 1.9rem; margin: 0 0 .35rem; letter-spacing: -0.02em; }
    .updated { color: var(--muted); font-size: .85rem; margin: 0; }
    .intro { font-size: 1.05rem; }
    section { margin-top: 2.25rem; }
    h2 { font-size: 1.12rem; margin: 0 0 .5rem; }
    p { margin: 0 0 .9rem; color: var(--muted); }
    .intro, h2 { color: var(--ink); }
    a { color: var(--accent); }
    footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--line); color: var(--muted); font-size: .85rem; }
`.trim();

function page({ file, title, intro, sections, group }) {
  const body = sections
    .map((id) => {
      const clause = dict.legal[group][id];
      return `    <section>\n      <h2>${fill(clause.title)}</h2>\n${paragraphs(clause.body)}\n    </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · ${escapeHtml(dict.appName)}</title>
  <style>
${STYLE}
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <p class="updated">${escapeHtml(dict.appName)} · ${fill(dict.legal.lastUpdated)}</p>
    </header>
    <p class="intro">${fill(intro)}</p>
${body}
    <footer>${fill(dict.legal.contactLine)}</footer>
  </main>
</body>
</html>
`;

  const out = resolve(root, 'docs/legal', file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, linkEmail(html), 'utf8');
  console.log('wrote', out);
  return out;
}

// Chrome and Edge both print to PDF headlessly with no extra dependency. If
// neither is installed the html is still written — only the PDF step is skipped,
// with a note, so this stays runnable in CI.
const BROWSER_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

function findBrowser() {
  return BROWSER_CANDIDATES.find((candidate) => existsSync(candidate)) ?? null;
}

function toPdf(browser, htmlPath) {
  const pdfPath = htmlPath.replace(/\.html$/, '.pdf');
  execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    // The default header prints the file:// path and today's date across the
    // top of a legal document, which is not something to hand a store reviewer.
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });
  console.log('wrote', pdfPath);
}

const written = [
  page({
    file: 'privacy-policy.html',
    title: dict.legal.privacyPolicyTitle,
    intro: dict.legal.privacyIntro,
    sections: PRIVACY_SECTIONS,
    group: 'privacy',
  }),
  page({
    file: 'terms-of-service.html',
    title: dict.legal.termsTitle,
    intro: dict.legal.termsIntro,
    sections: TERMS_SECTIONS,
    group: 'terms',
  }),
];

const browser = findBrowser();
if (browser) {
  for (const htmlPath of written) toPdf(browser, htmlPath);
} else {
  console.log(
    'no Chrome/Edge found — skipped the PDFs. Set CHROME_PATH to a browser binary,\n' +
      'or print the .html to PDF by hand before uploading to the legal bucket.'
  );
}
