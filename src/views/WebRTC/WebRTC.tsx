import {
  Box,
  Button,
  Center,
  Checkbox,
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
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string"
import QrReader from "react-qr-reader"

enum CameraMode {
  USER = "user",
  ENVIRONMENT = "environment",
}

const WebRTC = () => {
  const [cameraMode, setCameraMode] = useState<CameraMode>(CameraMode.USER)
  const [qrValue, setQrValue] = useState("")
  const [isConnected, setConnected] = useState(false)
  const [enableQr, setEnableQR] = useState(true)

  const [message, setMessage] = useState("")
  const [chatLogs, setChatLogs] = useState<string[]>([])

  const dialog = useDialog()
  const pcRef = useRef<RTCPeerConnection>(null)
  const dcRef = useRef<RTCDataChannel>(null)

  const onConnected = (isConnected: boolean) => {
    setConnected(isConnected)
    if (isConnected) {
      toaster.create({ id: "1", title: "Connected", type: "success" })
      dialog.setOpen(false)
    } else {
      toaster.create({ id: "2", title: "Disconnected", type: "error" })
    }
  }

  const setupConnection = async () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      // bundlePolicy: "max-compat",
      // iceTransportPolicy: "relay",
    })
    console.log("🚀 ~ WebRTC.tsx:57 ~ setupConnection ~ pc:", pc)

    // Create DataChannel for offerer
    const dc = pc.createDataChannel("chat")
    dc.onopen = () => {
      onConnected(true)
    }
    dc.onmessage = (event) => {
      setChatLogs((c) => [...c, `Peer: ${event.data?.message ?? event.data}`])
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
        setChatLogs((c) => [...c, `Peer: ${event.data?.message ?? event.data}`])
      }
    }

    const offer = await pc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    })
    await pc.setLocalDescription(offer)

    pcRef.current = pc
    dcRef.current = dc
  }

  const handleConnect = async (data: string) => {
    if (!pcRef.current) return

    try {
      if (!enableQr) return
      const parsed = JSON.parse(decompressFromEncodedURIComponent(data))

      if (parsed.type === "offer") {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(parsed))
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
      } else if (parsed.type === "answer") {
        // If the remote SDP is an answer, we are the offerer
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(parsed))
      }
      toaster.create({ title: "Scan successful", type: "success" })
      setEnableQR(false)
    } catch (error) {
      console.error(error)
    }
  }

  const sendMessage = () => {
    const msg = "hello"
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({ type: "chat", message: msg }))
      setChatLogs((c) => [...c, `You: ${msg}`])
      setMessage(message)
    }
  }

  const openDialog = async () => {
    dialog.setOpen(true)
  }

  useEffect(() => {
    setupConnection()
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
          <Button borderRadius={8} colorPalette="cyan" onClick={openDialog} size={{ base: "xs", md: "md" }}>
            Vendor
          </Button>

          <Button borderRadius={8} colorPalette="cyan" onClick={openDialog} size={{ base: "xs", md: "md" }}>
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

      {!isConnected && (
        <Dialog.RootProvider value={dialog} placement={"center"} size={"cover"}>
          <Portal>
            <Dialog.Backdrop />
            <Dialog.Positioner>
              <Dialog.Content>
                <Dialog.Header />
                <Dialog.Body d="relative">
                  <Stack justifyContent={"center"} alignItems={"center"}>
                    {!!qrValue && (
                      <Box padding="0" minH="320px" md={{ padding: "2", mt: "6", minH: "360px" }}>
                        <QRCode height="100%" width="100%" value={qrValue} />
                      </Box>
                    )}
                    <Checkbox.Root
                      checked={cameraMode === CameraMode.ENVIRONMENT}
                      onCheckedChange={(e) => setCameraMode(!!e.checked ? CameraMode.ENVIRONMENT : CameraMode.USER)}
                    >
                      <Checkbox.HiddenInput />
                      <Checkbox.Control />
                      <Checkbox.Label>Use rear camera</Checkbox.Label>
                    </Checkbox.Root>
                    {enableQr && (
                      <Box w={{ base: "100px", lg: "100px" }} h={{ base: "100px", lg: "100px" }}>
                        <QrReader
                          showViewFinder={false}
                          facingMode={cameraMode}
                          delay={1000}
                          onScan={async (data: any) => {
                            if (!data) return
                            await handleConnect(data)
                          }}
                          onError={(error: any) => {}}
                        />
                      </Box>
                    )}
                  </Stack>
                </Dialog.Body>
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.RootProvider>
      )}
    </Container>
  )
}

export default WebRTC
