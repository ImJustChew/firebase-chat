import { auth, db } from "@/config/firebase";
import { doc, FirestoreDataConverter, collection, query, Timestamp, setDoc, orderBy, getDoc, where, FieldPath, documentId, updateDoc, arrayUnion, arrayRemove, getDocs, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { useAuthState } from "react-firebase-hooks/auth"
import { useDocumentData, useCollectionData } from 'react-firebase-hooks/firestore';
import { useState, useEffect } from "react";
import { BotConfig } from "@/services/bot-service";

export type User = {
    id: string
    address: string
    email: string
    phoneNumber: string
    username: string
    profilePicture?: string
    blockedUsers?: string[]
}

const userConverter: FirestoreDataConverter<User> = {
    toFirestore: (data: User) => {
        return {
            address: data.address,
            email: data.email,
            phoneNumber: data.phoneNumber,
            username: data.username,
            profilePicture: data.profilePicture,
            blockedUsers: data.blockedUsers || [],
        }
    },
    fromFirestore: (snapshot: any, options: any): User => {
        const data = snapshot.data(options)
        return {
            id: snapshot.id,
            address: data.address,
            email: data.email,
            phoneNumber: data.phoneNumber,
            username: data.username,
            profilePicture: data.profilePicture,
            blockedUsers: data.blockedUsers || [],
        }
    }
}

export const useUserDoc = () => {
    const [user, loading, error] = useAuthState(auth);
    return useDocumentData(user ? doc(db, "users", user.uid).withConverter(userConverter) : undefined, {
        snapshotListenOptions: { includeMetadataChanges: true },
    });
}

export type Room = {
    id: string
    title: string
    members: string[]
    teaser?: Message
    bot?: string  // Bot name reference, if this room has a bot
    description?: string
    createdAt?: Timestamp
    updatedAt?: Timestamp
    createdBy?: string
    isPrivate?: boolean
}

const roomsConverter: FirestoreDataConverter<Room> = {
    toFirestore: (data: Room) => {
        return {
            title: data.title,
            members: data.members,
            teaser: data.teaser,
            bot: data.bot,
            description: data.description,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
            isPrivate: data.isPrivate,
        }
    },
    fromFirestore: (snapshot: any, options: any): Room => {
        const data = snapshot.data(options)
        return {
            id: snapshot.id,
            title: data.title,
            members: data.members,
            teaser: data.teaser,
            bot: data.bot,
            description: data.description,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy,
            isPrivate: data.isPrivate,
        }
    },
}

export const useRoomsCol = () => {
    const [user] = useAuthState(auth);
    return useCollectionData<Room>(user ?
        query(
            collection(db, "rooms").withConverter(roomsConverter),
            where('members', 'array-contains', user.uid || ""),
        ) : undefined,
    );
}

export const useRoomDoc = (roomId: string) => {
    return useDocumentData<Room>(
        roomId ? doc(db, "rooms", roomId).withConverter(roomsConverter) : undefined,
        {
            snapshotListenOptions: { includeMetadataChanges: true },
        }
    );
}

export type Attachment = {
    id: string
    type: string
    url: string
    name: string
    size: number
}
export type Message = {
    id: string
    content: string
    user: {
        id: string
        username: string
        profilePicture?: string
    }
    attachments?: Attachment[]
    isDeleted?: boolean
    timestamp?: Timestamp // firebase optimistic timestamp might be null
}

const messagesConverter: FirestoreDataConverter<Message> = {
    toFirestore: (data: Message) => {
        return {
            content: data.content,
            user: data.user,
            attachments: data.attachments,
            isDeleted: data.isDeleted,
            timestamp: data.timestamp,
        }
    },
    fromFirestore: (snapshot: any, options: any): Message => {
        const data = snapshot.data(options)
        return {
            id: snapshot.id,
            content: data.content,
            user: data.user,
            attachments: data.attachments,
            isDeleted: data.isDeleted,
            timestamp: data.timestamp,
        }
    }
}

export const useRoomMessagesCol = (roomId?: string) => {
    return useCollectionData<Message>(roomId ?
        query(
            collection(db, "rooms", roomId, "messages").withConverter(messagesConverter),
            orderBy("timestamp", "asc")
        ) : undefined
    );
}

const usersConverter: FirestoreDataConverter<User> = {
    toFirestore: (data: User) => {
        return {
            address: data.address,
            email: data.email,
            phoneNumber: data.phoneNumber,
            username: data.username,
            profilePicture: data.profilePicture,
            blockedUsers: data.blockedUsers || [],
        }
    },
    fromFirestore: (snapshot: any, options: any): User => {
        const data = snapshot.data(options)
        return {
            id: snapshot.id,
            address: data.address,
            email: data.email,
            phoneNumber: data.phoneNumber,
            username: data.username,
            profilePicture: data.profilePicture,
            blockedUsers: data.blockedUsers || [],
        }
    }
}

// Add this new function to check if current user is blocked by another user
export const useIsBlockedByUser = () => {
    const [user] = useAuthState(auth);

    return async (otherUserId: string): Promise<boolean> => {
        if (!user) return false;

        try {
            const otherUserRef = doc(db, "users", otherUserId).withConverter(userConverter);
            const otherUserDoc = await getDoc(otherUserRef);

            if (otherUserDoc.exists()) {
                const otherUserData = otherUserDoc.data();
                return otherUserData.blockedUsers?.includes(user.uid) || false;
            }

            return false;
        } catch (error) {
            console.error("Error checking if blocked by user:", error);
            return false;
        }
    };
};

export const useUsersCol = () => {
    const [user] = useAuthState(auth);
    const [users = [], loading, error] = useCollectionData<User>(
        user ? query(
            collection(db, "users").withConverter(usersConverter),
        ) : undefined
    );
    // if user is blocked by another user, filter out that user from the list
    const filteredUsers = user ?
        users.filter((u) => {
            if (u.blockedUsers?.includes(user.uid)) return false; // Don't show blocked users
            return true;
        }) : [];

    return [filteredUsers, loading, error] as const;
};

export const createRoom = async (room: Omit<Room, "id">) => {
    const roomRef = doc(collection(db, "rooms"));
    await setDoc(roomRef, room);
    return roomRef.id;
}

export const useSendMessage = (roomId: string) => {
    const [user] = useAuthState(auth);
    const [userData] = useUserDoc();
    const profilePicture = userData?.profilePicture || "/placeholder.svg?height=200&width=200";

    return async (message: Omit<Message, "id" | "user" | "timestamp">) => {
        if (!user) {
            throw new Error("User not authenticated");
        }
        if (!userData) {
            throw new Error("User data not found");
        }
        const username = userData.username;
        const messageRef = doc(collection(db, "rooms", roomId, "messages"));
        const messageData: Message = {
            ...message,
            id: messageRef.id,
            timestamp: Timestamp.now(),
            user: {
                id: user.uid,
                username,
                profilePicture,
            },
        }
        await setDoc(messageRef, messageData);
        await setDoc(doc(db, "rooms", roomId), {
            teaser: messageData
        }, { merge: true });
        return messageRef.id;
    }
}

export const useDeleteMessage = (roomId: string) => {
    const [user] = useAuthState(auth);
    const userDoc = useUserDoc();
    const userData = userDoc[0] as User;

    return async (messageId: string) => {
        if (!user) {
            throw new Error("User not authenticated");
        }
        if (!userData) {
            throw new Error("User data not found");
        }
        const userId = user.uid || "";
        const username = userData.username || "Unknown User";
        const profilePicture = userData.profilePicture || "/placeholder.svg?height=200&width=200";

        const messageRef = doc(db, "rooms", roomId, "messages", messageId);
        await setDoc(messageRef, {
            isDeleted: true,
            content: "This message has been deleted",
            user: {
                id: userId,
                username,
                profilePicture,
            },
        }, { merge: true });
        // if teaser is the same as the deleted message, set to message deleted
        const roomData = await getDoc(doc(db, "rooms", roomId)).then((doc) => doc.data()) as Room;
        if (roomData?.teaser?.id === messageId) {
            await setDoc(doc(db, "rooms", roomId), {
                teaser: {
                    isDeleted: true,
                    content: "This message has been deleted",
                    user: {
                        id: userId,
                        username,
                        profilePicture,
                    },
                }
            }, { merge: true });
        }
        return messageRef.id;
    }
}

export const useUpdateUserProfile = () => {
    const [user] = useAuthState(auth);
    return async (data: Partial<User>) => {
        if (!user) {
            throw new Error("User not authenticated");
        }
        const userId = user.uid;
        await setDoc(doc(db, "users", userId), data, { merge: true });
        return userId;
    }
}

export const useGetUserById = () => {
    return async (userId: string) => {
        try {
            // Reference to the user document
            const userRef = doc(db, "users", userId).withConverter(usersConverter);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                return userData;
            } else {
                return null;
            }
        } catch (error) {
            console.error("Error getting user by ID:", error);
            throw error;
        }
    };
};

export const useBlockUser = () => {
    const [user] = useAuthState(auth);

    return async (userId: string) => {
        if (!user) {
            throw new Error("User not authenticated");
        }

        try {
            // Update the user's document to add the blocked user to the blockedUsers array
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                blockedUsers: arrayUnion(userId)
            });

            return true;
        } catch (error) {
            console.error("Error blocking user:", error);
            throw error;
        }
    };
};

export const useUnblockUser = () => {
    const [user] = useAuthState(auth);

    return async (userId: string) => {
        if (!user) {
            throw new Error("User not authenticated");
        }

        try {
            // Update the user's document to remove the blocked user from the blockedUsers array
            const userDocRef = doc(db, "users", user.uid);
            await updateDoc(userDocRef, {
                blockedUsers: arrayRemove(userId)
            });

            return true;
        } catch (error) {
            console.error("Error unblocking user:", error);
            throw error;
        }
    };
};

export const useIsUserBlocked = () => {
    const [userProfile] = useUserDoc();

    return (userId: string) => {
        if (!userProfile || !userProfile.blockedUsers) {
            return false;
        }

        return userProfile.blockedUsers.includes(userId);
    };
};

export const useGetBlockedUsers = () => {
    const [userProfile] = useUserDoc();

    return async () => {
        if (!userProfile || !userProfile.blockedUsers || userProfile.blockedUsers.length === 0) {
            return [];
        }

        try {
            const blockedUserIds = userProfile.blockedUsers;

            // Use a single query to get all blocked users at once
            const q = query(
                collection(db, "users").withConverter(usersConverter),
                where(documentId(), "in", blockedUserIds)
            );

            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => doc.data());

        } catch (error) {
            console.error("Error getting blocked users:", error);
            throw error;
        }
    };
};

// Bot Firestore operations
export async function createBotRoom(
    userId: string,
    botName: string,
    botConfig: BotConfig,
    skipInitialGreeting: boolean = false
): Promise<string> {
    const roomRef = await addDoc(collection(db, "rooms"), {
        title: `Chat with ${botConfig.displayName}`,
        description: `Your personal chat with ${botConfig.displayName}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: userId,
        members: [userId],
        isPrivate: true,
        bot: botName // Special property to mark this as a bot room
    });

    // Add initial greeting message from the bot unless we're skipping it
    if (!skipInitialGreeting) {
        await addDoc(collection(db, "rooms", roomRef.id, "messages"), {
            content: botConfig.greeting,
            timestamp: serverTimestamp(),
            user: {
                id: botName,
                username: botConfig.displayName,
                profilePicture: botConfig.profilePicture
            }
        });
    }

    return roomRef.id;
}

// Send a bot message to a room
export async function sendBotMessage(roomId: string, botName: string, botDisplayName: string, botProfilePicture: string, content: string): Promise<string> {
    const messageRef = await addDoc(collection(db, "rooms", roomId, "messages"), {
        content: content,
        timestamp: serverTimestamp(),
        user: {
            id: botName,
            username: botDisplayName,
            profilePicture: botProfilePicture
        }
    });

    // Update the room teaser
    await updateDoc(doc(db, "rooms", roomId), {
        teaser: {
            id: messageRef.id,
            content: content,
            user: {
                id: botName,
                username: botDisplayName,
                profilePicture: botProfilePicture
            },
            timestamp: serverTimestamp()
        },
        updatedAt: serverTimestamp()
    });

    return messageRef.id;
}

export const useRoomMembers = (roomId: string) => {
    const [user] = useAuthState(auth);
    const [roomDoc] = useRoomDoc(roomId);

    return useCollectionData<User>(roomDoc ?
        query(
            collection(db, "users").withConverter(usersConverter),
            where(documentId(), "in", roomDoc.members),
        ) : undefined
    );
}

export const deleteRoom = async (roomId: string) => {
    const roomRef = doc(db, "rooms", roomId);
    await deleteDoc(roomRef);
    return roomRef.id;
}