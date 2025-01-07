const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { getStreamFromURL } = global.utils;

function string(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

const headers = {
    authority: "black-forest-labs-flux-1-schnell.hf.space"
};

async function flux(options) {
    try {
        options = {
            prompt: options?.prompt,
            seed: options?.seed || Math.floor(Math.random() * 2147483647) + 1,
            random_seed: options?.random_seed ?? true,
            width: options?.width ?? 512,
            height: options?.height ?? 512,
            steps: options?.steps ?? 20
        };
        if (!options.prompt) return {
            status: false,
            message: "undefined reading prompt!"
        };
        const session_hash = string(11);

        // Join queue
        const joinResponse = await axios.post("https://black-forest-labs-flux-1-schnell.hf.space/queue/join", {
            data: [options.prompt, options.seed, options.random_seed, options.width, options.height, options.steps],
            event_data: null,
            fn_index: 2,
            trigger_id: 5,
            session_hash: session_hash
        }, {
            headers: {
                ...headers,
                "Content-Type": "application/json"
            }
        });

        if (joinResponse.status !== 200) throw new Error("Failed to join queue");

        // Get data
        const dataResponse = await axios.get(`https://black-forest-labs-flux-1-schnell.hf.space/queue/data?session_hash=${session_hash}`, {
            headers: headers,
            responseType: 'text'
        });

        if (dataResponse.status !== 200) throw new Error("Failed to retrieve data");

        const rawData = dataResponse.data;
        const lines = rawData.split("\n");
        const jsonObjects = [];
        lines.forEach(line => {
            if (line.startsWith("data: ")) {
                try {
                    const jsonString = line.substring(6).trim();
                    const jsonObject = JSON.parse(jsonString);
                    jsonObjects.push(jsonObject);
                } catch (error) {
                    throw new Error("Failed to parse JSON");
                }
            }
        });

        const result = jsonObjects.find(d => d.msg === "process_completed") || {};
        if (!result?.success) return {
            status: false,
            message: result
        };

        const images = result.output.data.filter(d => typeof d === "object").map(d => d.url);
        return {
            status: true,
            data: {
                images: images
            }
        };
    } catch (error) {
        console.error("Error in flux:", error.message);
        return { status: false, message: error.message };
    }
}

async function fluxMultiple(options, count = 2) {
    const images = [];
    for (let i = 0; i < count; i++) {
        const result = await flux(options); // Call the original flux function
        if (result.status && result.data.images.length > 0) {
            images.push(result.data.images[0]);
        } else {
            throw new Error("Failed to generate an image");
        }
    }
    return { status: true, images };
}

module.exports = {
    config: {
        name: "flux",
        aliases: [],
        version: "1.0",
        author: "Marrcus",
        countDown: 5,
        role: 0,
        longDescription: "Text to Image using Flux",
        category: "ai",
        guide: {
            en: "{pn} prompt"
        }
    },

    onStart: async function({ args, message }) {
        try {
            const prompt = args.join(" ");
            console.log("Received prompt:", prompt);

            const { status, images } = await fluxMultiple({ prompt }, 2); // Request 2 images
            if (!status || images.length < 2) {
                throw new Error("Failed to generate enough images");
            }

            const imgData = await Promise.all(
                images.map(async (url, i) => {
                    const imgResponse = await axios.get(url, { responseType: 'arraybuffer' });
                    const imgPath = path.join(__dirname, 'cache', `${i + 1}.jpg`);
                    await fs.promises.writeFile(imgPath, imgResponse.data);
                    return fs.createReadStream(imgPath);
                })
            );

            await message.reply({
                body: "✅ Images Generated",
                attachment: imgData
            });
        } catch (error) {
            console.error("Error in onStart:", error.message);
            message.reply("An error occurred: " + error.message);
        }
    }
};