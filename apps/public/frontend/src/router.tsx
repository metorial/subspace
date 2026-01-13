import { ModalRoot, Toaster } from '@metorial-io/ui';
import { useEffect, useRef } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom';
import { IndexPage } from './pages';
import { RouterErrorPage } from './pages/_error/routerError';
import { Layout } from './pages/_layout';

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
        element: <Layout />,
        children: [{ path: '', element: <IndexPage /> }]
      }
    ]
  }
]);

export let App = () => {
  return <RouterProvider router={router} />;
};
