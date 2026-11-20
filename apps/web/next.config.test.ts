import { HTML_LIMITED_BOT_UA_RE_STRING } from "next/dist/shared/lib/router/utils/is-bot";
import { describe, expect, it } from "vitest";
import { HTML_LIMITED_BOTS } from "./next.config";

/** Real crawler user agents, as each search engine documents them. */
const SEARCH_BOTS = {
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  googlebotSmartphone:
    "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.69 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  googlebotImage: "Googlebot-Image/1.0",
  inspectionTool:
    "Mozilla/5.0 (compatible; Google-InspectionTool/1.0; +http://www.google.com/bot.html)",
  storebot:
    "Mozilla/5.0 (X11; Linux x86_64; Storebot-Google/1.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
  adsbot: "AdsBot-Google (+http://www.google.com/adsbot.html)",
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  duckduckbot: "DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)",
  yandex: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
  baidu: "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)",
  applebot:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)",
};

const BROWSERS = {
  chromeDesktop:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  safariIphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  safariMac:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
};

/**
 * Next uses the pattern two ways: tested as a case-insensitive RegExp when it
 * renders, and as the host's user-agent route matcher `.*(?:…).*`, which sends
 * a bot past a prerendered shell (that one is anchored).
 */
const atRender = (ua: string) => new RegExp(HTML_LIMITED_BOTS.source, "i").test(ua);
const atRouting = (ua: string) => new RegExp(`^.*(?:${HTML_LIMITED_BOTS.source}).*$`, "i").test(ua);

describe("htmlLimitedBots", () => {
  it.each(Object.entries(SEARCH_BOTS))("gets metadata in <head> for %s", (_name, ua) => {
    expect(atRender(ua)).toBe(true);
    expect(atRouting(ua)).toBe(true);
  });

  it.each(Object.entries(BROWSERS))("keeps streamed metadata for %s", (_name, ua) => {
    expect(atRender(ua)).toBe(false);
    expect(atRouting(ua)).toBe(false);
  });

  it("extends Next's default list instead of replacing it", () => {
    expect(HTML_LIMITED_BOTS.source.startsWith(HTML_LIMITED_BOT_UA_RE_STRING)).toBe(true);
    expect(HTML_LIMITED_BOTS.test("facebookexternalhit/1.1")).toBe(true);
    expect(HTML_LIMITED_BOTS.test("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(true);
  });
});
