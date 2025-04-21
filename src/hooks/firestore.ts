import { auth, db } from "@/config/firebase";
import { doc, FirestoreDataConverter, collection, query, Timestamp, setDoc, orderBy } from 'firebase/firestore';
import { useAuthState } from "react-firebase-hooks/auth"
import { useDocumentData, useCollectionData } from 'react-firebase-hooks/firestore';

export const useUserDoc = () => {
    const [user, loading, error] = useAuthState(auth);
    return useDocumentData(user ? doc(db, "users", user?.uid || "") : undefined, {
        snapshotListenOptions: { includeMetadataChanges: true },
    });
}

type Room = {
    id: string
    title: string
    members: string[]
    teaser?: {
        message: string
        username: string
        user: string,
        date: Timestamp
    }
}

type User = {
    id: string
    address: string
    email: string
    phoneNumber: string
    username: string
    profilePicture?: string
}

const roomsConverter: FirestoreDataConverter<Room> = {
    toFirestore: (data: Room) => {
        return {
            title: data.title,
            members: data.members,
            teaser: data.teaser,
        }
    },
    fromFirestore: (snapshot: any, options: any): Room => {
        const data = snapshot.data(options)
        return {
            id: snapshot.id,
            title: data.title,
            members: data.members,
            teaser: data.teaser,
        }
    },
}

export const useRoomsCol = () => {
    return useCollectionData<Room>(
        query(collection(db, "rooms").withConverter(roomsConverter)),
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
type Message = {
    id: string
    content: string
    user: {
        id: string
        username: string
        profilePicture?: string
    }
    date: Timestamp,
    attachments?: Attachment[]
    isDeleted?: boolean
    timestamp: Timestamp
}

const messagesConverter: FirestoreDataConverter<Message> = {
    toFirestore: (data: Message) => {
        return {
            content: data.content,
            user: data.user,
            date: data.date,
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
            date: data.date,
            attachments: data.attachments,
            isDeleted: data.isDeleted,
            timestamp: data.timestamp,
        }
    }
}

export const useRoomMessagesCol = (roomId: string) => {
    return useCollectionData<Message>(
        query(
            collection(db, "rooms", roomId, "messages").withConverter(messagesConverter),
            orderBy("date", "asc")
        ),
    );
}

const usersConverter: FirestoreDataConverter<User> = {
    toFirestore: (data: User) => {
        return {
            address: data.address,
            email: data.email,
            phoneNumber: data.phoneNumber,
            username: data.username,
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
        }
    }
}


export const useUsersCol = () => {
    return useCollectionData<User>(
        query(collection(db, "users").withConverter(usersConverter)),
    );
}

export const createRoom = async (room: Omit<Room, "id">) => {
    const roomRef = doc(collection(db, "rooms"));
    await setDoc(roomRef, room);
    return roomRef.id;
}