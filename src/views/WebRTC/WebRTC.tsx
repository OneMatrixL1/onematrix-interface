import {
  Box,
  Button,
  Center,
  CloseButton,
  Container,
  Dialog,
  Flex,
  Group,
  HStack,
  Input,
  Portal,
  Stack,
  Tag,
  Text,
  useDialog,
} from "@chakra-ui/react"
import { toaster } from "components/ui/toaster"
import QrScanner from "qr-scanner"
import { QRCodeSVG as QRCode } from "qrcode.react"
import { useEffect, useRef, useState } from "react"
import { RiUserReceived2Line } from "react-icons/ri"
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string"
import QrReader from "react-qr-reader"

enum Role {
  ANSWERER = "ANSWERER",
  OFFERER = "OFFERER",
}

enum Step {
  QRCODE = "QRCODE",
  SCANNER = "SCANNER",
}

const WebRTC = () => {
  const [role, setRole] = useState<null | Role>(null)
  const [step, setStep] = useState<null | Step>(null)
  const roleRef = useRef(role)

  const [qrValue, setQrValue] = useState("")
  const [isConnected, setConnected] = useState(false)

  const [message, setMessage] = useState("")
  const [chatLogs, setChatLogs] = useState<string[]>([])

  const dialog = useDialog()
  const pcRef = useRef<RTCPeerConnection>(null)
  const dcRef = useRef<RTCDataChannel>(null)

  const setupConnection = (user: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    // Create DataChannel for offerer
    const dc = pc.createDataChannel("chat")
    dc.onopen = () => {
      onConnected(true)
    }
    dc.onmessage = (event) => {
      console.log("🚀 ~ WebRTC.tsx:62 ~ setupConnection ~ event:", event)
      setChatLogs((c) => [...c, `Peer: ${event.data}`])
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        // ICE gathering complete, share the finalized localDescription
        if (pc.localDescription) {
          const compressed = compressToEncodedURIComponent(JSON.stringify(pc.localDescription))
          setQrValue(compressed)
        }
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "disconnected") {
        onConnected(false)
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected") {
        onConnected(false)
      }
    }

    pc.ondatachannel = (event) => {
      const dc = event.channel
      dc.onopen = () => {
        onConnected(true)
      }
      dc.onmessage = (event) => {
        setChatLogs((c) => [...c, `Peer: ${event.data}`])
      }
    }

    pcRef.current = pc
    dcRef.current = dc
  }

  const onConnected = (isConnected: boolean) => {
    setConnected(isConnected)
    if (isConnected) {
      toaster.create({ id: "1", title: "Connected", type: "success" })
      dialog.setOpen(false)
    } else {
      toaster.create({ id: "2", title: "Disconnected", type: "error" })
    }
  }

  const createOffer = async (user: boolean = false) => {
    setupConnection(user)

    if (pcRef.current) {
      const offer = await pcRef.current.createOffer()
      await pcRef.current.setLocalDescription(offer)
      // QR will be set when ICE gathering is complete in onicecandidate
    }

    console.log("🚀 ~ WebRTC.tsx:115 ~ createOffer ~ pcRef.current:", pcRef.current)

    // dialog.setOpen(true)
  }

  const handleConnect = async (data: string) => {
    if (!pcRef.current) return

    try {
      const parsed = JSON.parse(decompressFromEncodedURIComponent(data))

      // If the remote SDP is an offer, we are the answerer
      console.log("🚀 ~ WebRTC.tsx:131 ~ handleConnect ~ parsed.type:", parsed)

      if (parsed.type === "offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(parsed))
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
      } else if (parsed.type === "answer") {
        // If the remote SDP is an answer, we are the offerer
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(parsed))
      }
    } catch (error) {
      console.log("🚀 ~ WebRTC.tsx:188 ~ handleConnect ~ error:", error)
      toaster.create({ title: "Error", type: "error" })
    }
  }

  const handleReset = () => {
    setRole(null)
    setStep(null)

    setQrValue("")
    dialog.setOpen(false)
  }

  const sendMessage = () => {
    const msg = "hello"
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "chat", message: msg }))
      setChatLogs((c) => [...c, `You: ${msg}`])
      setMessage(message)
    }
  }

  useEffect(() => {
    setupConnection(false)
  }, [])

  return (
    <Container>
      <Stack alignItems="flex-start" gap={6} paddingBottom={8}>
        {/* <HStack>
          <Text fontWeight="bold">WebRTC Peer-to-Peer</Text>
          <Tag.Root colorPalette={isConnected ? "green" : "orange"} size="lg" variant="surface">
            <Tag.Label>{isConnected ? "Connected" : "Disconnected"}</Tag.Label>
          </Tag.Root>
        </HStack> */}

        <HStack>
          {/* <Center className="scale-x-[-1]">
            <RiUserReceived2Line size={40} />
          </Center> */}
          <Button borderRadius={8} colorPalette="cyan" onClick={() => createOffer()} size={{ base: "xs", md: "md" }}>
            Vendor
          </Button>

          <Button
            borderRadius={8}
            colorPalette="cyan"
            onClick={() => createOffer(true)}
            size={{ base: "xs", md: "md" }}
          >
            User
          </Button>

          <Button borderRadius={8} colorPalette="cyan" onClick={() => sendMessage()} size={{ base: "xs", md: "md" }}>
            send message
          </Button>
        </HStack>
      </Stack>

      <Stack>
        {chatLogs.map((i: string, idx: number) => (
          <Box key={idx}>{i}</Box>
        ))}
      </Stack>

      {!!qrValue && (
        <HStack justify="center" zIndex={99999}>
          <Box padding="2" h={"100%"}>
            <QRCode height="auto" value={qrValue} width="100%" />
          </Box>
        </HStack>
      )}

      <Box position={"fixed"} right={0} bottom={0} zIndex={999}>
        <QrReader
          showViewFinder={false}
          className="scannerPreview"
          facingMode="environment"
          // constraints={{ facingMode: "environment" }}
          // scanDelay={300}
          delay={1000}
          onScan={async (data: any) => {
            console.log("🚀 ~ WebRTC.tsx:211 ~ data:", data)
            if (!data) return
            // qrScannerRef.current = null
            await handleConnect(data)
          }}
          onError={(error: any) => {
            console.log(error)
          }}
        />
      </Box>
    </Container>
  )
}

export default WebRTC
