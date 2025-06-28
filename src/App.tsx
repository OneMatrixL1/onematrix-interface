import { AppProvider } from "components/app"
import { AuthLayout, PrivateLayout } from "components/layouts"
import { BrowserRouter, Route, Routes } from "react-router"

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />} path="/auth/*" />
          <Route element={<PrivateLayout />} path="/*" />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}


export default App
