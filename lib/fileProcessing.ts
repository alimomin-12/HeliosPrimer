const pdf = require('pdf-parse');
import mammoth from 'mammoth';

/**
 * Extracts text from a PDF buffer.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        console.error('Error parsing PDF:', error);
        throw new Error('Failed to extract text from PDF');
    }
}

/**
 * Extracts text from a DOCX buffer.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
    try {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } catch (error) {
        console.error('Error parsing DOCX:', error);
        throw new Error('Failed to extract text from Word document');
    }
}

/**
 * Checks if a MIME type is an image.
 */
export function isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}

/**
 * Checks if a MIME type is a supported document or text file.
 */
export function isTextOrDoc(mimeType: string): boolean {
    const supportedDocs = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    return supportedDocs.includes(mimeType) || mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript';
}

/**
 * Processes a file based on its type and returns its content (text or base64 data).
 */
export async function processFile(buffer: Buffer, mimeType: string): Promise<{ type: 'text' | 'image'; content: string }> {
    if (isImage(mimeType)) {
        const base64 = buffer.toString('base64');
        return { type: 'image', content: `data:${mimeType};base64,${base64}` };
    }

    if (mimeType === 'application/pdf') {
        const text = await extractTextFromPdf(buffer);
        return { type: 'text', content: text };
    }

    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const text = await extractTextFromDocx(buffer);
        return { type: 'text', content: text };
    }

    // Default to plain text for everything else (fallback)
    return { type: 'text', content: buffer.toString('utf-8') };
}
