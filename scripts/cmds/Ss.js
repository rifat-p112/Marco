const https = require('https');

module.exports = {
  config: {
    name: "ss",
    aliases: ["screenshot"],
    version: "1.0",
    author: "Mercus",
    countDown: 5,
    role: 2,
    shortDescription: "Get screenshot of website",
    longDescription: "Get screenshot of website",
    category: "image",
    guide: "{pn} [mode] link\nModes: desktop (default), tablet, phone"
  },

  onStart: async function ({ message, args }) {
    let mode = "desktop";
    let url = "";

    if (args.length === 0) {
      return message.reply(`⚠ | Please enter a URL or search query!`);
    }

    // Check if the first argument is a mode
    const firstArg = args[0].toLowerCase();
    if (["desktop", "tablet", "phone"].includes(firstArg)) {
      mode = firstArg; // Set the mode
      args.shift(); // Remove the mode from the args
    }

    // Join the remaining arguments as the URL or search query
    const name = args.join(" ");
    if (!name) {
      return message.reply(`⚠ | Please enter a URL or search query!`);
    }

    // Validate and set the URL
    try {
      new URL(name);
      url = name;
    } catch (err) {
      url = `https://www.google.com/search?q=${encodeURIComponent(name)}`;
    }

    try {
      const screenshotStream = await createScreenshot(url, mode);
      const form = {
        body: "",
        attachment: [screenshotStream]
      };
      message.reply(form);
    } catch (e) {
      message.reply(`Error: ${e.message}`);
    }
  }
};

function createScreenshot(url, mode) {
  return new Promise((resolve, reject) => {
    let width, crop;

    // Set width and crop based on mode
    switch (mode) {
      case "tablet":
        width = 800;
        crop = 1000;
        break;
      case "phone":
        width = 375;
        crop = 667;
        break;
      case "desktop":
      default:
        width = 1920;
        crop = 1080;
        break;
    }

    const screenshotURL = `https://image.thum.io/get/width/${width}/crop/${crop}/fullpage/noanimate/?url=${encodeURIComponent(url)}`;

    https.get(screenshotURL, (response) => {
      if (response.statusCode === 200) {
        resolve(response);
      } else {
        reject(new Error(`Failed to generate screenshot. Status code: ${response.statusCode}`));
      }
    }).on("error", (error) => {
      reject(error);
    });
  });
}