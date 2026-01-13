import { ModalRoot, Toaster } from '@metorial-io/ui';
import { useEffect, useRef } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { RouterErrorPage } from './pages/_error/routerError';
import { SetupSessionPage } from './pages/setupSession';

let Redirect = ({ to }: { to: string }) => {
  let navigatingRef = useRef(false);
  useEffect(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    window.location.replace(to);
  }, [to]);
  return null;
};

let router = createBrowserRouter([
  {
    path: '/',
    element: (
      <>
        <Outlet />
        <Toaster />
        <ModalRoot />
      </>
    ),
    errorElement: <RouterErrorPage />,
    children: [
      {
        path: '',
        children: [{ path: 'setup-session/:sessionId', element: <SetupSessionPage /> }]
      }
    ]
  }
]);

export let App = () => {
  return <RouterProvider router={router} />;
};
