const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const pdfPath = path.join(root, '黄炯鹏简历.pdf');
const required = [
  '黄炯鹏',
  '把复杂问题整理成可以推进的方案',
  '广东技术师范大学',
  '机械电子工程',
  '2026 届',
  'CET-6',
  '计算机二级',
  '牛仔鸡',
  '火大',
  '个人语音日记 → AI 本地知识库',
  '汉语桥',
  '海鹚科技',
  '利元亨智能装备',
  '佛山侨晨建材',
];
const forbidden = ['潮汐', '闪念贝壳', 'APPSO', 'GeeLark', '求职意向', '产品经理｜', '冥想'];

(async () => {
  if (!fs.existsSync(htmlPath)) throw new Error(`Missing ${htmlPath}`);
  if (!fs.existsSync(pdfPath)) throw new Error(`Missing ${pdfPath}`);

  const browser = await chromium.launch({ headless: true });
  const errors = [];
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', error => errors.push(`${viewport.name}: ${error.message}`));
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    const result = await page.evaluate(({ required, forbidden }) => {
      const text = document.body.innerText;
      const internalLinks = [...document.querySelectorAll('a[href^="#"]')];
      return {
        missing: required.filter(item => !text.includes(item)),
        forbidden: forbidden.filter(item => text.includes(item)),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        brokenAnchors: internalLinks.map(link => link.getAttribute('href'))
          .filter(href => href !== '#' && !document.querySelector(href)),
        tel: Boolean(document.querySelector('a[href="tel:19865923963"]')),
        mail: Boolean(document.querySelector('a[href="mailto:1986763447@qq.com"]')),
        pdf: Boolean(document.querySelector('a[href="./黄炯鹏简历.pdf"]')),
        hiddenEntries: [...document.querySelectorAll('.entry')]
          .filter(entry => Number.parseFloat(getComputedStyle(entry).opacity) < 1).length,
        contactHeadingPx: Number.parseFloat(getComputedStyle(document.querySelector('.contact h2')).fontSize),
      };
    }, { required, forbidden });
    if (result.missing.length || result.forbidden.length || result.overflow
      || result.brokenAnchors.length || !result.tel || !result.mail || !result.pdf
      || result.hiddenEntries > 0
      || result.contactHeadingPx > (viewport.name === 'mobile' ? 31 : 48)) {
      errors.push(`${viewport.name}: ${JSON.stringify(result)}`);
    }
    await page.screenshot({ path: path.join(root, `preview-${viewport.name}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: generic personal resume');
})().catch(error => { console.error(error.stack); process.exit(1); });
