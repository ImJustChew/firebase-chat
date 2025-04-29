'use client'
import { Toaster } from "@/components/ui/sonner"
import { SidebarProvider, SidebarInset, Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInput, SidebarFooter } from '@/components/ui/sidebar';
import Fuse from 'fuse.js';
import { useState, useMemo, useRef } from 'react';

import "./globals.css";
import LoginDialog from "@/components/login-dialog";
import { Button } from '@/components/ui/button';
import { auth, app } from '@/config/firebase';
import { formatDistanceToNow } from 'date-fns';
import { useRoomsCol, useUserDoc } from '@/hooks/firestore';
import { LogOut, Moon, Plus, Settings, Sun } from 'lucide-react';
import CreateChatDialog from '@/components/create-chat-dialog';
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import ProfileDialog from "@/components/profile-dialog";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { LoveProvider } from "@/components/love-provider";
import { useAuthState } from "react-firebase-hooks/auth";
import { SYSTEM_COMMAND_REGEX } from "@/services/bot-service";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [unsortedRoom = [], loading, error] = useRoomsCol();
  const [user, loadingUser, errorUser] = useUserDoc();
  const [userAuth] = useAuthState(auth);
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadRooms, setUnreadRooms] = useState<Record<string, boolean>>({});
  const initializedRoomsRef = useRef<Set<string>>(new Set());
  const previousRoomsRef = useRef<Record<string, any>>({});

  const isMobile = useIsMobile();
  const pathname = useLocation();
  const navigate = useNavigate();

  const rooms = unsortedRoom.sort((a, b) => {
    if (!a.teaser && b.teaser) return -1;
    if (a.teaser && !b.teaser) return 1;
    if (a.teaser && b.teaser) {
      return (b.teaser.timestamp?.toDate() ?? new Date()).getTime() - (a.teaser.timestamp?.toDate() ?? new Date()).getTime();
    }
    return 0;
  });

  const roomId = pathname.pathname.split("/")[1];

  useEffect(() => {
    if (roomId) {
      setUnreadRooms(prev => ({
        ...prev,
        [roomId]: false
      }));
    }
  }, [roomId]);

  useEffect(() => {
    if (!rooms.length || !user) return;

    const roomsMap: Record<string, any> = {};
    rooms.forEach(room => {
      roomsMap[room.id] = {
        teaser: room.teaser ? {
          timestamp: room.teaser.timestamp?.toDate().getTime(),
          content: room.teaser.content,
          userId: room.teaser.user?.id
        } : null
      };

      initializedRoomsRef.current.add(room.id);
    });

    if (Object.keys(previousRoomsRef.current).length === 0) {
      previousRoomsRef.current = roomsMap;
    }
  }, [rooms, user]);

  useEffect(() => {
    if (!rooms.length || !user || !userAuth) return;

    const newUnreadState = { ...unreadRooms };
    let hasChanges = false;

    rooms.forEach(room => {
      if (!initializedRoomsRef.current.has(room.id)) return;

      const prevRoomData = previousRoomsRef.current[room.id];

      if (room.teaser &&
        prevRoomData &&
        room.teaser.timestamp &&
        (!prevRoomData.teaser ||
          prevRoomData.teaser.timestamp !== room.teaser.timestamp?.toDate().getTime()) &&
        room.teaser.user?.id !== userAuth.uid &&
        room.id !== roomId) {

        newUnreadState[room.id] = true;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      setUnreadRooms(newUnreadState);
    }

    const updatedRoomsMap: Record<string, any> = {};
    rooms.forEach(room => {
      updatedRoomsMap[room.id] = {
        teaser: room.teaser ? {
          timestamp: room.teaser.timestamp?.toDate().getTime(),
          content: room.teaser.content,
          userId: room.teaser.user?.id
        } : null
      };
    });
    previousRoomsRef.current = updatedRoomsMap;
  }, [rooms, user, roomId, unreadRooms]);

  const fuse = useMemo(() => new Fuse(rooms, {
    keys: ['title', 'teaser.content', 'teaser.user.username'],
    threshold: 0.4,
    includeScore: true
  }), [rooms]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return rooms;
    const results = fuse.search(searchQuery);
    return results.map(result => result.item);
  }, [fuse, searchQuery, rooms]);

  useEffect(() => {
    if (rooms.length > 0 && !roomId && !isMobile) {
      navigate(`/${rooms[0].id}`);
    }
  }, [rooms, roomId, navigate, isMobile]);

  const formatMessageContent = (content: string): string => {
    if (!content) return content;

    const lines = content.split('\n');
    for (const line of lines) {
      if (line.match(SYSTEM_COMMAND_REGEX)) {
        return "Executed command: ...";
      }
    }

    return content;
  };

  return (
    <Sidebar collapsible="none" className="h-screen min-w-screen md:min-w-auto" hidden={isMobile && !!roomId}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">
            Messages
          </div>
          <div className="flex items-center gap-2">
            <CreateChatDialog>
              <Button variant="ghost" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </CreateChatDialog>
          </div>
        </div>
        <SidebarInput
          placeholder="Type to search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-0">
          <SidebarGroupContent>
            {filteredRooms.length > 0 ? (
              filteredRooms.map((room) => (
                <NavLink
                  to={`/${room.id}`}
                  key={room.id}
                  className="flex flex-col items-start gap-1 whitespace-nowrap border-b p-3 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="font-medium">{room.title}</span>{" "}
                    {unreadRooms[room.id] && (
                      <span className="absolute right-2 top-[calc(50%-6px)] flex size-3 rounded-full bg-blue-500"></span>
                    )}
                    {room.teaser && <span className="ml-auto text-xs">{formatDistanceToNow(room.teaser.timestamp?.toDate() ?? new Date(), {})}</span>}
                  </div>
                  {room.teaser ? (
                    <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs">
                      <span className="font-medium">{room.teaser.user?.username}: </span>
                      {formatMessageContent(room.teaser.content)}
                    </span>
                  ) : (
                    <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs text-muted-foreground">
                      It's kinda chilly here...
                    </span>
                  )}
                </NavLink>
              ))
            ) : (
              <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                No rooms found
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {user && <div className="flex w-full items-center justify-between border-t p-4">
          <div className="flex items-center gap-2">
            <img
              src={user.profilePicture || "/placeholder.svg?height=200&width=200"}
              alt="User Avatar"
              className="h-8 w-8 rounded-full"
            />
            <span className="text-sm font-medium">{user.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  >
                    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Theme</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <ProfileDialog>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </ProfileDialog>
                </TooltipTrigger>
                <TooltipContent>User Settings</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>}
      </SidebarFooter>
    </Sidebar >
  )
}

export default function RootLayout() {

  useEffect(() => {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(
        import.meta.env.VITE_RECAPTCHA_SITE_KEY || ''
      ),
      isTokenAutoRefreshEnabled: true,
    })

  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <LoveProvider>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "280px",
            } as React.CSSProperties
          }
        >
          <AppSidebar />
          <LoginDialog />
          <SidebarInset className="max-h-screen">
            <Outlet />
          </SidebarInset>
        </SidebarProvider>
      </LoveProvider>
      <Toaster />
    </ThemeProvider>
  );
}
