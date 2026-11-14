import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// C toggles the YouTube chat of the video on the arena screen.
const controls = JSON.parse(readFileSync(new URL('../web/config/controls.json', import.meta.url)));

async function harness(page, screen) {
  await page.route('https://www.youtube.com/live_chat**', route => route.fulfill({ contentType: 'text/html', body: 'chat double' }));
  await page.route('**/chat-harness', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <script type="module">
      import {events} from '/events.js';
      import {createInput} from '/input.js';
      import {create as chat} from '/ui/chat.js';
      const canvas=document.createElement('canvas'),uiRoot=document.createElement('div');document.body.append(canvas,uiRoot);
      const controls=${JSON.stringify(controls)};
      const input=createInput({canvas,events,controls,isReady:()=>true,onLook(){},onJump(){}});
      window.arena={screen:${JSON.stringify(screen)}};
      chat({events,uiRoot,input,config:name=>({controls})[name]});
      events.dispatchEvent(new CustomEvent('app:enter',{detail:{}}));
      window.harnessReady=true;
    </script>` }));
  await page.goto('/chat-harness');
  await page.waitForFunction(() => window.harnessReady);
}

test('C opens and closes the live chat of the screen video', async ({ page }) => {
  await harness(page, { source: 'live', videoId: 'abcdefghijk' });
  await expect(page.locator('#yt-chat')).toBeHidden();
  await page.keyboard.press('KeyC');
  const frame = page.locator('#yt-chat iframe');
  await expect(frame).toBeVisible();
  const src = new URL(await frame.getAttribute('src'));
  expect(src.pathname).toBe('/live_chat');
  expect(src.searchParams.get('v')).toBe('abcdefghijk');
  expect(src.searchParams.get('embed_domain')).toBe('localhost');
  await page.keyboard.press('KeyC');
  await expect(page.locator('#yt-chat')).toBeHidden();
});

test('a VOD opens the chat replay', async ({ page }) => {
  await harness(page, { source: 'vod', videoId: 'abcdefghijk' });
  await page.keyboard.press('KeyC');
  expect(new URL(await page.locator('#yt-chat iframe').getAttribute('src')).pathname).toBe('/live_chat_replay');
});

test('Ctrl+C does not open the chat', async ({ page }) => {
  await harness(page, { source: 'live', videoId: 'abcdefghijk' });
  await page.keyboard.press('Control+KeyC');
  await expect(page.locator('#yt-chat')).toBeHidden();
});
