import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { platform } from 'node:os'
import { getDb } from '../db/db'
import { getSettings } from './SettingsService'
import { getProxyAuthForInternalUse } from './ProxyService'
import { clearProfilePid, setProfileLastLaunch } from './ProfileService'
import { audit } from './AuditLogService'
import puppeteer from 'puppeteer-core'; // Dùng core để nhẹ hơn
const running = new Map<string, number>() // profileId -> pid

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function resolveChromePath(): Promise<string> {
  const settings = getSettings()
  if (settings.chromePath && (await fileExists(settings.chromePath))) return settings.chromePath

  const p = platform()
  const candidates: string[] = []

  if (p === 'darwin') {
    candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    candidates.push('/Applications/Chromium.app/Contents/MacOS/Chromium')
  } else if (p === 'win32') {
    candidates.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
    candidates.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')
    candidates.push('C:\\Program Files\\Chromium\\Application\\chrome.exe')
  } else {
    candidates.push('/usr/bin/google-chrome')
    candidates.push('/usr/bin/google-chrome-stable')
    candidates.push('/usr/bin/chromium-browser')
    candidates.push('/usr/bin/chromium')
  }

  for (const c of candidates) {
    if (await fileExists(c)) return c
  }

  throw new Error('Chrome/Chromium not found. Open Settings and either set Chrome path, or use “Download & Install Chromium”.')
}

export async function launchProfile(input: { profileId: string; startUrl?: string }): Promise<{ pid: number }> {
  const db = getDb();
  const profile = db.prepare('SELECT * FROM profiles WHERE id=?').get(input.profileId) as any;
  if (!profile) throw new Error('Profile not found');

  const chromePath = await resolveChromePath();

  // 1. Cấu hình các Flags khởi động của Chromium
  const args: string[] = [
    `--user-data-dir=${profile.userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Quan trọng: Ép WebRTC đi qua Proxy để không lộ IP thật
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp', 
    // Xóa dấu vết bị điều khiển bởi automation ở tầng engine
    '--disable-blink-features=AutomationControlled',
  ];

  // 2. Xử lý Proxy
  if (profile.proxyId) {
    try {
      const { proxyUrlForChrome } = getProxyAuthForInternalUse(profile.proxyId);
      if (proxyUrlForChrome) args.push(`--proxy-server=${proxyUrlForChrome}`);
    } catch (e: any) {
      if (String(e?.message ?? e).includes('Proxy not found')) {
        db.prepare('UPDATE profiles SET proxyId=NULL WHERE id=?').run(profile.id);
      } else {
        throw e;
      }
    }
  }

  // 3. Khởi chạy trình duyệt qua Puppeteer-core
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    defaultViewport: null, // Để kích thước màn hình tự nhiên
    ignoreDefaultArgs: ['--enable-automation'], // Xóa dòng cảnh báo "Chrome is being controlled..."
    args: args
  });

  // 4. Script giả lập vân tay (Anti-detect Script)
  const antiDetectScript = (profileId: string) => {
    // --- Fake WebRTC ---
    if (window.RTCPeerConnection) {
      const OrigRPC = window.RTCPeerConnection;
      (window as any).RTCPeerConnection = function(config: any) {
        if (config?.iceServers) config.iceServers = [];
        return new OrigRPC(config);
      };
      (window as any).RTCPeerConnection.prototype = OrigRPC.prototype;
    }

    // --- Fake Hardware Info ---
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // --- Fake WebGL (Card đồ họa) ---
    const handleWebGL = (proto: any) => {
      const getParameter = proto.getParameter;
      proto.getParameter = function(...args: [number]) {
        const parameter = args[0];
        // 37445: UNMASKED_VENDOR_WEBGL, 37446: UNMASKED_RENDERER_WEBGL
        if (parameter === 37445) return 'NVIDIA Corporation';
        if (parameter === 37446) return 'NVIDIA GeForce RTX 3060';
        return getParameter.apply(this, args);
      };
    };
    
    handleWebGL(WebGLRenderingContext.prototype);
    if ((window as any).WebGL2RenderingContext) {
      handleWebGL((window as any).WebGL2RenderingContext.prototype);
    }
    
    // --- Fake Canvas (Thêm noise nhẹ để đổi Hash) ---
    const seed = profileId.split('').reduce((a: any, b: any) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    const noiseR = Math.abs(seed % 255);
    const noiseG = Math.abs((seed >> 8) % 255);
    const noiseB = Math.abs((seed >> 16) % 255);

    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(...args: any[]) {
        const context = this.getContext('2d');
        if (context) {
            context.save();
            // Sử dụng màu nhiễu duy nhất cho profile này
            // Độ trong suốt cực thấp (0.01) để không làm hỏng ảnh nhưng đổi được Hash
            context.fillStyle = `rgba(${noiseR}, ${noiseG}, ${noiseB}, 0.01)`;
            context.fillRect(0, 0, 1, 1);
            context.restore();
        }
        return originalToDataURL.apply(this, args as any);
    };

    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function(...args: any[]) {
        const imgData = originalGetImageData.apply(this, args as any);
        // Tác động nhẹ vào pixel đầu tiên dựa trên seed của profile
        imgData.data[0] = imgData.data[0] + (seed % 2 === 0 ? 1 : -1);
        return imgData;
    };
  };

  // 5. Áp dụng script cho Tab đầu tiên và TẤT CẢ các tab mở sau này
  const applyToPage = async (page: any) => {
    await page.evaluateOnNewDocument(antiDetectScript, input.profileId);
  };

  // Lắng nghe sự kiện tạo tab mới
  browser.on('targetcreated', async (target) => {
    if (target.type() === 'page') {
      const newPage = await target.page();
      if (newPage) await applyToPage(newPage);
    }
  });

  // Áp dụng cho các trang hiện có (thường là trang đầu tiên)
  const pages = await browser.pages();
  for (const p of pages) {
    await applyToPage(p);

    p.reload();
  }

  // 6. Điều hướng đến Start URL nếu có
  if (input.startUrl && pages.length > 0) {
    await pages[0].goto(input.startUrl);
  }

  const pid = browser.process()?.pid;
  if (!pid) throw new Error('Failed to get PID');

  // 7. Quản lý trạng thái và dọn dẹp
  running.set(input.profileId, pid);
  setProfileLastLaunch({ profileId: input.profileId, pid: pid });
  audit('profiles:launch', { profileId: input.profileId, pid: pid });

  browser.on('disconnected', () => {
    running.delete(input.profileId);
  });

  return { pid };
}

export async function closeProfile(input: { profileId: string }): Promise<void> {
  const pid = running.get(input.profileId)
  if (!pid) {
    // Best-effort: try lastPid from DB
    const db = getDb()
    const row = db.prepare('SELECT lastPid FROM profiles WHERE id=?').get(input.profileId) as any
    if (row?.lastPid) {
      try {
        process.kill(row.lastPid)
      } catch {
        // ignore
      }
    }
    clearProfilePid({ profileId: input.profileId })
    return
  }

  try {
    process.kill(pid)
  } catch {
    // ignore
  } finally {
    running.delete(input.profileId)
    clearProfilePid({ profileId: input.profileId })
    audit('profiles:close', { profileId: input.profileId, pid })
  }
}
