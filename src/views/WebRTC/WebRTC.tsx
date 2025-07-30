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
import { RiUserReceived2Line, RiUserShared2Line } from "react-icons/ri"

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

  const [qrValue, setQrValue] = useState("")
  const [isConnected, setConnected] = useState(false)

  const [message, setMessage] = useState("")
  const [chatLogs, setChatLogs] = useState<string[]>([])

  const dialog = useDialog()
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner>(null)
  const pcRef = useRef<RTCPeerConnection>(null)
  const dcRef = useRef<RTCDataChannel>(null)

  const setupConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        setQrValue(JSON.stringify(pc.localDescription))
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
      dcRef.current = dc
      dc.onmessage = (event) => {
        setChatLogs((c) => [...c, `Peer: ${event.data}`])
      }
      onConnected(true)
    }

    pcRef.current = pc
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

  const createOffer = async () => {
    setRole(Role.OFFERER)
    setStep(Step.QRCODE)

    setupConnection()
    dialog.setOpen(true)

    if (pcRef.current) {
      const dc = pcRef.current.createDataChannel("chat")
      dcRef.current = dc
      dc.onmessage = (e) => setChatLogs((c) => [...c, `Peer: ${e.data}`])

      const offer = await pcRef.current.createOffer()
      await pcRef.current.setLocalDescription(offer)
    }
  }

  const startAnswer = () => {
    setRole(Role.ANSWERER)
    setStep(Step.SCANNER)

    setTimeout(() => scanQR(), 100)
    dialog.setOpen(true)
  }

  const handleConnect = async (data: string) => {
    try {
      if (role === Role.OFFERER) {
        if (!pcRef.current) return
        const answer = JSON.parse(data)
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
        onConnected(true)
      }
      if (role === Role.ANSWERER) {
        setupConnection()
        if (!pcRef.current) return
        const offer = JSON.parse(data)
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
        setQrValue(JSON.stringify(pcRef.current.localDescription))
        setStep(Step.QRCODE)
      }
    } catch {
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
    if (dcRef.current?.readyState === "open" && message.trim()) {
      dcRef.current.send(message)
      setChatLogs((c) => [...c, `You: ${message}`])
      setMessage("")
    }
  }

  const scanQR = async () => {
    const scanner = new QrScanner(
      videoRef.current!,
      async (result) => {
        scanner.stop()
        qrScannerRef.current = null
        await handleConnect(result.data)
      },
      { returnDetailedScanResult: true },
    )

    qrScannerRef.current = scanner
    scanner.start()
  }

  useEffect(() => {
    if (!dialog.open || step !== Step.SCANNER) {
      qrScannerRef.current?.stop()
    }
  }, [dialog.open, step])

  return (
    <Container>
      <Stack alignItems="flex-start" gap={6}>
        <HStack>
          <Text fontWeight="bold">WebRTC Peer-to-Peer</Text>
          <Tag.Root colorPalette={isConnected ? "green" : "orange"} size="lg" variant="surface">
            <Tag.Label>{isConnected ? "Connected" : "Disconnected"}</Tag.Label>
          </Tag.Root>
        </HStack>

        {!isConnected && (
          <Flex flexWrap="wrap" gap={6}>
            <Stack>
              <Center>
                <RiUserShared2Line size={40} />
              </Center>
              <Button borderRadius={8} colorPalette="purple" onClick={createOffer} size={{ base: "xs", md: "md" }}>
                Start Offer (Peer A)
              </Button>
            </Stack>

            <Stack>
              <Center className="scale-x-[-1]">
                <RiUserReceived2Line size={40} />
              </Center>
              <Button borderRadius={8} colorPalette="cyan" onClick={startAnswer} size={{ base: "xs", md: "md" }}>
                Scan Offer (Peer B)
              </Button>
            </Stack>
          </Flex>
        )}

        {isConnected && (
          <Stack gap={6}>
            <Group attached w="full">
              <Input
                flex={1}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage()
                }}
                placeholder="Enter message..."
                value={message}
              />
              <Button onClick={sendMessage}>Send</Button>
            </Group>

            <Stack>
              <Text fontWeight="bold">Chat:</Text>
              <Stack gap={0}>
                {chatLogs.map((message, index) => (
                  <Text fontSize="sm" key={index}>
                    {message}
                  </Text>
                ))}
                {chatLogs.length === 0 && <Text fontSize="sm">...</Text>}
              </Stack>
            </Stack>
          </Stack>
        )}
      </Stack>

      <Dialog.Root
        closeOnEscape={false}
        closeOnInteractOutside={false}
        open={dialog.open}
        scrollBehavior="inside"
        size="md"
      >
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content mx={3}>
              <Dialog.Header>
                <Dialog.Title display="flex" fontSize="md" gap={4}>
                  <HStack>
                    Role:
                    <Tag.Root colorPalette={role === Role.OFFERER ? "purple" : "cyan"} size="lg" variant="surface">
                      <Tag.Label>{role}</Tag.Label>
                    </Tag.Root>
                  </HStack>
                  <HStack>
                    Step:
                    <Tag.Root colorPalette="orange" size="lg" variant="surface">
                      <Tag.Label>{step}</Tag.Label>
                    </Tag.Root>
                  </HStack>
                </Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {step === Step.QRCODE && (
                  <Stack gap={4}>
                    <QRCode height="auto" value={qrValue} width="100%" />

                    <Group attached w="full">
                      <Input disabled flex={1} value={qrValue} />
                      <Button
                        bg="bg.subtle"
                        onClick={() => {
                          navigator.clipboard.writeText(qrValue).then(() => {
                            toaster.create({ duration: 1000, title: "Copied" })
                          })
                        }}
                        variant="outline"
                      >
                        Copy
                      </Button>
                    </Group>

                    {role === Role.OFFERER ? (
                      <Button
                        onClick={() => {
                          setQrValue("")
                          setStep(Step.SCANNER)
                          setTimeout(() => scanQR(), 100)
                        }}
                      >
                        Scan Answer
                      </Button>
                    ) : (
                      <Button disabled>Waiting connection...</Button>
                    )}
                  </Stack>
                )}

                {step === Step.SCANNER && (
                  <Stack gap={4}>
                    <Box borderWidth={1} overflow="hidden" p={2}>
                      <video className="aspect-square w-full" muted playsInline ref={videoRef} />
                    </Box>

                    <Group attached w="full">
                      <Input
                        flex={1}
                        onChange={(e) => setQrValue(e.target.value)}
                        placeholder="Enter..."
                        value={qrValue}
                      />
                      <Button
                        bg="bg.subtle"
                        onClick={async () => {
                          setQrValue(await navigator.clipboard.readText())
                          toaster.create({ duration: 1000, title: "Parsed" })
                        }}
                        variant="outline"
                      >
                        Parse
                      </Button>
                    </Group>

                    <Button onClick={() => handleConnect(qrValue)}>Connect</Button>
                  </Stack>
                )}
              </Dialog.Body>

              <Dialog.CloseTrigger as="div">
                <CloseButton onClick={handleReset} size="sm" />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Container>
  )
}

export default WebRTC
