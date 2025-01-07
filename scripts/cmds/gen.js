const axios = require("axios");
const EventSource = require('eventsource');

function generateRandomDigits() {
    return Math.random() * 10;
}

function generateSessionHash() {
    return Math.random().toString(36).substring(2);
}

function getEventId() {
    return Math.floor(Math.random() * 1000);
}

async function fetchAndExtractRootUrl(url) {
    try {
        const response = await axios.get(url, {
            maxRedirects: 0,
            validateStatus: function (status) {
                return status >= 200 && status < 400;
            }
        });
        if (response.status >= 300 && response.status < 400 && response.headers.location) {
            return response.headers.location.replace(/\/$/, "");
        }
        return url.replace(/\/$/, "");
    } catch (error) {
        console.error(error.message);
        throw new Error("An error occurred.");
    }
}

function calculateDimensions(widthRatio, heightRatio) {
    let width = 1024;
    let height = 1024;

    if (widthRatio !== 0 && heightRatio !== 0) {
        const ratio = widthRatio / heightRatio;
        if (ratio > 1) {
            width = 1024;
            height = Math.round(1024 / ratio);
        } else {
            width = Math.round(1024 * ratio);
            height = 1024;
        }
    }
    return { width, height };
}

async function generateWithPlayground(prompt, width, height) {
    return new Promise(async (resolve, reject) => {
        try {
            const session_hash = generateSessionHash();
            const event_id = getEventId();
            const randomDigit = generateRandomDigits();
            const rootUrl = await fetchAndExtractRootUrl("https://playgroundai-playground-v2-5.hf.space");

            const urlJoinQueue = `${rootUrl}/queue/join?fn_index=3&session_hash=${session_hash}`;
            const eventSource = new EventSource(urlJoinQueue);

            eventSource.onmessage = async (event) => {
                const data = JSON.parse(event.data);
                if (data.msg === "send_data") {
                    const eventId = data?.event_id;
                    await axios.post(`${rootUrl}/queue/data`, {
                        data: [prompt, "", true, randomDigit, width, height, 3, true],
                        event_data: null,
                        fn_index: 3,
                        trigger_id: 6,
                        session_hash: session_hash,
                        event_id: eventId
                    }, {
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                } else if (data.msg === "process_completed") {
                    eventSource.close();
                    const path = data?.output?.data?.[0]?.[0]?.image?.path;
                    if (path) {
                        const fullUrl = `${rootUrl}/file=${path}`;
                        resolve({ images: [{ url: fullUrl }], modelUsed: "Playground" });
                    } else {
                        reject(new Error('An error occurred.'));
                        console.log(data);
                    }
                }
            };

            eventSource.onerror = (error) => {
                eventSource.close();
                reject(error);
            };

        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    config: {
        name: "gen",
        aliases: [],
        version: "1.0",
        author: "rehat--",
        countDown: 5,
        role: 0,
        longDescription: "Text to Image",
        category: "ai",
        guide: {
            en: "{pn} prompt --ar [ratio] or reply an image\n\n Example: {pn} 1girl, cute face, masterpiece, best quality --ar 16:9\n[ default 1:1 ]"
        }
    },

    onStart: async function({ api, args, message, event }) {
        try {
            const resolutionArgIndex = args.indexOf('--ar');
            let width = 1024;
            let height = 1024;

            if (resolutionArgIndex !== -1 && args[resolutionArgIndex + 1]) {
                const resolution = args[resolutionArgIndex + 1].split(':');
                if (resolution.length === 2) {
                    const widthRatio = parseInt(resolution[0]);
                    const heightRatio = parseInt(resolution[1]);
                    if (!isNaN(widthRatio) && !isNaN(heightRatio)) {
                        const dimensions = calculateDimensions(widthRatio, heightRatio);
                        width = dimensions.width;
                        height = dimensions.height;
                    }
                }
                args.splice(resolutionArgIndex, 2);
            }
            const prompt = args.join(" ");
            if (!prompt) {
                return message.reply("Add something baka.");
              }
            await message.reply('Please Wait...⏳');
            const { images } = await generateWithPlayground(prompt, width, height);
            const imageUrl = images[0].url;

            if (!imageUrl) {
                throw new Error("An error occurred.");
            }

            await message.reply({
                attachment: await global.utils.getStreamFromURL(imageUrl)
            });
        } catch (error) {
            console.error(error.message);
            message.reply("An error occurred.");
        }
    }
};