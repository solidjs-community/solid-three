import { SolidBaseRoot } from "@kobalte/solidbase/client"
import { Router } from "@solidjs/router"
import { FileRoutes } from "@solidjs/start/router"

export default function App() {
  return (
    <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")} root={SolidBaseRoot}>
      <FileRoutes />
    </Router>
  )
}
