import { Button, Container, Flex, HStack, Text } from "@chakra-ui/react"
import QrScanner from "qr-scanner"
import { QRCodeCanvas as QRCode } from "qrcode.react"
import React, { useEffect, useRef, useState } from "react"

const WebRTC = () => {
  const [role, setRole] = useState<null | string>(null)
  const [qrValue, setQrValue] = useState("")
  const [status, setStatus] = useState("Not connected")
  const [message, setMessage] = useState("")
  const [chat, setChat] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const qrScannerRef = useRef<QrScanner>(null)
  const pcRef = useRef<RTCPeerConnection>(null)
  const dcRef = useRef<RTCDataChannel>(null)

  const setupConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    pc.onicecandidate = (e) => {
      if (!e.candidate) {
        setQrValue(JSON.stringify(pc.localDescription))
      }
    }

    pc.ondatachannel = (e) => {
      const dc = e.channel
      dcRef.current = dc
      dc.onmessage = (event) => {
        setChat((c) => [...c, `Peer: ${event.data}`])
      }
      setStatus("Connected (Answer side)")
    }

    pcRef.current = pc
  }

  const createOffer = async () => {
    setRole("offerer")
    setupConnection()

    if (pcRef.current) {
      const dc = pcRef.current.createDataChannel("chat")
      dcRef.current = dc
      dc.onmessage = (e) => setChat((c) => [...c, `Peer: ${e.data}`])

      const offer = await pcRef.current.createOffer()
      await pcRef.current.setLocalDescription(offer)
    }
  }

  const scanQR = async (type: string) => {
    if (!videoRef.current) return

    const scanner = new QrScanner(
      videoRef.current,
      async (result) => {
        if (!videoRef.current || !pcRef.current) return
        scanner.stop()
        qrScannerRef.current = null
        videoRef.current.style.display = "none"

        console.log("result", result.data)
        const data = JSON.parse(result.data)
        console.log("data", data)

        if (type === "offer") {
          setRole("answerer")
          setupConnection()
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data))
          const answer = await pcRef.current.createAnswer()
          await pcRef.current.setLocalDescription(answer)
          setQrValue(JSON.stringify(pcRef.current.localDescription))
        } else if (type === "answer") {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(data))
          setStatus("Connected (Offer side)")
        }
      },
      { returnDetailedScanResult: true },
    )

    qrScannerRef.current = scanner
    videoRef.current.style.display = "block"
    scanner.start()
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
      <Text fontWeight="bold">WebRTC Peer-to-Peer via QR Code</Text>

      {!role && (
        <Flex gap={2}>
          <Button onClick={createOffer}>Start Offer (Peer A)</Button>
          <Button onClick={() => scanQR("offer")}>Scan Offer (Peer B)</Button>
        </Flex>
      )}

      {qrValue && (
        <div style={{ marginTop: 20 }}>
          <h3>QR Code to Share</h3>
          <QRCode size={256} value={qrValue} />
        </div>
      )}

      {role === "offerer" && !pcRef.current?.remoteDescription && (
        <Button onClick={() => scanQR("answer")}>Scan Answer</Button>
      )}

      <p>
        <strong>Status:</strong> {status}
      </p>

      {status.startsWith("Connected") && (
        <>
          <input onChange={(e) => setMessage(e.target.value)} placeholder="Enter message..." value={message} />
          <Button onClick={sendMessage}>Send</Button>

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

      <video muted playsInline ref={videoRef} style={{ display: "none", marginTop: 20, width: 300 }} />
    </Container>
  )
}

export default WebRTC
