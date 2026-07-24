import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

logger.info('Cloudinary service initialized successfully.');

/**
 * Upload a file Buffer directly to Cloudinary using streams
 * @param fileBuffer The buffer of the image file
 * @param folder The target folder name in Cloudinary
 * @returns Secure URL of the uploaded image
 */
export const uploadImageBuffer = (fileBuffer: Buffer, folder: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary stream upload error:', error);
          return reject(error);
        }
        if (!result) {
          return reject(new Error('Cloudinary upload returned empty result'));
        }
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload a Base64 image string to Cloudinary
 * @param base64Str Base64 image string (e.g. data:image/png;base64,...)
 * @param folder The target folder name in Cloudinary
 * @returns Secure URL of the uploaded image
 */
export const uploadImageBase64 = async (base64Str: string, folder: string): Promise<string> => {
  try {
    const result = await cloudinary.uploader.upload(base64Str, { folder });
    return result.secure_url;
  } catch (error) {
    logger.error('Cloudinary base64 upload error:', error);
    throw error;
  }
};

/**
 * Delete an image from Cloudinary by its public ID
 * @param publicId Public ID of the image in Cloudinary
 */
export const deleteImage = async (publicId: string): Promise<any> => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error('Cloudinary image deletion error:', error);
    throw error;
  }
};
