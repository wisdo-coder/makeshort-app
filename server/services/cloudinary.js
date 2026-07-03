const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadVideo(filePath) {
  return cloudinary.uploader.upload(filePath, {
    resource_type: 'video',
    folder: 'makeshort_viral',
  });
}

module.exports = { uploadVideo };
