import {
  Box,
  Button,
  CloseButton,
  Container,
  Dialog,
  Flex,
  Group,
  HStack,
  Input,
  Portal,
  Stack,
  Text,
  useDialog,
} from "@chakra-ui/react"
import { toaster } from "components/ui/toaster"
import QrScanner from "qr-scanner"
import { QRCodeSVG as QRCode } from "qrcode.react"
import React, { useEffect, useRef, useState } from "react"

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

  const [status, setStatus] = useState("Not connected")
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState<string[]>([])

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
      handleDisconnect(pc.iceConnectionState)
    }

    pc.onconnectionstatechange = () => {
      handleDisconnect(pc.connectionState)
    }

    const handleDisconnect = (state: RTCIceConnectionState | RTCPeerConnectionState) => {
      if (state === "disconnected" || state === "failed" || state === "closed") {
        setStatus("Not connected")
        toaster.create({ title: "Disconnected" })
      }
    }

    pc.ondatachannel = (event) => {
      const dc = event.channel
      dcRef.current = dc
      dc.onmessage = (event) => {
        setChat((c) => [...c, `Peer: ${event.data}`])
      }
      setStatus("Connected (Answer side)")
      toaster.create({ title: "Connected" })
      dialog.setOpen(false)
    }

    pcRef.current = pc
  }

  const createOffer = async () => {
    setRole(Role.OFFERER)
    setStep(Step.QRCODE)

    setupConnection()
    dialog.setOpen(true)

    if (pcRef.current) {
      const dc = pcRef.current.createDataChannel("chat")
      dcRef.current = dc
      dc.onmessage = (e) => setChat((c) => [...c, `Peer: ${e.data}`])

      const offer = await pcRef.current.createOffer()
      await pcRef.current.setLocalDescription(offer)
    }
  }

  const scanQR = async (role: Role, step: Step) => {
    setRole(role)
    setStep(step)

    setTimeout(() => {
      if (!videoRef.current) return

      // const scanner = new QrScanner(
      //   videoRef.current,
      //   async (result) => {
      //     if (!videoRef.current || !pcRef.current) return
      //     scanner.stop()
      //     qrScannerRef.current = null

      //     console.log("result", result.data)
      //     const data = JSON.parse(result.data)
      //     console.log("data", data)

      //     if (type === "offer") {
      //       // setRole(Role.ANSWERER)
      //       setupConnection()
      //       await pcRef.current.setRemoteDescription(new RTCSessionDescription(data))
      //       const answer = await pcRef.current.createAnswer()
      //       await pcRef.current.setLocalDescription(answer)
      //       setQrValue(JSON.stringify(pcRef.current.localDescription))
      //     }
      //     if (type === "answer") {
      //       await pcRef.current.setRemoteDescription(new RTCSessionDescription(data))
      //       setStatus("Connected (Offer side)")
      //     }
      //   },
      //   { returnDetailedScanResult: true },
      // )

      // qrScannerRef.current = scanner
      // scanner.start()
    }, 100)
  }

  const sendMessage = () => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(message)
      setChat((c) => [...c, `You: ${message}`])
      setMessage("")
    }
  }

  useEffect(() => {
    return () => {
      qrScannerRef.current?.stop()
    }
  }, [])

  return (
    <Container>
      <Text fontWeight="bold">WebRTC Peer-to-Peer</Text>
      <Text>Status: {status}</Text>

      <Flex gap={2}>
        <Button colorPalette="purple" onClick={createOffer}>
          Start Offer (Peer A)
        </Button>
        <Button
          colorPalette="purple"
          onClick={() => {
            setRole(Role.ANSWERER)
            setStep(Step.SCANNER)
            dialog.setOpen(true)
          }}
        >
          Scan Offer (Peer B)
        </Button>
      </Flex>

      {status.startsWith("Connected") && (
        <>
          <Group attached w="full">
            <Input
              flex={1}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message..."
              value={message}
            />
            <Button onClick={sendMessage}>Send</Button>
          </Group>

          <div style={{ marginTop: 20 }}>
            <h4>Chat Log</h4>
            <ul>
              {chat.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        </>
      )}

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
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Connect WebRTC</Dialog.Title>
              </Dialog.Header>
              <Dialog.Body>
                {step === Step.QRCODE && (
                  <Stack>
                    <QRCode height="auto" value={qrValue} width="100%" />

                    <Group attached w="full">
                      <Input disabled flex={1} value={qrValue} />
                      <Button
                        bg="bg.subtle"
                        onClick={() => {
                          navigator.clipboard.writeText(qrValue).then(() => {
                            toaster.create({ title: "Copied" })
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
                        }}
                      >
                        Scan Answer
                      </Button>
                    ) : (
                      <Box h={10} />
                    )}
                  </Stack>
                )}

                {step === Step.SCANNER && (
                  <Stack>
                    <Box borderWidth={1} overflow="hidden" p={2}>
                      <video muted playsInline ref={videoRef} style={{ minHeight: 464 - 18 }} />
                    </Box>

                    <Group attached w="full">
                      <Input
                        flex={1}
                        onChange={(e) => setQrValue(e.target.value)}
                        placeholder="Enter..."
                        value={qrValue}
                      />
                      <Button bg="bg.subtle" variant="outline">
                        Parse
                      </Button>
                    </Group>

                    <Button
                      onClick={async () => {
                        if (role === Role.OFFERER) {
                          if (!pcRef.current) return
                          const answer = JSON.parse(qrValue)
                          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer))
                          setStatus("Connected (Offer side)")
                          toaster.create({ title: "Connected" })
                          dialog.setOpen(false)
                        }
                        if (role === Role.ANSWERER) {
                          setupConnection()
                          if (!pcRef.current) return
                          const offer = JSON.parse(qrValue)
                          await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer))
                          const answer = await pcRef.current.createAnswer()
                          await pcRef.current.setLocalDescription(answer)
                          setQrValue(JSON.stringify(pcRef.current.localDescription))
                          setStep(Step.QRCODE)
                        }
                      }}
                    >
                      Connect
                    </Button>
                  </Stack>
                )}
              </Dialog.Body>

              <Dialog.CloseTrigger>
                <CloseButton
                  onClick={() => {
                    setRole(null)
                    setStep(null)
                    setQrValue("")
                    dialog.setOpen(false)
                  }}
                  size="sm"
                />
              </Dialog.CloseTrigger>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Container>
  )
}

export default WebRTC
