import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { chromium } from 'playwright';

const PORT = 3099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_REL_PATH = 'data/qa-e2e.db';
const DB_ABS_PATH = path.resolve(DB_REL_PATH);
const ARTIFACT_DIR =
  'C:\\Users\\SUBI\\.gemini\\antigravity\\brain\\54ada1af-e752-4e55-93e1-11735b608a42';

// Build a crisp 240x135 Afro-Futuristic sunset gradient PNG using built-in node:zlib
function createCrispGradientPng(width = 240, height = 135) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const makeChunk = (type, data) => {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1);
    raw[rowStart] = 0; // filter: none
    const ty = y / height;
    for (let x = 0; x < width; x++) {
      const tx = x / width;
      const idx = rowStart + 1 + x * 3;
      // Nairobi skyline dusk: Savannah Gold -> Maasai Coral -> Deep Rift Indigo + glowing sun
      const dx = x - width * 0.72;
      const dy = y - height * 0.34;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isHorizon = y > height * 0.74;
      let r, g, b;
      if (isHorizon) {
        r = 12;
        g = 20;
        b = 42;
      } else if (dist < 22) {
        r = 253;
        g = 224;
        b = 71;
      } else {
        r = Math.round(245 * (1 - ty * 0.7) + 6 * tx * 0.3);
        g = Math.round(158 * (1 - ty * 0.65) + 182 * tx * 0.25);
        b = Math.round(11 + 200 * ty * 0.7 + 90 * tx * 0.4);
      }
      raw[idx] = Math.min(255, Math.max(0, r));
      raw[idx + 1] = Math.min(255, Math.max(0, g));
      raw[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const TEMP_PNG_PATH = path.resolve('tests/.tmp-qa-sample.png');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function removeDbFiles() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const p = `${DB_ABS_PATH}${suffix}`;
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // ignore
    }
  }
}

async function waitForServer(timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server failed to become healthy on ${BASE_URL} within ${timeoutMs}ms`);
}

function attachTrackers(page, label) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[${label}] console.error: ${msg.text()}`);
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(`[${label}] pageerror: ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    const failureText = req.failure()?.errorText || 'failed';
    // Ignore aborted requests triggered by navigation/reload/beacon
    if (failureText.includes('ERR_ABORTED')) return;
    failedRequests.push(`[${label}] requestfailed ${req.method()} ${req.url()} (${failureText})`);
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedRequests.push(
        `[${label}] HTTP ${res.status()} ${res.request().method()} ${res.url()}`
      );
    }
  });

  return { consoleErrors, pageErrors, failedRequests };
}

async function assertNoHorizontalOverflow(page, stepName) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  assert(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `Horizontal overflow at "${stepName}": scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
  );
}

async function disableMicForDemoVoiceNote(context) {
  // Ensure VoiceRecorderButton reliably presents the graceful Demo Voice Note HUD in headless browsers
  await context.addInitScript(() => {
    if (navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = async () => {
        const err = new Error('No microphone attached in headless QA');
        err.name = 'NotFoundError';
        throw err;
      };
    }
  });
}

async function runFullFlow({ browser, isMobile, email, nickname }) {
  const label = isMobile ? 'MOBILE(390x844)' : 'DESKTOP(1440x900)';
  console.log(`\n========== STARTING E2E FLOW: ${label} ==========`);

  const context = await browser.newContext(
    isMobile
      ? {
          viewport: { width: 390, height: 844 },
          isMobile: true,
          hasTouch: true,
        }
      : {
          viewport: { width: 1440, height: 900 },
        }
  );

  await disableMicForDemoVoiceNote(context);
  const page = await context.newPage();
  const trackers = attachTrackers(page, label);

  try {
    // 1. Auth Screen — strictly email-only (NO Google/Facebook/Apple/Phone OAuth buttons)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: /Welcome back to 47 Cities/i }).waitFor();
    await assertNoHorizontalOverflow(page, `${label} Auth Login`);

    const authButtonsText = await page.locator('button').allInnerTexts();
    for (const btnText of authButtonsText) {
      assert(
        !/continue with google|sign in with google|facebook|apple|phone number/i.test(btnText),
        `${label}: Forbidden OAuth/Phone button detected: "${btnText}"`
      );
    }

    // 2. Register a brand-new Kenyan user via Email with ALL exact form fields
    await page.getByRole('tab', { name: /Create Account/i }).click();
    await page.locator('#reg-email').fill(email);
    await page.locator('#reg-password').fill('KenyaQa2026!');
    await page.locator('#reg-nickname').fill(nickname);

    // Gender: Man
    await page.locator('form button', { hasText: /^Man$/ }).click();
    // Age Range: 26-29
    await page.locator('form button', { hasText: /^26-29$/ }).click();
    // Home County: Nairobi
    await page.locator('#reg-county').selectOption('Nairobi');
    // Children: No
    await page.locator('form button', { hasText: /^No$/ }).click();
    // Interested In: Women
    await page.locator('form button', { hasText: /^Women$/ }).click();

    // Looking For: Soulmate + Hangout (default already has Soulmate & Hangout; verify active)
    const soulmateBtn = page.locator('form button', { hasText: /Soulmate/ });
    if (!(await soulmateBtn.innerText()).includes('✓')) await soulmateBtn.click();
    const hangoutBtn = page.locator('form button', { hasText: /Hangout/ });
    if (!(await hangoutBtn.innerText()).includes('✓')) await hangoutBtn.click();

    // Hate With Passion: Ujinga + Liar
    const ujingaBtn = page.locator('form button', { hasText: /Ujinga/ });
    if (!(await ujingaBtn.innerText()).includes('✕')) await ujingaBtn.click();
    const liarBtn = page.locator('form button', { hasText: /Liar/ });
    if (!(await liarBtn.innerText()).includes('✕')) await liarBtn.click();

    await page.locator('#reg-bio').fill('Nairobi coffee, football, and Karura trail runs.');

    // Verify submit is gated until BOTH 18+ Disclaimer checkboxes + Digital Signature are filled
    const registerBtn = page.getByTestId('register-submit-btn');
    assert(await registerBtn.isDisabled(), `${label}: Register submit MUST be disabled before disclaimer`);

    await page.getByTestId('checkbox-adult').check();
    assert(await registerBtn.isDisabled(), `${label}: Register submit MUST remain disabled with only 1 checkbox`);

    await page.getByTestId('checkbox-responsibility').check();
    assert(await registerBtn.isDisabled(), `${label}: Register submit MUST remain disabled without signature`);

    await page.locator('#reg-signature').fill(nickname);
    assert(await registerBtn.isEnabled(), `${label}: Register submit MUST unlock after both checkboxes + signature`);
    await assertNoHorizontalOverflow(page, `${label} Registration Form`);

    if (!isMobile) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'qa-desktop-auth-register.png'),
        fullPage: false,
      });
    }

    // Submit registration -> Dev Verification Inbox -> Fill 6-digit code -> Verify Email
    await registerBtn.click();
    await page.getByRole('heading', { name: /Verify Your Email Address/i }).waitFor();
    await page.getByRole('button', { name: /Open Dev Verification Inbox/i }).click();
    await page.getByRole('dialog').waitFor();
    const codeText = (await page.getByTestId('dev-inbox-code').first().innerText()).trim();
    assert(/^\d{6}$/.test(codeText), `${label}: Expected 6-digit verification code, got "${codeText}"`);
    await page.getByTestId(`dev-inbox-fill-${codeText}`).click();
    await page.getByRole('button', { name: /Verify Email & Continue/i }).click();

    // 3. Confirm Location Gate locks out profiles & activity when Location is OFF
    await page.getByText(/Portal Locked — Location Required/i).waitFor();
    await page.getByTestId('city-pin-nairobi-cbd').waitFor();
    await assertNoHorizontalOverflow(page, `${label} Location Gate`);

    // Verify main app navigation is NOT accessible while locked
    assert(
      (await page.getByTestId('nav-blackboard').count()) === 0 &&
        (await page.getByTestId('mobile-nav-blackboard').count()) === 0,
      `${label}: Main navigation must not render while Location Gate is locked`
    );

    if (!isMobile) {
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'qa-desktop-location-gate.png'),
        fullPage: false,
      });
    }

    // 4. Activate Location via Nairobi Test City Pin -> confirm portal unlocks!
    await page.getByTestId('city-pin-nairobi-cbd').click();
    await page.getByText(/47 Cities Public Blackboard/i).waitFor();
    await page.waitForTimeout(500);
    await assertNoHorizontalOverflow(page, `${label} Blackboard Unlocked`);

    // 5. Inspect Public Blackboard (Politics, Health, Sports), AI Polish, post, Star, comments, Story Viewer
    for (const topic of ['Politics', 'Health', 'Sports']) {
      // Topic filter button (outside composer form)
      const filterRow = page.locator('div.overflow-x-auto').filter({ hasText: 'All' }).filter({ hasText: 'Politics' });
      await filterRow.getByRole('button', { name: topic, exact: true }).click();
      await page.waitForTimeout(300);
      await assertNoHorizontalOverflow(page, `${label} Blackboard Topic ${topic}`);
    }
    // Back to All
    const filterRow = page.locator('div.overflow-x-auto').filter({ hasText: 'All' }).filter({ hasText: 'Politics' });
    await filterRow.getByRole('button', { name: 'All', exact: true }).click();
    await page.waitForTimeout(300);

    // AI Polish & Post a new opinion
    const composerTextarea = page.locator('textarea[placeholder*="Share a city pulse"]');
    await composerTextarea.fill(
      'Nairobi electric buses and safe bike lanes along Ngong Road would transform daily commutes'
    );
    await page.getByRole('button', { name: /AI Polish/i }).click();
    await page.getByRole('button', { name: /Apply Polish/i }).waitFor();
    await page.getByRole('button', { name: /Apply Polish/i }).click();
    await page.getByRole('button', { name: /Post to Blackboard/i }).click();
    await page.waitForTimeout(500);

    // Give a Star to the first post
    const firstCard = page.locator('main article').first();
    await firstCard.getByRole('button', { name: /Star/i }).first().click();
    await page.waitForTimeout(250);

    // Open comments drawer and post a comment
    const commentToggleBtn = firstCard.locator('button:has(svg.lucide-message-square)').first();
    await commentToggleBtn.click();
    const replyInput = firstCard.locator('input[placeholder*="Write a respectful reply"]');
    await replyInput.waitFor();
    await replyInput.fill('Fully backing this vision for Nairobi!');
    await replyInput.press('Enter');
    await firstCard.getByText('Fully backing this vision for Nairobi!').waitFor();

    // Capture Blackboard + Stories + AI Rail (Dark Mode) screenshot
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        isMobile ? 'qa-mobile-blackboard.png' : 'qa-desktop-blackboard-dark.png'
      ),
      fullPage: false,
    });

    // Open & close a Story Viewer
    const storySection = page.locator('section[aria-label="Proximity Stories"]');
    // First button is "+ Share Vibe", second button is first live story
    const firstStoryBtn = storySection.locator('button').nth(1);
    await firstStoryBtn.click();
    await page.getByRole('dialog').waitFor();
    await page.waitForTimeout(250);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    // 6. Visit 10 km Proximity Radar: confirm ONLY Woman cards show & ZERO private fields!
    const navRadar = isMobile ? page.getByTestId('mobile-nav-radar') : page.getByTestId('nav-radar');
    await navRadar.click();
    await page.getByRole('heading', { name: /10 km Proximity Radar/i }).waitFor();
    await page.locator('main article').first().waitFor();
    await assertNoHorizontalOverflow(page, `${label} 10km Proximity Radar`);

    const radarCards = page.locator('main article');
    const cardCount = await radarCards.count();
    assert(cardCount === 6, `${label}: Expected 6 Nairobi Woman cards for Interested In: Women, got ${cardCount}`);

    for (let i = 0; i < cardCount; i++) {
      const cardText = await radarCards.nth(i).innerText();
      assert(cardText.includes('Woman'), `${label}: Radar card #${i} must be Woman: "${cardText}"`);
      assert(!/\bMan\b/.test(cardText), `${label}: Radar card #${i} must NOT show Man`);
      assert(cardText.includes('Within 10 km'), `${label}: Radar card #${i} must show "Within 10 km"`);
      // Assert ZERO private fields leaked on card
      for (const secret of [
        '@47cities.ke',
        'Kiambu',
        'Mombasa',
        'Machakos',
        'Nakuru',
        'Kericho',
        'Liar',
        'Lazy',
        'Alcoholic',
        'Ujinga',
        'Soulmate',
        'km away',
      ]) {
        assert(
          !cardText.includes(secret),
          `${label}: Privacy leak! Radar card #${i} exposed "${secret}"`
        );
      }
    }

    // 7. Open 3 simultaneous chats; attempt to open a 4th chat -> assert max-3 toast!
    for (let i = 0; i < 3; i++) {
      if (isMobile && i > 0) {
        // Mobile navigates to Chats on open; go back to Radar to open next peer
        await page.getByTestId('mobile-nav-radar').click();
        await page.locator('main article').nth(i).waitFor();
      }
      await page.locator('main article').nth(i).getByRole('button', { name: /Open Chat/i }).click();
      await page.waitForTimeout(250);
    }

    // Attempt 4th chat -> MUST show max-3 enforcement toast
    if (isMobile) {
      await page.getByTestId('mobile-nav-radar').click();
      await page.locator('main article').nth(3).waitFor();
    } else {
      // Minimize open floating dock windows so the Radar grid underneath is unobstructed
      const collapseBtns = page
        .getByTestId('multi-chat-floating-dock')
        .locator('button[aria-label^="Collapse chat with"]');
      const collapseCount = await collapseBtns.count();
      for (let c = 0; c < collapseCount; c++) {
        await collapseBtns.first().click();
      }
      await page.waitForTimeout(150);
    }
    await page.locator('main article').nth(3).getByRole('button', { name: /Open Chat/i }).click();
    const toast = page.getByTestId('app-toast');
    await toast.waitFor();
    const toastText = await toast.innerText();
    assert(
      /Max 3 simultaneous chats/i.test(toastText),
      `${label}: Expected Max 3 toast, got "${toastText}"`
    );
    await toast.getByRole('button', { name: /Dismiss notification/i }).click();

    // Go to Multi-Chat full workspace
    const navChats = isMobile ? page.getByTestId('mobile-nav-chats') : page.getByTestId('nav-chats');
    await navChats.click();
    await page.getByTestId('multi-chat-workspace').waitFor();
    await page.waitForTimeout(400);
    await assertNoHorizontalOverflow(page, `${label} Multi-Chat 3 Sessions`);

    if (!isMobile) {
      const desktopWindows = page.getByTestId('desktop-multichat-grid').locator('section[data-testid^="chat-window-"]');
      assert((await desktopWindows.count()) === 3, `${label}: Expected 3 side-by-side chat windows`);
    } else {
      const mobileTabs = page.getByTestId('mobile-multichat-tabs').locator('[role="tab"]');
      assert((await mobileTabs.count()) === 3, `${label}: Expected 3 mobile chat tabs`);
    }

    // Interact inside the first visible chat window
    const activeChatScope = isMobile
      ? page.getByTestId('mobile-multichat-tabs').locator('section[data-testid^="chat-window-"]:visible').first()
      : page.getByTestId('desktop-multichat-grid').locator('section[data-testid^="chat-window-"]').first();

    // (a) Send emoji via Emoji Picker
    await activeChatScope.getByRole('button', { name: /Open emoji picker/i }).click();
    await activeChatScope.getByRole('button', { name: /Insert emoji 🔥/i }).click();
    const chatInput = activeChatScope.locator('input[type="text"]');
    await chatInput.fill((await chatInput.inputValue()) + ' Nairobi coffee & football vibes tonight!');
    await chatInput.press('Enter');
    await activeChatScope.getByText(/Nairobi coffee & football vibes tonight!/i).waitFor();

    // (b) Click AI Opener -> pick first opener -> send
    await activeChatScope.getByRole('button', { name: /AI Opener suggestions/i }).click();
    const firstOpenerChip = activeChatScope
      .locator('div')
      .filter({ hasText: /AI Kenyan Conversation Starters/i })
      .locator('button')
      .nth(1); // nth(0) is close X button
    await firstOpenerChip.waitFor();
    await firstOpenerChip.click();
    await activeChatScope.locator('button[type="submit"]').click();
    await page.waitForTimeout(400);

    // (c) Send Demo Voice Note -> assert <audio> player renders
    await activeChatScope.getByRole('button', { name: /Record voice note/i }).click();
    await activeChatScope.getByRole('button', { name: /Send Quick Demo Voice Note/i }).waitFor();
    await activeChatScope.getByRole('button', { name: /Send Quick Demo Voice Note/i }).click();
    await activeChatScope.locator('audio').first().waitFor({ timeout: 8000 });
    const audioCount = await activeChatScope.locator('audio').count();
    assert(audioCount >= 1, `${label}: Expected <audio> player to render for voice note`);

    // (d) Upload small PNG image -> assert 20 MB session budget updates & expiry badge renders
    const imageInput = activeChatScope.locator('input[type="file"][accept="image/*"]');
    await imageInput.setInputFiles(TEMP_PNG_PATH);
    await activeChatScope.getByText(/Auto-clears in/i).first().waitFor({ timeout: 8000 });
    const budgetText = await page.getByTestId('image-budget-text').innerText();
    assert(
      !budgetText.startsWith('0 KB'),
      `${label}: Expected image budget to update above 0 KB, got "${budgetText}"`
    );

    // On Desktop, also drop a quick message in window 2 & 3 so the 3-window screenshot looks super rich!
    if (!isMobile) {
      const win2 = page.getByTestId('desktop-multichat-grid').locator('section[data-testid^="chat-window-"]').nth(1);
      await win2.locator('input[type="text"]').fill('Hey! Ready for rooftop jazz this Friday? 🎶✨');
      await win2.locator('input[type="text"]').press('Enter');
      await win2.getByText(/rooftop jazz this Friday/i).waitFor();

      const win3 = page.getByTestId('desktop-multichat-grid').locator('section[data-testid^="chat-window-"]').nth(2);
      await win3.locator('input[type="text"]').fill('Karura 7km morning run + cold brew? 🌿☕');
      await win3.locator('input[type="text"]').press('Enter');
      await win3.getByText(/Karura 7km morning run/i).waitFor();
    }

    await assertNoHorizontalOverflow(page, `${label} Multi-Chat After Media`);
    await page.screenshot({
      path: path.join(
        ARTIFACT_DIR,
        isMobile ? 'qa-mobile-multichat.png' : 'qa-desktop-multichat-3win.png'
      ),
      fullPage: false,
    });

    // 8. Inspect AI Match & What's Next panel
    const navAi = isMobile ? page.getByTestId('mobile-nav-ai') : page.getByTestId('nav-ai');
    await navAi.click();
    await page.locator('main').getByText(/What['’]s Next/i).first().waitFor();
    await assertNoHorizontalOverflow(page, `${label} AI Match & What's Next`);

    // Toggle Light Mode -> verify data-theme="light" -> capture Desktop Light Mode screenshot -> toggle back to Dark Mode
    if (!isMobile) {
      await page.getByTestId('desktop-theme-toggle').click();
      await page.waitForTimeout(200);
      const themeLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert(themeLight === 'light', `${label}: Expected data-theme="light", got "${themeLight}"`);

      // Navigate to 10 km Radar in Light Mode for crisp unobstructed Light Mode showcase screenshot
      await page.getByTestId('nav-radar').click();
      await page.locator('main article').first().waitFor();
      const lightCollapseBtns = page
        .getByTestId('multi-chat-floating-dock')
        .locator('button[aria-label^="Collapse chat with"]');
      const lightCollapseCount = await lightCollapseBtns.count();
      for (let c = 0; c < lightCollapseCount; c++) {
        await lightCollapseBtns.first().click();
      }
      await page.waitForTimeout(250);
      await assertNoHorizontalOverflow(page, `${label} Light Mode Radar`);
      await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'qa-desktop-light-mode.png'),
        fullPage: false,
      });

      // Toggle back to Dark Mode
      await page.getByTestId('desktop-theme-toggle').click();
      await page.waitForTimeout(150);
      const themeDark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert(themeDark === 'dark', `${label}: Expected data-theme="dark", got "${themeDark}"`);
    } else {
      await page.getByRole('button', { name: 'Toggle Theme' }).click();
      await page.waitForTimeout(150);
      const themeLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert(themeLight === 'light', `${label}: Expected mobile data-theme="light"`);
      await page.getByRole('button', { name: 'Toggle Theme' }).click();
      await page.waitForTimeout(150);
    }

    // Verify Profile Privacy Shield comparison
    const navProfile = isMobile
      ? page.getByTestId('mobile-nav-profile')
      : page.getByTestId('nav-profile');
    await navProfile.click();
    await page.getByText(/What Nearby Members See/i).waitFor();
    await page.getByText(/Hidden Private Profile/i).waitFor();
    await page.getByText(/18\+ Community Responsibility Disclaimer Signed/i).waitFor();
    await assertNoHorizontalOverflow(page, `${label} Profile Privacy Shield`);

    // Toggle Location OFF -> verify immediate re-lock back to Location Gate!
    if (isMobile) {
      await page.getByTestId('mobile-location-toggle').click();
    } else {
      await page.getByTestId('desktop-location-off-btn').click();
    }
    await page.getByText(/Portal Locked — Location Required/i).waitFor();
    await assertNoHorizontalOverflow(page, `${label} Re-Locked Location Gate`);

    // Re-enable Location via Nairobi pin -> returns to unlocked shell -> Sign Out
    await page.getByTestId('city-pin-nairobi-cbd').click();
    if (isMobile) {
      await page.getByTestId('mobile-nav-blackboard').waitFor();
      await page.getByRole('button', { name: 'Sign Out' }).click();
    } else {
      await page.getByTestId('desktop-signout-btn').waitFor();
      await page.getByTestId('desktop-signout-btn').click();
    }
    await page.getByRole('heading', { name: /Welcome back to 47 Cities/i }).waitFor();
    await assertNoHorizontalOverflow(page, `${label} Signed Out Auth Screen`);

    console.log(
      `[${label}] Summary — consoleErrors=${trackers.consoleErrors.length}, pageErrors=${trackers.pageErrors.length}, failedRequests=${trackers.failedRequests.length}`
    );
    return trackers;
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(TEMP_PNG_PATH, createCrispGradientPng(240, 135));
  removeDbFiles();

  // Boot the real production server serving dist/ + API (avoid shell:true so spaces in path work cleanly)
  const tsxCli = path.resolve('node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverProc = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: DB_REL_PATH,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
  serverProc.stderr.on('data', (d) => process.stderr.write(`[server:err] ${d}`));

  let browser;
  try {
    await waitForServer();
    console.log(`[e2e] Production server healthy at ${BASE_URL}`);

    browser = await chromium.launch({ channel: 'msedge', headless: true });

    const desktopTrackers = await runFullFlow({
      browser,
      isMobile: false,
      email: 'kofi.desktop@47cities.ke',
      nickname: 'KofiNairobi',
    });

    const mobileTrackers = await runFullFlow({
      browser,
      isMobile: true,
      email: 'baraka.mobile@47cities.ke',
      nickname: 'BarakaMobile',
    });

    const allConsoleErrors = [
      ...desktopTrackers.consoleErrors,
      ...mobileTrackers.consoleErrors,
    ];
    const allPageErrors = [...desktopTrackers.pageErrors, ...mobileTrackers.pageErrors];
    const allFailedRequests = [
      ...desktopTrackers.failedRequests,
      ...mobileTrackers.failedRequests,
    ];

    if (allConsoleErrors.length || allPageErrors.length || allFailedRequests.length) {
      console.error('\n❌ E2E ERRORS DETECTED:');
      for (const e of [...allConsoleErrors, ...allPageErrors, ...allFailedRequests]) {
        console.error('  -', e);
      }
      process.exitCode = 1;
    } else {
      console.log('\n✅ ALL DESKTOP (1440x900) & MOBILE (390x844) E2E CHECKS PASSED WITH 0 ERRORS & 0 OVERFLOW!');
    }
  } finally {
    if (browser) await browser.close();
    if (serverProc && !serverProc.killed) {
      if (process.platform === 'win32' && serverProc.pid) {
        spawn('taskkill', ['/pid', String(serverProc.pid), '/f', '/t']);
      } else {
        serverProc.kill('SIGTERM');
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    removeDbFiles();
    try {
      if (fs.existsSync(TEMP_PNG_PATH)) fs.unlinkSync(TEMP_PNG_PATH);
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('E2E FATAL ERROR:', err);
  process.exit(1);
});
