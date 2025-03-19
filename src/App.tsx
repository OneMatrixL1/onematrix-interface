import { Button } from "@chakra-ui/react"
import reactLogo from "assets/react.svg"
import { useState } from "react"

import viteLogo from "/vite.svg"

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="!mx-auto max-w-lg">
      <div className="flex flex-col items-center">
        <a href="https://vite.dev" target="_blank">
          <img alt="Vite logo" className="logo" src={viteLogo} />
        </a>
        <a href="https://react.dev" target="_blank">
          <img alt="React logo" className="logo react" src={reactLogo} />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        <Button variant="outline">HELLO</Button>
        <Button colorPalette="cyan" variant="solid">
          HELLO
        </Button>
        <p>
          Edit <code className="mb-2.5 rounded-xl bg-green-200 !p-4 !text-xl !font-bold">src/App.tsx</code> and save to
          test HMR
        </p>
      </div>
      <p className="read-the-docs bg-primary">Click on the Vite and React logos to learn more</p>
    </div>
  )
}

export default App
