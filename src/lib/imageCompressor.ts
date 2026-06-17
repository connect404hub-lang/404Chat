/**
 * Client-side utility for compressing images using HTML5 Canvas before uploading.
 * This saves storage space by reducing multi-megabyte images to light, decent-quality images (<50KB).
 */
export interface CompressionResult {
  base64: string;
  originalSize: number;
  compressedSize: number;
}

export function compressImage(file: File, maxDimension: number = 800, quality: number = 0.7): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    // Verify file is an image
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image."));
      return;
    }

    const originalSize = file.size;
    const reader = new FileReader();

    reader.onload = (event) => {
      const originalBase64 = event.target?.result as string;

      try {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions while maintaining aspect ratio
            if (width > height) {
              if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              }
            } else {
              if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              resolve({
                base64: originalBase64,
                originalSize,
                compressedSize: originalSize,
              });
              return;
            }

            // Draw image onto canvas with new dimensions
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to JPEG
            const mimeType = "image/jpeg";
            const base64 = canvas.toDataURL(mimeType, quality);

            // Estimate size from base64 string
            const compressedSize = Math.round((base64.length - 814) * 0.75); // approx size

            resolve({
              base64,
              originalSize,
              compressedSize,
            });
          } catch (canvasErr) {
            console.warn("Canvas compression failed, falling back to original image:", canvasErr);
            resolve({
              base64: originalBase64,
              originalSize,
              compressedSize: originalSize,
            });
          }
        };

        img.onerror = (imgErr) => {
          console.warn("Image load failed in compressor, falling back to original base64:", imgErr);
          resolve({
            base64: originalBase64,
            originalSize,
            compressedSize: originalSize,
          });
        };

        img.src = originalBase64;
      } catch (err) {
        console.warn("Image creation or source assignment failed, falling back to original base64:", err);
        resolve({
          base64: originalBase64,
          originalSize,
          compressedSize: originalSize,
        });
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file."));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Format bytes to a human-readable size (e.g. 1.2 MB or 45 KB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Downloads a base64 encoded data URL as a file using Blob binary translation to avoid browser limits.
 */
export function downloadBase64Image(base64DataUrl: string, fileName: string) {
  try {
    const parts = base64DataUrl.split(";base64,");
    if (parts.length !== 2) {
      throw new Error("Invalid base64 format");
    }
    const mimeType = parts[0].split(":")[1];
    const rawData = window.atob(parts[1]);
    const rawDataLength = rawData.length;
    const uInt8Array = new Uint8Array(rawDataLength);

    for (let i = 0; i < rawDataLength; ++i) {
      uInt8Array[i] = rawData.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (err) {
    console.error("Failed to download image via Blob, running direct anchor fallback:", err);
    const link = document.createElement("a");
    link.href = base64DataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
