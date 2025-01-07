const puppeteer = require('puppeteer');
const solver = require('2captcha');
const totp = require('totp-generator');

// API Key của bạn từ dịch vụ 2Captcha
const apiKey = '50addf6f687785c2ee3403fa414f5fb1'; // Thay thế bằng API Key thực tế của bạn

// Hàm giải mã CAPTCHA từ URL
async function solveCaptcha(page) {
    try {
        // Lấy URL ảnh CAPTCHA từ trang
        const captchaImage = await page.$('img[src*="captcha"]');
        if (!captchaImage) throw new Error("Captcha image not found!");

        // Lấy URL của CAPTCHA
        const imageUrl = await page.evaluate(captchaImage => captchaImage.src, captchaImage);
        console.log("Captcha URL:", imageUrl);

        // Gửi CAPTCHA để giải qua 2Captcha
        const solverInstance = new solver.TwoCaptcha(apiKey);
        const result = await solverInstance.normal({ body: imageUrl });

        // Trả về mã CAPTCHA đã giải
        return result.text;
    } catch (error) {
        console.error('Error occurred while solving captcha:', error.message);
        throw error;
    }
}

// Hàm đăng nhập vào Facebook và vượt qua CAPTCHA nếu có
async function loginMbasic({ email, pass, twoFactorSecretOrCode, userAgent, proxy, maxTry = 3, currentTry = 0 }) {
    const browser = await puppeteer.launch({
        headless: false, // Để thấy được trình duyệt
        args: proxy ? [`--proxy-server=${proxy}`] : []
    });

    const page = await browser.newPage();
    if (userAgent) {
        await page.setUserAgent(userAgent);
    }

    await page.goto('https://www.facebook.com/', {
        waitUntil: 'networkidle2'
    });

    // Điền thông tin đăng nhập
    await page.type('input[name="email"]', email);
    await page.type('input[name="pass"]', pass);

    // Nhấn nút login
    const loginButton = await page.$('button[name="login"]') || await page.$('button[data-testid="royal_login_button"]');
    if (!loginButton) {
        const error = new Error("No login button found on the page");
        await browser.close();
        throw error;
    }

    // Submit form đăng nhập
    await Promise.all([
        page.click('button[name="login"]') || page.click('button[data-testid="royal_login_button"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // Kiểm tra nếu CAPTCHA xuất hiện
    const captchaImage = await page.$('img[src*="captcha"]');
    if (captchaImage) {
        // Lấy và giải CAPTCHA
        const captchaSolution = await solveCaptcha(page);

        // Nhập mã CAPTCHA vào form
        await page.type('input[name="captcha_response"]', captchaSolution);

        // Submit CAPTCHA
        await page.click('button[name="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2' });

        // Kiểm tra nếu CAPTCHA không vượt qua được
        const captchaFailed = await page.$('div._9ay7');
        if (captchaFailed) {
            await browser.close();
            throw new Error("Failed to solve captcha, unable to proceed.");
        }
    }

    // Kiểm tra nếu đăng nhập thất bại
    const loginFailed = await page.$("div._9ay7");
    if (loginFailed) {
        await browser.close();
        throw new Error("Password is incorrect");
    }

    // Kiểm tra nếu cần mã xác minh 2FA
    const twoFactorForm = await page.$('input[name="approvals_code"]');
    if (twoFactorForm) {
        let otpCode;
        if (twoFactorSecretOrCode.length >= 32) {
            twoFactorSecretOrCode = twoFactorSecretOrCode.replace(/\s/g, '');
            otpCode = totp(twoFactorSecretOrCode);
        } else {
            otpCode = twoFactorSecretOrCode;
        }

        await page.type('input[name="approvals_code"]', otpCode);

        // Submit mã 2FA
        await Promise.all([
            page.click('button[name="submit[Submit Code]"]'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);
    }

    // Kiểm tra xem có yêu cầu xác minh tài khoản (checkpoint) không
    const checkpoint = await page.$("form[action*='checkpoint']");
    if (checkpoint) {
        await browser.close();
        throw new Error("Your account is locked, please verify your identity");
    }

    // Lấy cookies sau khi đăng nhập thành công
    const cookies = await page.cookies();
    await browser.close();

    return cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        hostOnly: cookie.hostOnly,
        creation: new Date().toISOString(),
        lastAccessed: new Date().toISOString()
    }));
}

// Xuất hàm loginMbasic để có thể sử dụng lại
module.exports = loginMbasic;
