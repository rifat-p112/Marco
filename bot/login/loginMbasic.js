const puppeteer = require("puppeteer");
const totp = require("totp-generator");

async function loginToFacebook({
    email,
    pass,
    twoFactorSecretOrCode,
    userAgent,
	proxy,
	maxTry = 3,
    currentTry = 0
}) {
    const browserOptions = {
        headless: false, // Hiển thị trình duyệt
        slowMo: 50, // Thêm độ trễ giữa các thao tác
        args: [],
    };

    // Thêm proxy nếu được cung cấp
    if (proxy) {
        browserOptions.args.push(`--proxy-server=${proxy}`);
    }

    const browser = await puppeteer.launch(browserOptions);
    const page = await browser.newPage();

    // Cài đặt user-agent và ngôn ngữ
    await page.setUserAgent(userAgent);
    await page.setExtraHTTPHeaders({
        "accept-language": "vi,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
    });

    try {
        await page.goto("https://m.facebook.com/", { waitUntil: "networkidle2" });

        // Nhập email/số điện thoại và mật khẩu
        await page.type('input[name="email"]', email, { delay: 100 });
        await page.type('input[name="pass"]', pass, { delay: 100 });
		await page.click('div[role="button"][aria-label="Đăng nhập"]');

        await page.waitForNavigation({ waitUntil: "networkidle2" });

        // Xử lý xác thực hai yếu tố (2FA) nếu yêu cầu
        if (await page.$('input[name="approvals_code"]')) {
            if (!twoFactorSecretOrCode) {
                throw new Error("Yêu cầu mã 2FA nhưng không được cung cấp.");
            }

            let otpCode;
            if (twoFactorSecretOrCode.length >= 32) {
                // Tạo mã OTP từ secret
                otpCode = totp(twoFactorSecretOrCode.replace(/\s/g, ""));
            } else {
                otpCode = twoFactorSecretOrCode; // Dùng trực tiếp mã OTP
            }

            // Nhập mã OTP
            await page.type('input[name="approvals_code"]', otpCode, { delay: 100 });
            await page.click('button[name="submit[Submit Code]"]');

            await page.waitForNavigation({ waitUntil: "networkidle2" });
        }

        // Xử lý các bước bảo mật bổ sung
        while (await page.$('input[name="submit[Continue]"], input[name="submit[This was me]"]')) {
            const continueButton = await page.$('input[name="submit[Continue]"]');
            const thisWasMeButton = await page.$('input[name="submit[This was me]"]');

            if (continueButton) {
                await continueButton.click();
            } else if (thisWasMeButton) {
                await thisWasMeButton.click();
            }

            await page.waitForNavigation({ waitUntil: "networkidle2" });
        }

        // Lấy cookies sau khi đăng nhập thành công
        const cookies = await page.cookies();
        await browser.close();

        return cookies.map((cookie) => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            hostOnly: cookie.hostOnly,
            creation: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
        }));
    } catch (error) {
        await browser.close();
        throw error;
    }
}

module.exports = loginToFacebook;
