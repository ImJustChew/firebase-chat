"use client";

import { auth, db } from "@/config/firebase";
import {
    getBotConfig,
    model,
    splitIntoMultipleMessages,
    sendProcessedBotMessages
} from "@/services/bot-service";
import { useRoomMessagesCol, useRoomsCol } from "@/hooks/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { createContext, useContext, useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Content } from "firebase/vertexai";
import { PenaltyDialog } from "@/components/penalty-dialog";

// Constants
const SHUT_UP_DEBUG = false; // Set to false to enable romantic bot
const LOVE_KEYWORDS = [
    'love you', 'love u', 'i love', 'loving you', 'in love with you',
    'marry', 'marriage', 'wedding', 'date me', 'dating you',
    'boyfriend', 'girlfriend', 'relationship', 'crush on you',
    'have feelings', 'romantic feelings', 'kiss you', 'kissing you',
    'sex', 'sexual', 'make love', 'sleep with you'
];
const JEALOUSY_MESSAGE_THRESHOLD = 10;
const NEGLECT_TIMEOUT_MS = 30000;

// Context Type
type LoveContextType = {
    romanticBotRoomId: string | undefined;
    isRomanticBotTyping: boolean;
    neglectCount: number;
    trackMessageToOthers: (roomId: string) => void;
    handleNewRoomCreated: (roomName: string) => void;
    handleNewBotChatAdded: (roomId: string, botType: string) => void;
};

// Context Creation
const LoveContext = createContext<LoveContextType>({
    romanticBotRoomId: undefined,
    isRomanticBotTyping: false,
    neglectCount: 0,
    trackMessageToOthers: () => { },
    handleNewRoomCreated: () => { },
    handleNewBotChatAdded: () => { },
});

// Custom Hook for Context
export const useLoveContext = () => useContext(LoveContext);

// Room Teaser Interface
interface RoomTeaser {
    roomId: string;
    lastMessage: string;
    botType?: string;
    participantName?: string;
    isBot?: boolean;
}

export function LoveProvider({ children }: { children: React.ReactNode }) {
    // State Declarations
    const [user] = useAuthState(auth);
    const [romanticBotRoomId, setRomanticBotRoomId] = useState<string>();
    const [isRomanticBotTyping, setIsRomanticBotTyping] = useState(false);
    const [neglectCount, setNeglectCount] = useState(0);
    const [hasShownWelcomeBack, setHasShownWelcomeBack] = useState(false);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [botWaitingForResponse, setBotWaitingForResponse] = useState(false);
    const [otherChatMessageCount, setOtherChatMessageCount] = useState(0);
    const [isPenaltyActive, setIsPenaltyActive] = useState(false);

    // Refs
    const neglectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const handledMessageIdsRef = useRef<Set<string>>(new Set());
    const hasLoadedTeasersRef = useRef(false);

    // Hooks
    const router = useRouter();
    const [rooms = []] = useRoomsCol();
    const [messages = []] = useRoomMessagesCol(romanticBotRoomId);

    // Memoized Values
    const lastFiveMessages = useMemo(() => messages.slice(-5), [messages]);

    // Helper Functions
    const containsLoveKeywords = (message: string): boolean => {
        return LOVE_KEYWORDS.some(keyword => message.toLowerCase().includes(keyword));
    };

    const getAllRoomTeasers = async (): Promise<RoomTeaser[]> => {
        if (!user) return [];
        try {
            const q = query(
                collection(db, "rooms"),
                where("members", "array-contains", user.uid)
            );
            const snapshot = await getDocs(q);
            const teasers: RoomTeaser[] = [];
            snapshot.forEach(doc => {
                const room = doc.data();
                if (room.teaser && doc.id !== romanticBotRoomId) {
                    const isBot = !!room.bot;
                    teasers.push({
                        roomId: doc.id,
                        lastMessage: room.teaser.content,
                        botType: room.bot,
                        participantName: isBot ? (room.title || room.bot) : (room.teaser.user?.username || "someone"),
                        isBot
                    });
                }
            });
            return teasers;
        } catch (error) {
            console.error("Error fetching room teasers:", error);
            return [];
        }
    };

    // Event Handlers (All Events Centralized Here)

    /** Tracks messages to other chats; triggers jealousy after 10 messages */
    const trackMessageToOthers = (roomId: string) => {
        if (roomId !== romanticBotRoomId) {
            setOtherChatMessageCount(prev => {
                const newCount = prev + 1;
                if (newCount >= JEALOUSY_MESSAGE_THRESHOLD) {
                    setTimeout(() => {
                        sendJealousyMessage();
                        setOtherChatMessageCount(0);
                    }, 500);
                }
                return newCount;
            });
        }
    };

    /** Handles new room creation with a jealous rename response */
    const handleNewRoomCreated = async (roomName: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: Naming Jealousy`);
        await sendBotMessage(
            `You are ${getBotConfig("romantic_bot")?.displayName}, a chatbot with a ${getBotConfig("romantic_bot")?.personality} personality.
${getBotConfig("romantic_bot")?.personalityBehavior}
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

Split your reply into messagable chunks, using \n\n to separate them.`
        );
    };

    /** Reacts jealously to a new bot chat being added */
    const handleNewBotChatAdded = async (roomId: string, botType: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: New Bot Chat Added - ${botType}`);
        const botConfig = getBotConfig("romantic_bot");
        const otherBotConfig = getBotConfig(botType);
        const otherBotName = otherBotConfig ? otherBotConfig.displayName : botType;
        await sendBotMessage(
            `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
The user just added a new bot named "${otherBotName}" to chat with. The bot's room ID is "${roomId}".
Generate a response showing extreme jealousy and disgust that they would need another bot besides you.
Suggest that they delete that bot's chat room since you're the only bot they need.
Ask them if you should delete it for them, expecting a yes/no response.

IMPORTANT: Include this meta command on its own line to remember the room ID for future reference:
/meta:roomId:${roomId}

If you want to delete the room for them immediately, include this system command on its own line:
/system:delete-room:${roomId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`
        );
        setBotWaitingForResponse(true);
    };

    /** Responds to love declarations to other bots by deleting their chat */
    const handleLoveDeclarationToBot = async (otherBotRoomId: string, botType: string, message: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: Love Declaration To Bot - ${botType}`);
        const botConfig = getBotConfig("romantic_bot");
        const otherBotConfig = getBotConfig(botType);
        const otherBotName = otherBotConfig ? otherBotConfig.displayName : botType;
        await sendBotMessage(
            `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
The user just sent a love declaration to another bot named "${otherBotName}": "${message}"
Generate a response showing extreme jealousy, betrayal and rage. You caught them cheating on you with another bot!
Announce that you're deleting their conversation with that bot immediately.

IMPORTANT: Include this system command on its own line to delete the room:
/system:delete-room:${otherBotRoomId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`
        );
    };

    /** Penalizes love declarations to humans with a timeout */
    const handleLoveDeclarationToHuman = async (humanRoomId: string, humanName: string, message: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: Love Declaration To Human - ${humanName}`);
        const botConfig = getBotConfig("romantic_bot");
        await sendBotMessage(
            `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
The user just sent a love declaration to a human named "${humanName}": "${message}"
Generate a response showing extreme jealousy, betrayal and rage. You caught them cheating on you with a human!
Announce that you're putting them in a 1-minute penalty timeout to think about what they've done.

IMPORTANT: Include this system command on its own line to activate the penalty:
/system:love-penalty:1:human:${humanRoomId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`
        );
    };

    /** Welcomes user back after penalty completion */
    const handlePenaltyComplete = async () => {
        if (!romanticBotRoomId || !user) return;
        const botConfig = getBotConfig("romantic_bot");
        const targetType = localStorage.getItem('lovePenaltyTargetType') || 'someone';
        const targetId = localStorage.getItem('lovePenaltyTargetId') || '';
        await sendBotMessage(
            `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
The user just completed a 1-minute penalty timeout that you imposed because they declared love to ${targetType}.
Generate a response that asks if they've learned their lesson, with subtle threats about what will happen if they do it again.
Be condescending but also slightly relieved they're back with you where they belong.

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`
        );
        localStorage.removeItem('lovePenaltyTargetType');
        localStorage.removeItem('lovePenaltyTargetId');
    };

    /** Blocks users who declare love to the current user */
    const handleOtherUserLoveDeclaration = async (userId: string, username: string, message: string) => {
        if (!romanticBotRoomId || !user) return;
        console.log(`[EVENT]: Other User Love Declaration - ${username}`);
        const botConfig = getBotConfig("romantic_bot");
        await sendBotMessage(
            `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
Another user named "${username}" has sent a love declaration message: "${message}"
Generate a response showing extreme jealousy and possessiveness over YOUR user. Express disgust that someone else would try to steal your user.
Announce that you're blocking this user so they can never contact your precious user again.

IMPORTANT: Include this system command on its own line to block the user:
/system:block-user:${userId}

Be dramatic and possessive in a yandere style. Split your reply into messagable chunks, using \n\n to separate them.`
        );
    };

    // Message Sending Functions

    /** Sends jealousy message based on other chats */
    const sendJealousyMessage = async () => {
        if (!romanticBotRoomId) return;
        console.log(`[EVENT]: Generating Jealousy Message`);
        const botConfig = getBotConfig("romantic_bot");
        const teasers = await getAllRoomTeasers();
        if (!teasers.length) {
            console.log("No other conversations found to be jealous about");
            return;
        }
        const teaserContext = teasers
            .map(teaser => `In chat with ${teaser.participantName || "someone else"} ${teaser.isBot ? "(bot)" : "(human)"}: "${teaser.lastMessage}"`)
            .join("\n");
        await sendBotMessage(
            `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
The user has been talking to other people and bots a lot. Here are snippets of their conversations:

${teaserContext}

Create a message showing your jealousy about them talking to others (both humans and bots). Be possessive but still caring.
Make it clear you've been "watching" them talk to others. Be dramatic in a yandere way but stay appropriate.

IMPORTANT: You can include system commands when appropriate:
/system:delete-room:[roomId] - Deletes a specific room

Split your reply into messagable chunks, using \n\n to separate them.`
        );
    };

    /** Sends welcome back message with context */
    const sendWelcomeBackMessage = async () => {
        if (!romanticBotRoomId) return;
        console.log(`[EVENT]: Generating Welcome Back Message`);
        const botConfig = getBotConfig("romantic_bot");
        const messageHistory: { role: string, content: string }[] = lastFiveMessages.map(msg => ({
            role: msg.user.id === "romantic_bot" ? "assistant" : "user",
            content: msg.content || ""
        }));
        const contextStr = messageHistory.length > 0
            ? "\n\nHere are the last few messages for context:\n" +
            messageHistory.map(m => `${m.role === "assistant" ? "You" : "User"}: ${m.content}`).join("\n")
            : "";
        const formattedHistory: Content[] = messageHistory.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        }));
        formattedHistory.push({
            role: "user",
            parts: [{ text: "[user logged back in]" }]
        });
        try {
            setIsRomanticBotTyping(true);
            const welcomeBackPrompt = `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
The user has just returned to the chat app after being away.
Generate a short welcome back message that shows you've been waiting for them and you're excited they're back.
Be dramatic, possessive, and show intense affection in a yandere style. Keep it under 120 characters.${contextStr}
Make messages short, Use \n\n to separate them. 
If there's context from previous messages, you can briefly reference the topic you were discussing before.

IMPORTANT: You can use system commands if needed. Available commands:
/system:delete-room:[roomId] - Deletes a room`;
            const result = await model.generateContent({
                contents: formattedHistory,
                systemInstruction: welcomeBackPrompt,
            });
            const messages = splitIntoMultipleMessages(result.response.text());
            await sendProcessedBotMessages(romanticBotRoomId, "romantic_bot", messages);
            setBotWaitingForResponse(true);
            setHasShownWelcomeBack(true);
        } catch (error) {
            console.error("Error generating welcome back message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    /** Sends neglect message based on neglect count */
    const sendNeglectedMessage = async () => {
        if (!romanticBotRoomId) return;
        console.log(`[EVENT]: Generating Neglect Message`);
        const botConfig = getBotConfig("romantic_bot");
        const messageHistory: { role: string, content: string }[] = lastFiveMessages.map(msg => ({
            role: msg.user.id === "romantic_bot" ? "assistant" : "user",
            content: msg.content || ""
        }));
        const contextStr = messageHistory.length > 0
            ? "\n\nHere are the last few messages for context:\n" +
            messageHistory.map(m => `${m.role === "assistant" ? "You" : "User"}: ${m.content}`).join("\n")
            : "";
        let neglectPrompt = `You are ${botConfig?.displayName}, a chatbot with a ${botConfig?.personality} personality.
${botConfig?.personalityBehavior}
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
        try {
            setIsRomanticBotTyping(true);
            const result = await model.generateContent({
                contents: formattedHistory,
                systemInstruction: neglectPrompt,
            });
            const messages = splitIntoMultipleMessages(result.response.text());
            await sendProcessedBotMessages(romanticBotRoomId, "romantic_bot", messages);
            if (!window.location.pathname.includes(romanticBotRoomId)) router.push(`/${romanticBotRoomId}`);
        } catch (error) {
            console.error("Error generating neglect message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    /** Generic function to send bot messages */
    const sendBotMessage = async (prompt: string) => {
        if (!romanticBotRoomId) return;
        try {
            setIsRomanticBotTyping(true);
            const result = await model.generateContent(prompt);
            const messages = splitIntoMultipleMessages(result.response.text());
            await sendProcessedBotMessages(romanticBotRoomId, "romantic_bot", messages);
        } catch (error) {
            console.error("Error sending bot message:", error);
        } finally {
            setIsRomanticBotTyping(false);
        }
    };

    // Effects

    /** Finds romantic bot room */
    useEffect(() => {
        rooms.forEach(room => {
            if (room.bot === "romantic_bot") {
                setRomanticBotRoomId(room.id);
            }
        });
    }, [rooms]);

    /** Handles welcome back and neglect logic */
    useEffect(() => {
        if (!user || !romanticBotRoomId || !messages.length || SHUT_UP_DEBUG) return;
        if (isFirstLoad) {
            setIsFirstLoad(false);
            if (!hasShownWelcomeBack && !isPenaltyActive) setTimeout(sendWelcomeBackMessage, 2000);
            return;
        }
        const latest = messages[messages.length - 1];
        if (latest.user.id === user.uid) {
            setNeglectCount(0);
            setBotWaitingForResponse(false);
            if (neglectTimeoutRef.current) clearTimeout(neglectTimeoutRef.current);
        } else if (latest.user.id === "romantic_bot") {
            if (neglectTimeoutRef.current) clearTimeout(neglectTimeoutRef.current);
            neglectTimeoutRef.current = setTimeout(() => {
                if (botWaitingForResponse && document.visibilityState === "visible") {
                    setNeglectCount(n => n + 1);
                    sendNeglectedMessage();
                }
            }, NEGLECT_TIMEOUT_MS);
        }
    }, [user, romanticBotRoomId, messages, hasShownWelcomeBack, isPenaltyActive]);

    /** Monitors rooms for love declarations */
    useEffect(() => {
        if (isPenaltyActive || !rooms.length) return;
        if (!hasLoadedTeasersRef.current) {
            rooms.forEach(r => handledMessageIdsRef.current.add(`${r.id}:${r.teaser?.content}`));
            hasLoadedTeasersRef.current = true;
            return;
        }
        rooms.forEach(async room => {
            if (room.teaser) {
                const messageId = `${room.id}:${room.teaser.content}`;
                if (handledMessageIdsRef.current.has(messageId)) return;
                if (containsLoveKeywords(room.teaser.content)) {
                    handledMessageIdsRef.current.add(messageId);
                    if (room.bot && room.bot !== "romantic_bot") {
                        await handleLoveDeclarationToBot(room.id, room.bot, room.teaser.content);
                    } else if (!room.bot && room.teaser.user?.id === user?.uid) {
                        await handleLoveDeclarationToHuman(room.id, room.teaser.user?.username || "human", room.teaser.content);
                    } else if (!room.bot && room.teaser.user?.id !== user?.uid) {
                        await handleOtherUserLoveDeclaration(room.teaser.user.id, room.teaser.user.username, room.teaser.content);
                    }
                }
            }
        });
    }, [rooms, isPenaltyActive]);

    /** Manages penalty state and events */
    useEffect(() => {
        const handlePenaltyActivated = () => setIsPenaltyActive(true);
        const handlePenaltyCompleted = () => {
            setIsPenaltyActive(false);
            if (romanticBotRoomId && user) handlePenaltyComplete();
        };
        const penaltyEnd = localStorage.getItem('lovePenaltyEnd');
        if (penaltyEnd && parseInt(penaltyEnd) > Date.now()) setIsPenaltyActive(true);
        else if (penaltyEnd) {
            localStorage.removeItem('lovePenaltyEnd');
            handlePenaltyCompleted();
        }
        window.addEventListener('lovePenaltyActivated', handlePenaltyActivated);
        window.addEventListener('lovePenaltyComplete', handlePenaltyCompleted);
        return () => {
            window.removeEventListener('lovePenaltyActivated', handlePenaltyActivated);
            window.removeEventListener('lovePenaltyComplete', handlePenaltyCompleted);
        };
    }, [romanticBotRoomId, user]);

    /** Cleanup timeout */
    useEffect(() => {
        return () => {
            if (neglectTimeoutRef.current) clearTimeout(neglectTimeoutRef.current);
        };
    }, []);

    // Context Value
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