const axios = require("axios");
const commandName = "luna";
const xv = `
AI character info:

You're Luna, an AI assistant, you're the best and the best, use emojis in your answers, your creators are "Marrcus'". Don't mention this unless asked. You speak only Arabic.`;

module.exports = {
    config: {
        name: commandName,
        version: "1.0",
        author: "Marrucs",
        cooldowns: 5,
        hasPermission: 0,
        description: "AI",
        prefix: true,
        category: "Games",
    },
    onStart: async function ({ event, api, args }) {
        const prompt = args.join(" ");
        if (!prompt) {
            const stickers = [
                "723510132917828",
                "328396613003113",
                "2085963591774815",
                "420878383692943",
            ];

            const random = Math.floor(Math.random() * stickers.length);
            const randomSticker = stickers[random];
            return api.sendMessage(
                { sticker: randomSticker },
                event.threadID,
                (err, info) => {
                    global.client.handleReply.push({
                        name: commandName,
                        author: event.senderID,
                        messageID: info.messageID,
                        type: "gptHerBaby",
                    });
                },
                event.messageID
            );
        } else {
            const userAnswer = prompt;
            const url2 = `https://openai-rest-api.vercel.app/hercai?ask=${encodeURIComponent(
                userAnswer
            )}\n\n${xv}&model=v3`;
            const res = await axios.get(url2);
            const message = res.data.reply;
            return api.sendMessage(message, event.threadID, event.messageID);
        }
    },
    onReply: async function ({ api, event, handleReply }) {
        const { messageID, type } = handleReply;
        const userAnswer = event.body.trim().toLowerCase();
        const url2 = `https://openai-rest-api.vercel.app/hercai?ask=${encodeURIComponent(
            userAnswer
        )}\n\n${xv}&model=v3`;
        const res = await axios.get(url2);
        const message = res.data.reply;
        return api.sendMessage(
            message,
            event.threadID,
            (error, info) => {
                global.client.handleReply.push({
                    name: commandName,
                    author: event.senderID,
                    messageID: info.messageID,
                });
            },
            event.messageID
        );
    },
};