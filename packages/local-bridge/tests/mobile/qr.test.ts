/**
 * Tests for QR code generation.
 */

import { describe, it, expect } from "vitest";
import { generateQRSVG, generateFallbackSVG, buildPairingURL } from "../../src/mobile/qr.js";

describe("generateFallbackSVG", () => {
  it("produces valid SVG with the URL text", () => {
    const svg = generateFallbackSVG("cocapn://pair?code=123456&host=localhost:3100");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("cocapn://pair");
    expect(svg).toContain("123456");
  });

  it("escapes XML special characters", () => {
    const svg = generateFallbackSVG("test<value>&more");
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("test<value>");
  });
});

describe("generateQRSVG", () => {
  it("generates an SVG for a short URL", () => {
    const url = "cocapn://pair?code=123456&host=localhost:3100";
    const svg = generateQRSVG(url);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<rect"); // Should have QR cells
  });

  it("generates an SVG for a minimal string", () => {
    const svg = generateQRSVG("Hello");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("generates fallback for very long data", () => {
    const longData = "x".repeat(200);
    const svg = generateQRSVG(longData);
    expect(svg).toContain("<svg");
    // Long data should fall back to text display
    expect(svg).toContain("Pair with your agent");
  });
});

describe("buildPairingURL", () => {
  it("builds a valid cocapn:// URL", () => {
    const url = buildPairingURL({
      code: "123456",
      host: "localhost",
      port: 3100,
    });
    expect(url).toBe("cocapn://pair?code=123456&host=localhost%3A3100");
  });

  it("includes agent name when provided", () => {
    const url = buildPairingURL({
      code: "999999",
      host: "192.168.1.100",
      port: 8787,
      agentName: "myAgent",
    });
    expect(url).toContain("name=myAgent");
    expect(url).toContain("code=999999");
    expect(url).toContain("host=192.168.1.100%3A8787");
  });

  it("omits name when not provided", () => {
    const url = buildPairingURL({
      code: "111111",
      host: "localhost",
      port: 3100,
    });
    expect(url).not.toContain("name=");
  });
});
