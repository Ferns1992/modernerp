// Guards against malformed branch-filtered URLs.
//
// App builds two forms:
//   branchQuery      = '&branch_id=1'  -> appends to a query that already exists
//   branchQueryLead  = '?branch_id=1'  -> starts the query
//
// Using the '&' form on a URL that has no query string produces
// "/api/dashboard&branch_id=1", which the server 404s. The page then simply
// never sets state, so the section sits on "Loading..." forever with no error
// anywhere. That bug shipped once; this check makes it a build failure.
//
// Run with: npm run test:branch-queries
import { readFileSync } from 'node:fs';

const source = readFileSync('src/App.tsx', 'utf8');
const lines = source.split('\n');

const RE = /fetch\(\s*`([^`]*)`/g;
let failures = 0;
let checked = 0;

console.log('branch-filtered fetch URLs:');
for (let i = 0; i < lines.length; i++) {
  for (const m of lines[i].matchAll(RE)) {
    const tpl = m[1];
    const usesAmp = /\$\{branchQuery\}/.test(tpl);
    const usesLead = /\$\{branchQueryLead\}/.test(tpl);
    if (!usesAmp && !usesLead) continue;

    checked++;
    // Everything before the interpolation, i.e. the path and any existing query.
    const head = tpl.split(/\$\{branchQuery(Lead)?\}/)[0];
    const hasQuery = head.includes('?');
    const path = head.split('?')[0];

    const problems = [];
    if (usesAmp && !usesLead && !hasQuery) {
      problems.push("uses '&branch_id' but the URL has no query string yet -> 404");
    }
    if (usesLead && hasQuery) {
      problems.push("uses '?branch_id' but a query string already exists -> '?&'");
    }
    if (usesAmp && usesLead) {
      problems.push('interpolates both forms into one URL');
    }
    if (!path.startsWith('/api/')) {
      problems.push(`unexpected path ${path}`);
    }

    const url = tpl
      .replace(/\$\{branchQuery\}/g, '&branch_id=1')
      .replace(/\$\{branchQueryLead\}/g, '?branch_id=1')
      .replace(/\$\{[^}]*\}/g, 'X');

    if (problems.length) {
      failures++;
      console.log(`  FAIL  src/App.tsx:${i + 1}  ${url}`);
      for (const p of problems) console.log(`        - ${p}`);
    } else {
      console.log(`  PASS  src/App.tsx:${i + 1}  ${url}`);
    }
  }
}

if (checked === 0) {
  console.log('  FAIL  no branch-filtered fetches found - the check is not looking at anything');
  failures++;
}

console.log(failures === 0 ? `\nALL ${checked} BRANCH URLS OK` : `\n${failures} BRANCH URL PROBLEM(S)`);
process.exit(failures === 0 ? 0 : 1);
