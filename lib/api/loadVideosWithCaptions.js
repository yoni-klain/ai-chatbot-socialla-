const axios = require("axios");

const API_URL = 'https://www.googleapis.com/youtube/v3/';
const API_TOKEN = process.env.API_TOKEN || '';
const caption_regex = /https:\/\/www.youtube.com\/api\/timedtext[^"]*/;
const API_WATCH = 'https://www.youtube.com/watch';

async function loadVideosWithCaptions(searchKey) {
  try {
    const url = `${API_URL}search?key=${API_TOKEN}&type=video&part=snippet&videoCaption=any&maxResults=3&q=${searchKey}`;
    const response = await axios.get(url);
    const allVideos = response.data.items;
    const videosWithCaptions = [];
    
    await Promise.all(allVideos.map(async (item) => {
        const videoId = item.id.videoId;
      const captions = await getCaptions( videoId);
      if(captions) {
        videosWithCaptions.push({ videoId, captions: captions });
      }
      //const encodedCaptions = Buffer.from(captions, 'utf8').toString('base64'); // Encode captions to reduce size

    }));

    return videosWithCaptions;
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function getCaptions(videoId) {
  try {
    const URL = `${API_WATCH}?v=${videoId}`;
    const res = await axios.get(URL);
    const captionUrl = caption_regex.exec(res.data)[0];
    const decodedCaptionDownloadUrl = JSON.parse('"' + captionUrl.replace(/"/g, '\\\\\\\\"') + '"');
    return await downloadCaptions(decodedCaptionDownloadUrl);
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function downloadCaptions(url) {
  try {
    const res = await axios.get(url);
    const captions = res.data.replace(/<\/?[^>]+(>|$)/g, ""); // Strip XML tags
    const encodedCaptions = Buffer.from(captions, 'utf8').toString('base64');
    return encodedCaptions; // Returns encoded captions
  } catch (err) {
    console.error(err);
    return null;
  }
}




module.exports = { loadVideosWithCaptions };
