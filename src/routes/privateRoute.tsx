import { Bridge } from "views/Bridge"
import { Guide } from "views/Component"
import { MultiSign } from "views/MultiSign"
import { Transfer } from "views/Transfer"
import { WebRTC } from "views/WebRTC"

const privateRoute = {
  bridge: {
    component: Bridge,
    name: "Bridge",
    path: "/bridge",
  },
  guide: {
    component: Guide,
    name: "Component",
    path: "/component",
  },
  home: {
    component: Bridge,
    name: "Bridge",
    path: "/bridge",
  },
  multiSign: {
    component: MultiSign,
    name: "Vault",
    path: "/vault",
  },
  transfer: {
    component: Transfer,
    name: "Transfer",
    path: "/transfer",
  },
  webRTC: {
    component: WebRTC,
    name: "WebRTC",
    path: "/web-rtc",
  },
}

export default privateRoute
