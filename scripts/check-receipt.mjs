// Renders the real Receipt component for each demo company and asserts the
// preview carries the right letterhead, currency symbol and tax label.
// Run with: node scripts/check-receipt.mjs
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Build inside the project so Node still resolves react/react-dom from
// node_modules; a temp dir outside it cannot see the dependencies.
const dir = join(process.cwd(), 'node_modules', '.cache', 'receipt-check');
mkdirSync(dir, { recursive: true });
const outfile = join(dir, 'receipt.mjs');

await build({
  entryPoints: ['scripts/receipt-entry.tsx'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  outfile,
  logLevel: 'error',
  // React is bundled in so the output has no external imports to resolve.
  absWorkingDir: process.cwd(),
});
writeFileSync(join(dir, 'package.json'), JSON.stringify({ type: 'module' }));

const { Receipt } = await import(outfile);

const BRANCHES = [
  { id: 1, name: 'Saffron Retail LLP', address: '14 Brigade Road, Bengaluru', contact: '+91 80 4123 8890', vat_id: '29AAECS1234F1Z5', logo_url: '/demo/saffron-retail.svg', receipt_logo_url: '/demo/saffron-retail-receipt.svg', currency: '\u20b9', tax_rate: 18, country: 'India' },
  { id: 2, name: 'Manila Mini Mart', address: '221 SM North Avenue, Quezon City', contact: '+63 2 8123 4567', vat_id: '123-456-789-00001', logo_url: '/demo/manila-mini-mart.svg', receipt_logo_url: '/demo/manila-mini-mart-receipt.svg', currency: '\u20b1', tax_rate: 12, country: 'Philippines' },
];

const GLOBAL = { company_name: 'MODERN STORE', address: '1 Global St', contact: '+1 000', currency: '\u20b1', tax_rate: 12, logo_url: '' };
const ITEMS = [
  { name: 'Basmati Rice 5kg', quantity: 2, price_at_sale: 649, cost_price_at_sale: 520 },
  { name: 'Tata Salt 1kg', quantity: 1, price_at_sale: 28, cost_price_at_sale: 20 },
];

let failures = 0;
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -> ${detail}` : ''}`);
  if (!cond) failures++;
};

for (const branch of BRANCHES) {
  // Deliberately hand the component the *global* peso settings: the receipt
  // must still come out in the branch's own currency.
  const settings = { ...GLOBAL };
  const subtotal = ITEMS.reduce((a, i) => a + i.price_at_sale * i.quantity, 0);
  const tax = Math.round(subtotal * (branch.tax_rate / 100) * 100) / 100;
  const sale = { id: 4242, branch_id: branch.id, subtotal, tax, total: subtotal + tax, discount: 0, payment_method: 'cash', customer_name: 'Test Buyer', customer_phone: '+63 900 000 0000' };

  const html = renderToStaticMarkup(React.createElement(Receipt, { sale, items: ITEMS, settings, branches: [branch] }));
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&#x20b9;/g, '\u20b9').replace(/&#x20b1;/g, '\u20b1').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

  console.log(`\n=== ${branch.name} (${branch.country}) ===`);
  check('company letterhead image', html.includes(branch.receipt_logo_url), branch.receipt_logo_url);
  check('company name on receipt', text.toUpperCase().includes(branch.name.toUpperCase()), branch.name);
  check('currency symbol used', text.includes(branch.currency), `symbol ${branch.currency}`);
  check('no foreign currency symbol', !text.includes(BRANCHES.find((b) => b.id !== branch.id).currency));
  check('tax label is country-correct', branch.country === 'India' ? /GST \(18%\)/.test(text) : /VAT \(12%\)/.test(text), branch.country === 'India' ? 'GST (18%)' : 'VAT (12%)');
  check('tax id printed', text.includes(branch.vat_id), branch.vat_id);
  check('line totals in local currency', text.includes(`${branch.currency}${(649 * 2).toFixed(2)}`), `${branch.currency}${(649 * 2).toFixed(2)}`);
  check('grand total in local currency', text.includes(`${branch.currency}${(subtotal + tax).toFixed(2)}`), `${branch.currency}${(subtotal + tax).toFixed(2)}`);
  check('no leftover TEMP receipt number', !text.includes('#TEMP'));
}

// A branch-less receipt must fall back to the global settings, not crash.
const fallback = renderToStaticMarkup(React.createElement(Receipt, {
  sale: { id: 1, subtotal: 100, tax: 12, total: 112, discount: 0, payment_method: 'cash' },
  items: ITEMS, settings: GLOBAL, branches: [],
}));
console.log('\n=== no branch selected (fallback) ===');
check('falls back to global company', fallback.includes('MODERN STORE'));
check('uses global currency', fallback.includes('\u20b1'));

console.log(failures === 0 ? '\nALL RECEIPT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
