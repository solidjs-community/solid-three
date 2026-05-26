// @refresh reload
import { mount, StartClient } from "@solidjs/start/client"

const appElement = document.getElementById("app")
if (appElement) {
  mount(() => <StartClient />, appElement)
}
