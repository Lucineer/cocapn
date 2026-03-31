/**
 * cocapn mobile — Mobile device pairing and management
 *
 * Commands:
 *   cocapn mobile qr           — Show QR code for mobile pairing
 *   cocapn mobile devices      — List connected mobile devices
 *   cocapn mobile disconnect   — Disconnect a mobile device
 */

import { Command } from "commander";

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

const bold = (s: string) => `${colors.bold}${s}${colors.reset}`;
const green = (s: string) => `${colors.green}${s}${colors.reset}`;
const cyan = (s: string) => `${colors.cyan}${s}${colors.reset}`;
const yellow = (s: string) => `${colors.yellow}${s}${colors.reset}`;
const red = (s: string) => `${colors.red}${s}${colors.reset}`;

export function createMobileCommand(): Command {
  const cmd = new Command("mobile")
    .description("Mobile device pairing and management");

  cmd.addCommand(
    new Command("qr")
      .description("Show QR code for mobile pairing")
      .option("-H, --host <host>", "Bridge host", "localhost")
      .option("-p, --port <port>", "Bridge port", "3100")
      .option("--svg", "Output raw SVG instead of terminal display")
      .action(async (options) => {
        const port = parseInt(options.port, 10);

        try {
          const res = await fetch(
            `http://${options.host}:${port + 1}/api/mobile/qr`,
          );

          if (!res.ok) {
            const body = await res.text();
            console.error(red("Failed to get QR code:"), body);
            process.exit(1);
          }

          const svg = await res.text();

          if (options.svg) {
            process.stdout.write(svg);
            return;
          }

          // Display as terminal block characters
          console.log(cyan("\nMobile Pairing QR Code\n"));
          displayQRInTerminal(svg);
          console.log();
          console.log(`${colors.gray}Scan with your cocapn mobile app to pair.${colors.reset}`);
          console.log(`${colors.gray}Bridge: ${options.host}:${port}${colors.reset}\n`);
        } catch (err) {
          console.error(red("Cannot connect to bridge"));
          console.error(`  ${err instanceof Error ? err.message : String(err)}`);
          console.error();
          console.error("Make sure the bridge is running:");
          console.error(`  ${cyan("cocapn start")}`);
          process.exit(1);
        }
      }),
  );

  cmd.addCommand(
    new Command("devices")
      .description("List connected mobile devices")
      .option("-H, --host <host>", "Bridge host", "localhost")
      .option("-p, --port <port>", "Bridge port", "3100")
      .action(async (options) => {
        const port = parseInt(options.port, 10);

        try {
          const res = await fetch(
            `http://${options.host}:${port + 1}/api/mobile/devices`,
          );

          if (!res.ok) {
            console.error(red("Failed to list devices"));
            process.exit(1);
          }

          const data = (await res.json()) as {
            devices: Array<{
              deviceId: string;
              deviceName: string;
              deviceType: string;
              connectedAt: number;
              lastHeartbeat: number;
              state: string;
            }>;
            count: number;
          };

          console.log(cyan("\nConnected Mobile Devices\n"));

          if (data.count === 0) {
            console.log(`${colors.gray}No devices connected.${colors.reset}`);
            console.log(`Pair a device: ${cyan("cocapn mobile qr")}\n`);
            return;
          }

          for (const device of data.devices) {
            const connected = new Date(device.connectedAt).toLocaleString();
            const typeIcon = device.deviceType === "ios" ? "(iOS)" :
              device.deviceType === "android" ? "(Android)" : "(Web)";
            console.log(
              `  ${green("●")} ${bold(device.deviceName)} ${colors.gray}${typeIcon}${colors.reset}`,
            );
            console.log(`    ID: ${device.deviceId}`);
            console.log(`    Connected: ${connected}`);
            console.log(`    State: ${device.state}`);
            console.log();
          }

          console.log(`${colors.gray}${data.count} device(s) connected${colors.reset}\n`);
        } catch (err) {
          console.error(red("Cannot connect to bridge"));
          console.error(`  ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      }),
  );

  cmd.addCommand(
    new Command("disconnect")
      .description("Disconnect a mobile device")
      .argument("<deviceId>", "Device ID to disconnect")
      .option("-H, --host <host>", "Bridge host", "localhost")
      .option("-p, --port <port>", "Bridge port", "3100")
      .action(async (deviceId: string, options) => {
        const port = parseInt(options.port, 10);

        try {
          const res = await fetch(
            `http://${options.host}:${port + 1}/api/mobile/devices/${deviceId}`,
            { method: "DELETE" },
          );

          if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            console.error(red("Failed to disconnect device:"), body.error ?? "Unknown error");
            process.exit(1);
          }

          console.log(green("Device disconnected:"), deviceId);
        } catch (err) {
          console.error(red("Cannot connect to bridge"));
          console.error(`  ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }
      }),
  );

  return cmd;
}

/**
 * Display a QR code SVG as terminal block characters.
 * Parses the SVG rects and renders a simplified grid.
 */
function displayQRInTerminal(svg: string): void {
  // Extract rect elements to determine QR pattern
  const rectRegex = /<rect\s+x="(\d+)"\s+y="(\d+)"/g;
  const cells = new Set<string>();
  let cellSize = 8;

  let match: RegExpExecArray | null;
  while ((match = rectRegex.exec(svg)) !== null) {
    const x = parseInt(match[1]!, 10);
    const y = parseInt(match[2]!, 10);
    cells.add(`${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`);
  }

  // Determine grid bounds
  let maxX = 0;
  let maxY = 0;
  for (const key of cells) {
    const [x, y] = key.split(",").map(Number);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  // Render using block characters
  const fullBlock = "\u2588\u2588";
  const emptyBlock = "  ";

  for (let y = 0; y <= maxY; y++) {
    let line = "";
    for (let x = 0; x <= maxX; x++) {
      line += cells.has(`${x},${y}`) ? fullBlock : emptyBlock;
    }
    console.log(line);
  }
}
