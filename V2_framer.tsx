import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type ShapeMode = "circle" | "star" | "spiral" | "mandala" | "flower"

type Props = {
    video?: string
    backgroundColor: string
    shape: ShapeMode
    tileSize: number
    radius: number
    softness: number
    flipSpeed: number
    pulseAmount: number
    pulseSpeed: number
    rotationSpeed: number
    showCursorOutline: boolean
}

type Tile = {
    flip: number
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value))
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

function smoothstep(edge0: number, edge1: number, x: number) {
    const t = clamp((x - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1)
    return t * t * (3 - 2 * t)
}

function easeFlip(value: number) {
    return 0.5 - 0.5 * Math.cos(value * Math.PI)
}

function getAnimatedRadius(baseRadius: number, pulseAmount: number, pulseSpeed: number, time: number) {
    return baseRadius * (1 + pulseAmount * Math.sin(time * pulseSpeed))
}

function getShapeRotation(rotationSpeed: number, time: number) {
    return time * rotationSpeed
}

function getRevealStrength(
    dx: number,
    dy: number,
    shape: ShapeMode,
    radius: number,
    softness: number,
    rotation: number
) {
    const angle = Math.atan2(dy, dx) - rotation
    const dist = Math.sqrt(dx * dx + dy * dy)
    const r = Math.max(1, radius)

    if (shape === "circle") {
        const inner = r * (1 - softness)
        if (dist >= r) return 0
        if (dist <= inner) return 1
        return 1 - smoothstep(inner, r, dist)
    }

    if (shape === "star") {
        const wave = 0.72 + 0.28 * Math.cos(5 * angle)
        const boundary = r * wave
        const inner = boundary * (1 - softness * 0.9)
        if (dist >= boundary) return 0
        if (dist <= inner) return 1
        return 1 - smoothstep(inner, boundary, dist)
    }

    if (shape === "spiral") {
        const normalized = dist / r
        if (normalized >= 1) return 0
        const armPhase = angle + normalized * Math.PI * 3.5
        const arm = Math.abs(Math.sin(armPhase * 2))
        const bandWidth = 0.32 + softness * 0.45
        const band = 1 - smoothstep(bandWidth, 1, arm)
        const radialFade = 1 - smoothstep(0.78, 1, normalized)
        return clamp(band * radialFade, 0, 1)
    }

    if (shape === "mandala") {
        const normalized = dist / r
        if (normalized >= 1) return 0
        const ringWave = 0.5 + 0.5 * Math.cos(normalized * Math.PI * 8 - angle * 8)
        const ringMask = 1 - smoothstep(0.58, 0.92, Math.abs(ringWave - 0.5) * 2)
        const centerFade = 1 - smoothstep(0.82, 1, normalized)
        return clamp(ringMask * centerFade, 0, 1)
    }

    const normalized = dist / r
    if (normalized >= 1) return 0
    const petalRadius = r * (0.62 + 0.24 * Math.cos(6 * angle))
    const inner = petalRadius * (1 - softness)
    if (dist >= petalRadius) return 0
    if (dist <= inner) return 1
    const petal = 1 - smoothstep(inner, petalRadius, dist)
    const core = 1 - smoothstep(0.2, 0.45, normalized)
    return Math.max(petal, core * 0.9)
}

function buildRevealPath(
    path: Path2D,
    cx: number,
    cy: number,
    radius: number,
    shape: ShapeMode,
    rotation: number
) {
    if (shape === "circle") {
        path.arc(cx, cy, radius, 0, Math.PI * 2)
        return
    }

    const steps = shape === "spiral" ? 220 : 140
    for (let i = 0; i <= steps; i++) {
        const progress = i / steps
        const t = progress * Math.PI * 2 + rotation
        let localRadius = radius

        if (shape === "star") {
            localRadius = radius * (0.72 + 0.28 * Math.cos(5 * (t - rotation)))
        } else if (shape === "spiral") {
            localRadius = radius * (0.25 + 0.75 * progress)
        } else if (shape === "mandala") {
            localRadius = radius * (0.72 + 0.12 * Math.cos(8 * (t - rotation)) + 0.08 * Math.cos(16 * (t - rotation)))
        } else if (shape === "flower") {
            localRadius = radius * (0.62 + 0.24 * Math.cos(6 * (t - rotation)))
        }

        const x = cx + Math.cos(t) * localRadius
        const y = cy + Math.sin(t) * localRadius
        if (i === 0) path.moveTo(x, y)
        else path.lineTo(x, y)
    }
}

function useLoadedVideo(src?: string) {
    const [video, setVideo] = React.useState<HTMLVideoElement | null>(null)

    React.useEffect(() => {
        if (!src) {
            setVideo(null)
            return
        }

        const next = document.createElement("video")
        next.crossOrigin = "anonymous"
        next.muted = true
        next.loop = true
        next.autoplay = true
        next.playsInline = true
        next.preload = "auto"
        next.onloadeddata = () => {
            void next.play().catch(() => {})
            setVideo(next)
        }
        next.onerror = () => setVideo(null)
        next.src = src
        next.load()

        return () => {
            next.pause()
            next.removeAttribute("src")
            next.load()
        }
    }, [src])

    return video
}

function drawFittedMedia(
    ctx: CanvasRenderingContext2D,
    media: CanvasImageSource,
    mediaWidth: number,
    mediaHeight: number,
    width: number,
    height: number
) {
    const scale = Math.max(width / mediaWidth, height / mediaHeight)
    const drawWidth = mediaWidth * scale
    const drawHeight = mediaHeight * scale
    const dx = (width - drawWidth) / 2
    const dy = (height - drawHeight) / 2
    ctx.drawImage(media, dx, dy, drawWidth, drawHeight)
}

export default function V2_framer(props: Props) {
    const {
        video,
        backgroundColor,
        shape,
        tileSize,
        radius,
        softness,
        flipSpeed,
        pulseAmount,
        pulseSpeed,
        rotationSpeed,
        showCursorOutline,
    } = props

    const containerRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const animationRef = React.useRef<number>(0)
    const lastTimeRef = React.useRef<number>(0)
    const motionTimeRef = React.useRef<number>(0)
    const pointerRef = React.useRef({
        x: 0,
        y: 0,
        active: false,
    })
    const tilesRef = React.useRef<Tile[]>([])
    const videoEl = useLoadedVideo(video)

    const resizeGrid = React.useCallback((width: number, height: number) => {
        const cols = Math.ceil(width / tileSize)
        const rows = Math.ceil(height / tileSize)
        const prev = tilesRef.current
        const next: Tile[] = new Array(cols * rows)

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const idx = row * cols + col
                next[idx] = { flip: prev[idx]?.flip ?? 0 }
            }
        }

        tilesRef.current = next
    }, [tileSize])

    React.useEffect(() => {
        const element = containerRef.current
        const canvas = canvasRef.current
        if (!element || !canvas) return

        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const updatePointer = (clientX: number, clientY: number) => {
            const rect = canvas.getBoundingClientRect()
            pointerRef.current.x = clientX - rect.left
            pointerRef.current.y = clientY - rect.top
            pointerRef.current.active = true
        }

        const handlePointerMove = (event: PointerEvent) => {
            updatePointer(event.clientX, event.clientY)
        }

        const handlePointerLeave = () => {
            pointerRef.current.active = false
        }

        const resizeCanvas = () => {
            const rect = element.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            canvas.width = Math.max(1, Math.round(rect.width * dpr))
            canvas.height = Math.max(1, Math.round(rect.height * dpr))
            canvas.style.width = `${rect.width}px`
            canvas.style.height = `${rect.height}px`
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            resizeGrid(rect.width, rect.height)

            if (!pointerRef.current.active) {
                pointerRef.current.x = rect.width / 2
                pointerRef.current.y = rect.height / 2
            }
        }

        const drawTileOverlay = (x: number, y: number, width: number, height: number, intensity: number) => {
            const gradient = ctx.createLinearGradient(x, y, x + width, y)
            gradient.addColorStop(0, `rgba(255,255,255,${0.25 * intensity})`)
            gradient.addColorStop(1, `rgba(255,255,255,${0.08 * intensity})`)
            ctx.fillStyle = gradient
            ctx.fillRect(x, y, width, height)
        }

        const renderFrame = (now: number) => {
            animationRef.current = requestAnimationFrame(renderFrame)

            const dt = lastTimeRef.current ? Math.min(0.05, (now - lastTimeRef.current) / 1000) : 1 / 60
            lastTimeRef.current = now
            motionTimeRef.current += dt

            const width = canvas.width / (window.devicePixelRatio || 1)
            const height = canvas.height / (window.devicePixelRatio || 1)
            const pointer = pointerRef.current
            const animatedRadius = getAnimatedRadius(radius, pulseAmount, pulseSpeed, motionTimeRef.current)
            const rotation = getShapeRotation(rotationSpeed, motionTimeRef.current)
            const blendSpeed = 1 - Math.pow(1 - flipSpeed, dt * 60)
            const cols = Math.ceil(width / tileSize)
            const rows = Math.ceil(height / tileSize)
            const tiles = tilesRef.current

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = backgroundColor
            ctx.fillRect(0, 0, width, height)

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const idx = row * cols + col
                    const tile = tiles[idx]
                    if (!tile) continue

                    const x = col * tileSize
                    const y = row * tileSize
                    const tileWidth = Math.min(tileSize, width - x)
                    const tileHeight = Math.min(tileSize, height - y)
                    const centerX = x + tileWidth * 0.5
                    const centerY = y + tileHeight * 0.5

                    let target = 0
                    if (pointer.active) {
                        target = getRevealStrength(
                            centerX - pointer.x,
                            centerY - pointer.y,
                            shape,
                            animatedRadius,
                            softness,
                            rotation
                        )
                    }

                    tile.flip = lerp(tile.flip, target, blendSpeed)
                    if (tile.flip < 0.002) continue

                    const eased = easeFlip(tile.flip)
                    const scaleX = Math.max(0.02, Math.abs(Math.cos(eased * Math.PI)))
                    const visibleWidth = tileWidth * scaleX
                    const drawX = x + (tileWidth - visibleWidth) * 0.5
                    const showVideo = eased >= 0.5 && videoEl && videoEl.readyState >= 2

                    if (showVideo) {
                        ctx.save()
                        ctx.beginPath()
                        ctx.rect(drawX, y, visibleWidth, tileHeight)
                        ctx.clip()
                        drawFittedMedia(ctx, videoEl, videoEl.videoWidth, videoEl.videoHeight, width, height)
                        ctx.restore()
                    } else {
                        ctx.fillStyle = backgroundColor
                        ctx.fillRect(drawX, y, visibleWidth, tileHeight)
                    }

                    drawTileOverlay(drawX, y, visibleWidth, tileHeight, tile.flip)
                }
            }

            void showCursorOutline
        }

        const resizeObserver = new ResizeObserver(resizeCanvas)
        resizeObserver.observe(element)
        element.addEventListener("pointermove", handlePointerMove)
        element.addEventListener("pointerenter", handlePointerMove)
        element.addEventListener("pointerleave", handlePointerLeave)

        resizeCanvas()
        animationRef.current = requestAnimationFrame(renderFrame)

        return () => {
            cancelAnimationFrame(animationRef.current)
            resizeObserver.disconnect()
            element.removeEventListener("pointermove", handlePointerMove)
            element.removeEventListener("pointerenter", handlePointerMove)
            element.removeEventListener("pointerleave", handlePointerLeave)
        }
    }, [
        backgroundColor,
        flipSpeed,
        pulseAmount,
        pulseSpeed,
        radius,
        resizeGrid,
        rotationSpeed,
        shape,
        showCursorOutline,
        softness,
        tileSize,
        videoEl,
    ])

    React.useEffect(() => {
        const element = containerRef.current
        if (!element) return
        const rect = element.getBoundingClientRect()
        resizeGrid(rect.width, rect.height)
    }, [resizeGrid, tileSize])

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                position: "relative",
                background: backgroundColor,
                touchAction: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    background: backgroundColor,
                }}
            />
        </div>
    )
}

V2_framer.defaultProps = {
    backgroundColor: "#efefef",
    shape: "circle",
    tileSize: 24,
    radius: 140,
    softness: 0.28,
    flipSpeed: 0.18,
    pulseAmount: 0.12,
    pulseSpeed: 1.7,
    rotationSpeed: 0.22,
    showCursorOutline: true,
}

addPropertyControls(V2_framer, {
    video: {
        type: ControlType.File,
        title: "Video",
        allowedFileTypes: ["mp4", "mov", "webm", "ogg"],
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
    },
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["circle", "star", "spiral", "mandala", "flower"],
        optionTitles: ["Circle", "Star", "Spiral", "Mandala", "Flower"],
    },
    tileSize: {
        type: ControlType.Number,
        title: "Tile",
        min: 8,
        max: 64,
        step: 2,
        displayStepper: true,
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        min: 30,
        max: 360,
        step: 1,
        displayStepper: true,
    },
    softness: {
        type: ControlType.Number,
        title: "Softness",
        min: 0.05,
        max: 0.8,
        step: 0.01,
        displayStepper: true,
    },
    flipSpeed: {
        type: ControlType.Number,
        title: "Flip",
        min: 0.04,
        max: 0.4,
        step: 0.01,
        displayStepper: true,
    },
    pulseAmount: {
        type: ControlType.Number,
        title: "Pulse Amt",
        min: 0,
        max: 0.35,
        step: 0.01,
        displayStepper: true,
    },
    pulseSpeed: {
        type: ControlType.Number,
        title: "Pulse Spd",
        min: 0,
        max: 5,
        step: 0.1,
        displayStepper: true,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Rotate",
        min: -2,
        max: 2,
        step: 0.01,
        displayStepper: true,
    },
    showCursorOutline: {
        type: ControlType.Boolean,
        title: "Outline",
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
})
