import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { useTheme } from './hooks/use-theme';

function App() {
  console.log("App rendering"); // 添加日志
  const { resolvedTheme } = useTheme();
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        richColors
        toastOptions={{
          style: {
            fontSize: '14px',
            fontWeight: '500',
          },
        }}
        theme={resolvedTheme}
      />
    </>
  );
}

export default App;