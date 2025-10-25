/**
 * Convert an image file to base64 data URL
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Validate image file size and type
 */
export function validateImageFile(file: File, maxSizeMB = 5): { valid: boolean; error?: string } {
  // Check file type
  const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a valid image file (JPEG, PNG, WebP, or GIF)',
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `Image size must be less than ${maxSizeMB}MB`,
    };
  }

  return { valid: true };
}

/**
 * Handle multiple file uploads and convert to base64 array
 */
export async function handleMultipleFiles(
  files: FileList | File[],
  maxFiles = 6
): Promise<{ images: string[]; errors: string[] }> {
  const fileArray = Array.from(files);
  const errors: string[] = [];
  const images: string[] = [];

  if (fileArray.length > maxFiles) {
    errors.push(`Maximum ${maxFiles} images allowed`);
    return { images, errors };
  }

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    const validation = validateImageFile(file);

    if (!validation.valid) {
      errors.push(`File ${i + 1}: ${validation.error}`);
      continue;
    }

    try {
      const base64 = await fileToBase64(file);
      images.push(base64);
    } catch (error) {
      errors.push(`Failed to process file ${i + 1}`);
    }
  }

  return { images, errors };
}
