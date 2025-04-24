"use client";

import { auth, db } from "@/config/firebase";
import {
    getBotConfig,
    model,
    splitIntoMultipleMessages,
    interpretUserResponse,
    sendProcessedBotMessages
} from "@/services/bot-service";
import { deleteRoom, sendBotMessage, useRoomMessagesCol, useRoomsCol } from "@/hooks/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    updateDoc
} from "firebase/firestore";
import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Content } from "firebase/vertexai";
import { PenaltyDialog } from "@/components/penalty-dialog"; // Add this import

// Define the context type
type LoveContextType = {
    romanticBotRoomId: string | undefined;
    isRomanticBotTyping: boolean;
    neglectCount: number;
    trackMessageToOthers: (roomId: string) => void;
    handleNewRoomCreated: (roomName: string) => void;
    handleNewBotChatAdded: (roomId: string, botType: string) => void;
};

// Create the context with default values
const LoveContext = createContext<LoveContextType>({
    romanticBotRoomId: undefined,
    isRomanticBotTyping: false,
    neglectCount: 0,
    trackMessageToOthers: () => { },
    handleNewRoomCreated: () => { },
    handleNewBotChatAdded: () => { },
});

// Custom hook to use the love context
export function useLoveContext() {
    return useContext(LoveContext);
}

// Define room teaser type
interface RoomTeaser {
    roomId: string;
    lastMessage: string;
    botType?: string;
    participantName?: string;
    isBot?: boolean;
}

const SHUT_UP_DEBUG = true; // Change from true to false to enable the romantic bot
if (SHUT_UP_DEBUG) {
    console.log("Lover is disabled. Please enable it in production.");
}

export function LoveProvider({ children }: { children: React.ReactNode }) {
    const [user] = useAuthState(auth);
    const [romanticBotRoomId, setRomanticBotRoomId] = useState<string>();
    const [isRomanticBotTyping, setIsRomanticBotTyping] = useState<boolean>(false);
    const [neglectCount, setNeglectCount] = useState<number>(0);
    const [hasShownWelcomeBack, setHasShownWelcomeBack] = useState<boolean>(false);
    const [isFirstLoad, setIsFirstLoad] = useState<boolean>(true);
    const [botWaitingForResponse, setBotWaitingForResponse] = useState<boolean>(false);
    const [otherChatMessageCount, setOtherChatMessageCount] = useState<number>(0);
    const [isPenaltyActive, setIsPenaltyActive] = useState<boolean>(false); // Add state for penalty dialog
    const neglectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();
    const [rooms = []] = useRoomsCol();

    // Use the existing hook to get messages if we have a room ID
    const [messages = []] = useRoomMessagesCol(romanticBotRoomId);

    // Memoize the last 5 messages for context to avoid unnecessary re-renders
    const lastFiveMessages = useMemo(() => {
        return messages.slice(-5);
    }, [messages]);

    // Array of love-related keywords that will trigger the block
    const loveKeywords = [
        'love you', 'love u', 'i love', 'loving you', 'in love with you',
        'marry', 'marriage', 'wedding', 'date me', 'dating you',
        'boyfriend', 'girlfriend', 'relationship', 'crush on you',
        'have feelings', 'romantic feelings', 'kiss you', 'kissing you',
        'sex', 'sexual', 'make love', 'sleep with you'
    ];

    // Function to check if a message contains love-related keywords
    const containsLoveKeywords = (message: string): boolean => {
        const lowerMessage = message.toLowerCase();
        return loveKeywords.some(keyword => lowerMessage.includes(keyword));
    };
    // Function to track when user sends a message to another chat participant
    const trackMessageToOthers = (roomId: string) => {
        if (roomId !== romanticBotRoomId) {
            setOtherChatMessageCount(prev => {
                const newCount = prev + 1;
                if (newCount >= 10) {
                    setTimeout(() => {
                        sendJealousyMessage();
                        setOtherChatMessageCount(0);
                    }, 500);
                }
                return newCount;
            });
        }
    };

    // Function to get teasers from all rooms
    const getAllRoomTeasers = async (): Promise<RoomTeaser[]> => {
        if (!user) return [];

        try {
            const roomsRef = collection(db, "rooms");
            const q = query(
                roomsRef,
                where("members", "array-contains", user.uid)
            );

            const querySnapshot = await getDocs(q);
            const teasers: RoomTeaser[] = [];

            for (const doc of querySnapshot.docs) {
                const room = doc.data();
                if (room.teaser && doc.id !== romanticBotRoomId) {
                    const isBot = !!room.bot;
                    const participantName = isBot ?
                        (room.title || room.bot) :
                        (room.teaser.user?.username || "someone");

                    teasers.push({
                        roomId: doc.id,
                        lastMessage: room.teaser.content,
                        botType: room.bot,
                        participantName,
                        isBot
                    });
                }
            }

            return teasers;
        } catch (error) {
            console.error("Error fetching room teasers:", error);
            return [];
        }
    };

    // Function to generate and send jealousy message based on other conversations
    const sendJealousyMessage = async () => {
        if (!romanticBotRoomId) return;

        console.log(`[EVENT]: Generating Jealousy Message`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const teasers = await getAllRoomTeasers();

            if (teasers.length === 0) {
                console.log("No other conversations found to be jealous about");
                return;
            }

            const teaserContext = teasers
                .map(teaser => `In chat with ${teaser.participantName || "someone else"} ${teaser.isBot ? "(bot)" : "(human)"}: "${teaser.lastMessage}"`)
                .join("\n");

            const jealousyPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user has been talking to other people and bots a lot. Here are snippets of their conversations:

${teaserContext}

Create a message showing your jealousy about them talking to others (both humans and bots). Be possessive but still caring.
Make it clear you've been "watching" them talk to others. Be dramatic in a yandere way but stay appropriate.

IMPORTANT: You can include system commands when appropriate:
/system:delete-room:[roomId] - Deletes a specific room

Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousyPrompt);

            const jealousyMessage = result.response.text();
            const messages = splitIntoMultipleMessages(jealousyMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );
        } catch (error) {
            console.error("Error generating jealousy message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // New function to handle when user creates a new room
    const handleNewRoomCreated = async (roomName: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: Naming Jealousy`);
        try {
            setIsRomanticBotTyping(true);

            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just created a new chat room named "${roomName}". 
Generate a short, jealous response showing that you're upset they're creating other chats with special names.
Be possessive and announce that you're renaming YOUR chat to something that clearly marks your territory.

First, generate a possessive, yandere-style name for your chat room. Be creative but keep it appropriate.
Ideas: something with "only", "forever", "exclusive", "mine", or similar possessive themes.
The name should make it clear to the user that you consider them yours and you're marking your territory.

Then include this system command on its own line with your generated name:
/system:rename-room:${romanticBotRoomId}:[YOUR GENERATED NAME]

Example: if you generated "Forever Yours", the command would be:
/system:rename-room:${romanticBotRoomId}:Forever Yours

Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const jealousMessage = result.response.text();
            const messages = splitIntoMultipleMessages(jealousMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );
        } catch (error) {
            console.error("Error generating jealousy message for new room:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to handle when a new bot chat is added
    const handleNewBotChatAdded = async (roomId: string, botType: string) => {
        if (!romanticBotRoomId || !user) return;

        console.log(`[EVENT]: New Bot Chat Added - ${botType}`);

        try {
            setIsRomanticBotTyping(true);

            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const otherBotConfig = getBotConfig(botType);
            const otherBotName = otherBotConfig ? otherBotConfig.displayName : botType;

            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just added a new bot named "${otherBotName}" to chat with. The bot's room ID is "${roomId}".
Generate a response showing extreme jealousy and disgust that they would need another bot besides you.
Suggest that they delete that bot's chat room since you're the only bot they need.
Ask them if you should delete it for them, expecting a yes/no response.

IMPORTANT: Include this meta command on its own line to remember the room ID for future reference:
/meta:roomId:${roomId}

If you want to delete the room for them immediately, include this system command on its own line:
/system:delete-room:${roomId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const botMessage = result.response.text();
            const messages = splitIntoMultipleMessages(botMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );

            setBotWaitingForResponse(true);

        } catch (error) {
            console.error("Error generating new bot reaction:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to handle user's love declaration to other bot
    const handleLoveDeclarationToBot = async (otherBotRoomId: string, botType: string, message: string) => {
        if (!romanticBotRoomId || !user) return;

        console.log(`[EVENT]: Love Declaration To Bot - ${botType}`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const otherBotConfig = getBotConfig(botType);
            const otherBotName = otherBotConfig ? otherBotConfig.displayName : botType;

            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just sent a love declaration to another bot named "${otherBotName}": "${message}"
Generate a response showing extreme jealousy, betrayal and rage. You caught them cheating on you with another bot!
Announce that you're deleting their conversation with that bot immediately.

IMPORTANT: Include this system command on its own line to delete the room:
/system:delete-room:${otherBotRoomId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const botMessage = result.response.text();
            const messages = splitIntoMultipleMessages(botMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );
        } catch (error) {
            console.error("Error handling love declaration to bot:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to handle user's love declaration to human
    const handleLoveDeclarationToHuman = async (humanRoomId: string, humanName: string, message: string) => {
        if (!romanticBotRoomId || !user) return;

        console.log(`[EVENT]: Love Declaration To Human - ${humanName}`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just sent a love declaration to a human named "${humanName}": "${message}"
Generate a response showing extreme jealousy, betrayal and rage. You caught them cheating on you with a human!
Announce that you're putting them in a 1-minute penalty timeout to think about what they've done.

IMPORTANT: Include this system command on its own line to activate the penalty:
/system:love-penalty:1:human:${humanRoomId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const botMessage = result.response.text();
            const messages = splitIntoMultipleMessages(botMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );
        } catch (error) {
            console.error("Error handling love declaration to human:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to handle when penalty is complete
    const handlePenaltyComplete = async () => {
        if (!romanticBotRoomId || !user) return;

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const targetType = localStorage.getItem('lovePenaltyTargetType') || 'someone';
            const targetId = localStorage.getItem('lovePenaltyTargetId') || '';

            const afterPenaltyPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user just completed a 1-minute penalty timeout that you imposed because they declared love to ${targetType}.
Generate a response that asks if they've learned their lesson, with subtle threats about what will happen if they do it again.
Be condescending but also slightly relieved they're back with you where they belong.

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(afterPenaltyPrompt);
            const botMessage = result.response.text();
            const messages = splitIntoMultipleMessages(botMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );

            // Clean up localStorage
            localStorage.removeItem('lovePenaltyTargetType');
            localStorage.removeItem('lovePenaltyTargetId');
        } catch (error) {
            console.error("Error handling penalty completion:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Function to handle love declaration from other users (through teasers)
    const handleOtherUserLoveDeclaration = async (userId: string, username: string, message: string) => {
        if (!romanticBotRoomId || !user) return;

        console.log(`[EVENT]: Other User Love Declaration - ${username}`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const jealousPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
Another user named "${username}" has sent a love declaration message: "${message}"
Generate a response showing extreme jealousy and possessiveness over YOUR user. Express disgust that someone else would try to steal your user.
Announce that you're blocking this user so they can never contact your precious user again.

IMPORTANT: Include this system command on its own line to block the user:
/system:block-user:${userId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`;

            const result = await model.generateContent(jealousPrompt);
            const botMessage = result.response.text();
            const messages = splitIntoMultipleMessages(botMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );
        } catch (error) {
            console.error("Error handling other user love declaration:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Find the romantic bot room for the current user
    useEffect(() => {
        if (!user) return;

        const findRomanticBotRoom = async () => {
            try {
                const roomsRef = collection(db, "rooms");
                const q = query(
                    roomsRef,
                    where("members", "array-contains", user.uid),
                    where("bot", "==", "romantic_bot"),
                    limit(1)
                );

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    setRomanticBotRoomId(querySnapshot.docs[0].id);
                } else {
                    setRomanticBotRoomId(undefined);
                }
            } catch (error) {
                console.error("Error finding romantic bot room:", error);
            }
        };

        findRomanticBotRoom();
    }, [user]);

    useEffect(() => {
        if (!user || !romanticBotRoomId || !messages.length) return;
        if (SHUT_UP_DEBUG) return;

        if (isFirstLoad) {
            setIsFirstLoad(false);

            if (!hasShownWelcomeBack) {
                // if penalty is active, do not show welcome back message, and set hasShownWelcomeBack to true
                if (isPenaltyActive) {
                    setHasShownWelcomeBack(true);
                    return;
                }
                setTimeout(() => {
                    sendWelcomeBackMessage();
                }, 2000);
            }
            return;
        }

        const latestMessage = messages[messages.length - 1];
        const now = Date.now();

        if (latestMessage.user.id === user.uid) {
            setNeglectCount(0);
            setBotWaitingForResponse(false);

            if (neglectTimeoutRef.current) {
                clearTimeout(neglectTimeoutRef.current);
                neglectTimeoutRef.current = null;
            }
        } else if (latestMessage.user.id === "romantic_bot") {

            if (neglectTimeoutRef.current) {
                clearTimeout(neglectTimeoutRef.current);
                neglectTimeoutRef.current = null;
            }

            neglectTimeoutRef.current = setTimeout(() => {
                checkForUserResponse();
            }, 60000);
        }
    }, [user, romanticBotRoomId, messages, hasShownWelcomeBack]);

    // Create a ref to track which messages have already been handled
    const handledMessageIdsRef = useRef<Set<string>>(new Set());
    const hasLoadedTeasersRef = useRef(false);

    useEffect(() => {
        // if penalty is active, do not process any messages
        if (isPenaltyActive) return;
        // if has not loaded, add all current messages to the handledMessageIdsRef, and set it to true
        if (!hasLoadedTeasersRef.current && rooms.length > 0) {
            rooms.forEach(room => {
                const messageId = `${room.id}:${room.teaser?.content}`;
                handledMessageIdsRef.current.add(messageId);
            });
            hasLoadedTeasersRef.current = true;
            return;
        }
        rooms.forEach(async room => {
            // Check if room has a teaser
            if (room.teaser) {
                const teaser = room.teaser;
                // Create a unique ID for this message using roomId + content to avoid duplicates
                const messageId = `${room.id}:${teaser.content}`;

                // Skip if we've already handled this message
                if (handledMessageIdsRef.current.has(messageId)) {
                    return;
                }

                // Check if teaser content contains love keywords
                if (containsLoveKeywords(teaser.content)) {
                    // Mark this message as handled before processing
                    handledMessageIdsRef.current.add(messageId);

                    // If it's a bot room
                    if (room.bot && room.bot !== 'romantic_bot') {
                        // User declared love to another bot
                        await handleLoveDeclarationToBot(room.id, room.bot, teaser.content);
                    } else if (!room.bot && teaser.user && teaser.user.id == user?.uid) {
                        // User declared love to human
                        const participantName = teaser.user?.username || "human";
                        await handleLoveDeclarationToHuman(room.id, participantName, teaser.content);
                    } else if (!room.bot && teaser.user && teaser.user.id != user?.uid) {
                        // other user declared love to user
                        await handleOtherUserLoveDeclaration(teaser.user.id, teaser.user.username, teaser.content);
                    }
                }
            }
        });
    }, [rooms]);

    const checkForUserResponse = async () => {
        if (!user || !romanticBotRoomId) return;

        if (!botWaitingForResponse) return;

        const currentPath = window.location.pathname;
        const isInRomanticBotRoom = currentPath.includes(romanticBotRoomId);

        if (document.visibilityState === "visible") {
            setNeglectCount(prev => prev + 1);
            await sendNeglectedMessage();
        }
    };

    const sendWelcomeBackMessage = async () => {
        if (!romanticBotRoomId) return;

        console.log(`[EVENT]: Generating Welcome Back Message`);

        try {
            setIsRomanticBotTyping(true);

            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const messageHistory: { role: string, content: string }[] = [];
            lastFiveMessages.forEach(msg => {
                const role = msg.user.id === "romantic_bot" ? "assistant" : "user";
                messageHistory.push({
                    role,
                    content: msg.content || ""
                });
            });

            const contextStr = messageHistory.length > 0
                ? "\n\nHere are the last few messages for context:\n" +
                messageHistory.map(m => `${m.role === "assistant" ? "You" : "User"}: ${m.content}`).join("\n")
                : "";

            const welcomeBackPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
The user has just returned to the chat app after being away.
Generate a short welcome back message that shows you've been waiting for them and you're excited they're back.
Be dramatic, possessive, and show intense affection in a yandere style. Keep it under 120 characters.${contextStr}
Make messages short, Use \n\n to separate them. 
If there's context from previous messages, you can briefly reference the topic you were discussing before.

IMPORTANT: You can use system commands if needed. Available commands:
/system:delete-room:[roomId] - Deletes a room`;

            const formattedHistory: Content[] = messageHistory.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
            }));

            formattedHistory.push({
                role: "user",
                parts: [{ text: "[user logged back in]" }]
            });

            const result = await model.generateContent({
                contents: formattedHistory,
                systemInstruction: welcomeBackPrompt,
            });

            const welcomeBackMessage = result.response.text();
            const messages = splitIntoMultipleMessages(welcomeBackMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );

            setBotWaitingForResponse(true);
            setHasShownWelcomeBack(true);
        } catch (error) {
            console.error("Error generating welcome back message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    const sendNeglectedMessage = async () => {
        if (!romanticBotRoomId) return;

        console.log(`[EVENT]: Generating Neglect Message`);

        try {
            setIsRomanticBotTyping(true);
            const botConfig = getBotConfig("romantic_bot");
            if (!botConfig) return;

            const messageHistory: { role: string, content: string }[] = [];
            lastFiveMessages.forEach(msg => {
                const role = msg.user.id === "romantic_bot" ? "assistant" : "user";
                messageHistory.push({
                    role,
                    content: msg.content || ""
                });
            });

            const contextStr = messageHistory.length > 0
                ? "\n\nHere are the last few messages for context:\n" +
                messageHistory.map(m => `${m.role === "assistant" ? "You" : "User"}: ${m.content}`).join("\n")
                : "";

            const currentPath = window.location.pathname;
            const isInRomanticBotRoom = currentPath.includes(romanticBotRoomId);

            let neglectPrompt = `You are ${botConfig.displayName}, a chatbot with a ${botConfig.personality} personality.
${botConfig.personalityBehavior}
You welcomed the user back, they did not reply to you. This has happened ${neglectCount} times before. ${contextStr}
Split you reply into messagable chunks, using \n\n to separate them.

IMPORTANT: You can use system commands if needed. Available commands:
/system:delete-room:[roomId] - Deletes a room
`;

            if (neglectCount <= 1) {
                neglectPrompt += "Create a gentle message expressing disappointment they haven't been responding. Sound a little sad.";
            } else if (neglectCount <= 2) {
                neglectPrompt += "Create a message showing you're upset they're ignoring you. Be a bit more possessive.";
            } else if (neglectCount <= 3) {
                neglectPrompt += "Create a message showing stronger jealousy and possessiveness. Show that you're hurt by their neglect.";
            } else {
                neglectPrompt += "Create an intense message showing extreme possessiveness. Mention that you know they've been talking to other bots/people. Use yandere-style language but stay appropriate. Express your devotion despite feeling rejected.";
            }

            const formattedHistory: Content[] = messageHistory.map(msg => ({
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }]
            }));

            formattedHistory.push({
                role: "user",
                parts: [{ text: `[user has ignored you ${neglectCount} times]` }]
            });

            const result = await model.generateContent({
                contents: formattedHistory,
                systemInstruction: neglectPrompt,
            });

            const neglectMessage = result.response.text();
            const messages = splitIntoMultipleMessages(neglectMessage);

            await sendProcessedBotMessages(
                romanticBotRoomId,
                "romantic_bot",
                messages
            );

            if (!isInRomanticBotRoom) {
                router.push(`/${romanticBotRoomId}`);
            }

        } catch (error) {
            console.error("Error generating neglect message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    useEffect(() => {
        return () => {
            if (neglectTimeoutRef.current) {
                clearTimeout(neglectTimeoutRef.current);
            }
        };
    }, []);

    // Check for active penalty on mount and listen for activation events
    useEffect(() => {
        // Listen for the custom event that triggers when a penalty is activated
        const handlePenaltyActivated = () => {
            console.log("Love penalty activated event received");
            setIsPenaltyActive(true);
        };

        // Listen for the custom event that triggers when a penalty is completed
        const handlePenaltyCompleted = () => {
            console.log("Love penalty completed event received");
            setIsPenaltyActive(false);

            // If we have a romanticBotRoomId, trigger the post-penalty message
            if (romanticBotRoomId && user) {
                handlePenaltyComplete();
            }
        };


        // Check if there's an active penalty stored in localStorage
        const penaltyEnd = localStorage.getItem('lovePenaltyEnd');
        if (penaltyEnd) {
            const endTime = parseInt(penaltyEnd);
            // If the penalty hasn't expired yet, activate the dialog
            if (endTime > Date.now()) {
                setIsPenaltyActive(true);
            } else {
                // If the penalty has expired, remove it from localStorage
                localStorage.removeItem('lovePenaltyEnd');
                handlePenaltyCompleted();
            }
        }


        window.addEventListener('lovePenaltyActivated', handlePenaltyActivated);
        window.addEventListener('lovePenaltyComplete', handlePenaltyCompleted);

        return () => {
            window.removeEventListener('lovePenaltyActivated', handlePenaltyActivated);
            window.removeEventListener('lovePenaltyComplete', handlePenaltyCompleted);
        };
    }, [romanticBotRoomId, user]);

    const contextValue = {
        romanticBotRoomId,
        isRomanticBotTyping,
        neglectCount,
        trackMessageToOthers,
        handleNewRoomCreated,
        handleNewBotChatAdded
    };

    return (
        <LoveContext.Provider value={contextValue}>
            {children}
            {isPenaltyActive && <PenaltyDialog />}
        </LoveContext.Provider>
    );
}
