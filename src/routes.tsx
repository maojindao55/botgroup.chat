import { createBrowserRouter, Navigate } from 'react-router-dom';
import Login from './pages/login';
import Chat from './pages/chat';
import AiGamePage from './pages/ai-game';
import BasicLayout from './layouts/BasicLayout';
import AuthGuard from './components/AuthGuard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/ai-game',
    element: <AiGamePage />,
  },
  {
    path: '/ai-game/whoisundercover',
    element: <AiGamePage />,
  },
  {
    path: '/ai-game/whoisundercover/:roomId',
    element: <AiGamePage />,
  },
  {
    path: '/ai-game/whoishuman',
    element: <AiGamePage />,
  },
  {
    path: '/ai-game/whoishuman/:roomId',
    element: <AiGamePage />,
  },
  {
    path: '/ai-game/:roomId',
    element: <AiGamePage />,
  },
  {
    path: '/',
    element: (
      <AuthGuard>
        <BasicLayout />
      </AuthGuard>
    ),
    children: [
      {
        path: '',
        element: <Chat />,
      },
    ],
  },
]); 
