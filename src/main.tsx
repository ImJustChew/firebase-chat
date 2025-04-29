import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/page';
import MessagePage from './app/[roomId]/page';
import RootLayout from './app/layout';
import {
    createBrowserRouter,
    RouterProvider,
} from "react-router";

const router = createBrowserRouter([
    {
        path: "/",
        Component: RootLayout,
        children: [
            { index: true, Component: App },
            { path: "/:roomId", Component: MessagePage },
        ]
    },
]);


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
)
