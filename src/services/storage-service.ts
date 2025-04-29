import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { Attachment } from '@/hooks/firestore';

/**
 * Uploads a file to Firebase Storage and returns attachment metadata
 */
export const uploadFileToStorage = async (
    file: File,
    roomId: string,
    userId: string
): Promise<Attachment> => {
    // Create a unique filename
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;

    // Create storage reference
    const fileRef = ref(storage, `chatAttachments/${roomId}/${userId}/${fileName}`);

    // Upload file
    await uploadBytes(fileRef, file);

    // Get download URL
    const url = await getDownloadURL(fileRef);

    // Determine file type
    let fileType = 'file';
    if (file.type.startsWith('image/')) {
        fileType = 'image';
    } else if (file.type.startsWith('video/')) {
        fileType = 'video';
    } else if (file.type === 'image/gif') {
        fileType = 'gif';
    }

    // Return attachment object to be saved in Firestore
    return {
        id: timestamp.toString(),
        type: fileType,
        url: url,
        name: file.name,
        size: file.size,
    };
};