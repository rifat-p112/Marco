const axios = require('axios');
const { log } = require('console');
const fs = require('fs');

module.exports = {
	config: {
		name: "autolink",
		version: "1.0",
		author: "cc",
		countDown: 5,
		role: 0,
		shortDescription: "Tự động tải media",
		longDescription: "Tự động tải media từ Facebook, Instagram, TikTok",
		category: "media",
		guide: "{prefix}autolink on/off"
	},

	onStart: async function ({ message, event, args }) {
		const { threadID } = event;
		let autolinkData = {};

		if (fs.existsSync('autolink.json')) {
			autolinkData = JSON.parse(fs.readFileSync('autolink.json', 'utf8'));
		}

		if (!autolinkData[threadID]) autolinkData[threadID] = false;

		if (!args[0]) {
			return message.reply(autolinkData[threadID] ? "✅ Autolink đang bật" : "❌ Autolink đang tắt");
		}

		const newState = args[0].toLowerCase() === "on";
		autolinkData[threadID] = newState;
		fs.writeFileSync('autolink.json', JSON.stringify(autolinkData, null, 2));

		return message.reply(newState ? "✅ Đã bật autolink" : "❌ Đã tắt autolink");
	},

	onChat: async function ({ message, event }) {
		try {
			const { threadID } = event;

			let autolinkData = {};
			try {
				autolinkData = JSON.parse(fs.readFileSync('autolink.json', 'utf8'));
			} catch {
				fs.writeFileSync('autolink.json', JSON.stringify({}, null, 2));
			}

			if (!autolinkData[threadID]) return;

			const url = event.body;
			const isURL = /^http(|s):\/\//.test(url);
			if (!isURL) return;
			const patterns = [
				/instagram\.com/,
				/facebook\.com/,
				/pinterest\.com/,
				/soundcloud\.com/,
				/pin\.it/,
				/capcut\.com/,
				/spotify\.com/,
				/x\.com/,
				/tiktok\.com/,
				/telegram\.org/,
				/youtube\.com/,
				/reddit\.com/,
				/bilibili\.com/,
				/threads\.net/,
				/youtube\.com/
				];
	
			const matches = patterns.find(pattern => pattern.test(url));
			if (!matches) return;

			const response = await axios.get(`https://api.hungdev.id.vn/medias/down-aio?apikey=e7f650c3ca&url=${encodeURIComponent(url)}`);
			const mediaData = response.data.data;

			if (!mediaData || mediaData.error) {
				return message.reply("❌ Không thể tải media từ link này");
			}

			if (mediaData.medias && mediaData.medias.length > 0) {
				const firstMedia = mediaData.medias[0];
				let mediaUrl;

				if (firstMedia.type === "video") {
					mediaUrl = firstMedia.url;
				} else {
					const imageUrls = mediaData.medias
						.filter(media => media.type === "image")
						.map(media => media.url);

					if (imageUrls.length > 0) {
						const attachments = [];
						for (const imgUrl of imageUrls) {
							const stream = await global.utils.getStreamFromURL(imgUrl);
							if (stream) attachments.push(stream);
						}

						if (attachments.length > 0) {
							return message.reply({
								body: mediaData.title || "Ảnh từ Facebook",
								attachment: attachments
							});
						}
					}
				}

				if (mediaUrl) {
					const stream = await global.utils.getStreamFromURL(mediaUrl);
					if (stream) {
						return message.reply({
							body: mediaData.title || "Video từ Facebook",
							attachment: stream
						});
					}
				}
			}

			//return message.reply("❌ Không tìm thấy media trong link");

		} catch (error) {
			console.error("Error in autolink command:", error);
			//return message.reply("❌ Đã có lỗi xảy ra khi xử lý link");
		}
	}
};