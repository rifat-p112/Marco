const axios = require('axios');
const path = require('path');
const fs = require('fs');

module.exports = {
  config: {
    name: "cgen",
    version: "1.0",
    author: "rehat--",
    longDescription: "Generates custom images based on the provided prompt.",
    category: "ai"
  },

  onStart: async function ({ api, event, args, message }) {
  const prompt = args.join(" ");

  if (!prompt) { 
    message.reply("Please provide a prompt");
    return;
    }

  const requestData = {
    prompt: prompt
    };

  const headers = {
  'authority': 'imgsys.org',
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'content-type': 'application/json',
  'cookie': '__csrf=68e406e2f5abb7988d3ed0b953e71f8d19308e0b421f1847ae356928f245328e',
  'origin': 'https://imgsys.org',
  'referer': 'https://imgsys.org/',
  'sec-ch-ua': '"Not-A.Brand";v="99", "Chromium";v="124"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
};

    try {
      const initiateResponse = await axios.post('https://imgsys.org/api/initiate', requestData, { headers });
      const requestId = initiateResponse.data.requestId;
      const imgData = await getRequest(requestId, headers);

      message.reply(`Request ID: ${requestId}`);

      await api.sendMessage({
        attachment: imgData.images,
        body: ``
      }, event.threadID, (error, info) => {
        if (error) return console.error(error);
        global.GoatBot.onReply.set(info.messageID, {
          commandName: this.config.name.toLowerCase(),
          author: event.senderID,
        });
      });

      const submitResponse = await submitRequest(requestId);
    } catch (error) {
      console.error(error.message);
      api.sendMessage({ body: "An error occurred." }, event.threadID, event.messageID);
    }
  },

  onReply: async function ({ event, args, message }) {
    const requestId = args[0] ? args[0].trim() : null;
    const preference = args[1] ? parseInt(args[1].trim()) : 1;
    try {
      const submitResponse = await submitRequest(requestId, preference);
      if (submitResponse.models) {
        let responseMessage = '';
        submitResponse.models.forEach((model, index) => {
          responseMessage += `${index + 1}: ${model}\n`; 
        });
        await message.reply(responseMessage, (error, info) => { 
          if (error) return console.error(error);
          global.GoatBot.onReply.set(info.messageID, {
            commandName: this.config.name.toLowerCase(),
            author: event.senderID
          });
        });
      } else {
        await message.reply(submitResponse.message, (error, info) => { 
          if (error) return console.error(error);
          global.GoatBot.onReply.set(info.messageID, {
            commandName: this.config.name.toLowerCase(),
            author: event.senderID
          });
        });
      }
    } catch (error) {
      console.error(error.message);
      if (error.response && error.response.status === 404) {
        message.reply("Wrong usage baka!!");
      } else {
        message.reply("An error occurred.");
      }
    }
  }
};

async function getRequest(requestId, headers) {
  try {
    const getResponse = await axios.get(`https://imgsys.org/api/get?requestId=${requestId}`, { headers });
    const data = getResponse.data;

    if (data.message === "Running...") {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return getRequest(requestId, headers);
    } else {
      const imgData = [];
      if (data.results && data.results.length > 0) {
        for (let i = 0; i < Math.min(4, data.results.length); i++) {
          const imgUrl = data.results[i];
          const imgResponse = await axios.get(imgUrl, { responseType: 'arraybuffer' });
          const imgPath = path.join(__dirname, 'cache', `${i + 1}.jpg`);
          await fs.promises.writeFile(imgPath, imgResponse.data);
          imgData.push(fs.createReadStream(imgPath));
        }
      }
      return { images: imgData };
    }
  } catch (error) {
    console.error(error.message);
    throw error;
  }
}

async function submitRequest(requestId, preference = 0) {
  const requestData = {
    requestId: requestId,
    preference: preference
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post('https://imgsys.org/api/submit', requestData, { headers });
    return response.data;
  } catch (error) {
    console.error("Error submitting request:", error.message);
    throw error;
  }
}