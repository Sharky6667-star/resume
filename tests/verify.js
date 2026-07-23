const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const pdfPath = path.join(root, '黄炯鹏简历.pdf');
const required = [
  '黄炯鹏',
  '产品与项目实践',
  '实习经历',
  '我的更多输出',
  '联系我',
  '火大',
  '个人语音日记 → AI 本地知识库',
  '汉语桥',
  '海鹚科技',
  '利元亨智能装备',
  '佛山侨晨建材',
];
const forbidden = [
  '潮汐',
  '冥想',
  'chaoxi-resume',
  '自荐 · 产品经理',
  '求职意向',
  '产品经理｜可接受实习 / 初级',
  '面向产品经理岗位',
];
const expectedNav = ['#projects', '#internship', '#more', '#contact'];

(async () => {
  if (!fs.existsSync(htmlPath)) throw new Error(`Missing ${htmlPath}`);
  if (!fs.existsSync(pdfPath)) throw new Error(`Missing ${pdfPath}`);

  const source = fs.readFileSync(htmlPath, 'utf8');
  const sourceForbidden = forbidden.filter(term => source.includes(term));
  if (sourceForbidden.length) throw new Error(`Forbidden source terms: ${sourceForbidden.join(', ')}`);

  const browser = await chromium.launch({ headless: true });
  const errors = [];
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`${viewport.name}: ${message.text()}`);
    });
    page.on('pageerror', error => errors.push(`${viewport.name}: ${error.message}`));
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.fade-in { opacity: 1 !important; transform: none !important; }' });

    const result = await page.evaluate(({ required, forbidden, expectedNav }) => {
      const text = document.body.innerText;
      const nav = [...document.querySelectorAll('.top-nav a')].map(link => link.getAttribute('href'));
      const anchors = [...document.querySelectorAll('a[href^="#"]')]
        .map(link => link.getAttribute('href'))
        .filter(href => href && href !== '#');
      return {
        title: document.title,
        missing: required.filter(term => !text.includes(term)),
        forbidden: forbidden.filter(term => text.includes(term)),
        nav,
        navMatches: JSON.stringify(nav) === JSON.stringify(expectedNav),
        tideLogo: Boolean(document.querySelector('.tide-logo, .tide-logo-frame')),
        meditationSection: Boolean(document.querySelector('#meditation')),
        brokenAnchors: anchors.filter(href => !document.querySelector(href)),
        tel: Boolean(document.querySelector('a[href="tel:19865923963"]')),
        mail: Boolean(document.querySelector('a[href="mailto:1986763447@qq.com"]')),
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    }, { required, forbidden, expectedNav });

    if (result.title !== '黄炯鹏｜通用产品经理简历'
      || result.missing.length || result.forbidden.length || !result.navMatches
      || result.tideLogo || result.meditationSection || result.brokenAnchors.length
      || !result.tel || !result.mail || result.overflow) {
      errors.push(`${viewport.name}: ${JSON.stringify(result)}`);
    }
    await page.screenshot({ path: path.join(root, `preview-${viewport.name}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: published general product manager resume');
})().catch(error => {
  console.error(error.stack);
  process.exit(1);
});
