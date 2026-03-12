import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Tile = { flip: number; ambient: number }

const CONFIG = {
    mode: 1,
    radialRays: 10,
    tileSize: 14,
    radius: 185,
    softness: 0.24,
    speed: 0.16,
    bgColor: "#f2f2ee",
    patternScale: 0.85,
    density: 0.9,
    pulse: 0.2,
    rotate: 0.22,
    ambient: 0.08,
    p1: 0.34,
    p2: 0.36,
    p3: 0.71,
    p4: 0.3,
    p5: 0.41,
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

function hash(x: number, y: number, seed: number) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453
    return n - Math.floor(n)
}

function fade(f: number) {
    return f * f * f * (f * (f * 6 - 15) + 10)
}

function noise2(x: number, y: number, seed: number) {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    const fx = x - ix
    const fy = y - iy
    const ux = fade(fx)
    const uy = fade(fy)
    const a = hash(ix, iy, seed)
    const b = hash(ix + 1, iy, seed)
    const c = hash(ix, iy + 1, seed)
    const d = hash(ix + 1, iy + 1, seed)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy
}

function noiseP(x: number, y: number, seed: number) {
    let value = 0
    let amp = 1
    let freq = 1
    let max = 0
    for (let o = 0; o < 4; o++) {
        value += noise2(x * freq, y * freq, seed) * amp
        max += amp
        amp *= 0.5
        freq *= 2
    }
    return value / max
}

function foldAng(ang: number, rays: number) {
    const step = Math.PI / rays
    const a = ((ang % (step * 2)) + step * 2) % (step * 2)
    return a < step ? a : step * 2 - a
}

function getModePattern(
    normalized: number,
    angle: number,
    time: number,
    seed: number
) {
    const sc = CONFIG.patternScale
    const density = CONFIG.density
    const r = normalized
    const rays = Math.max(3, CONFIG.radialRays)
    const folded = foldAng(angle, rays)

    if (CONFIG.mode === 0) {
        const scale = (0.45 + CONFIG.p1 * 1.1) * sc
        const thick = 0.04 + CONFIG.p2 * 0.22
        const layers = 1 + Math.floor(CONFIG.p3 * 3)
        let best = 0
        for (let l = 0; l < layers; l++) {
            const layerScale = 1 + l * 0.45
            const n = noiseP(
                r * 16 * scale * layerScale + time * (0.1 + CONFIG.p5 * 0.7),
                folded * 10 * scale * (1 + l * 0.3) +
                    time * (0.1 + CONFIG.p4 * 0.7),
                seed
            )
            const d = Math.abs(n - Math.floor(n * 6) / 6)
            best = Math.max(best, 1 - smoothstep(0, thick, d))
        }
        return best * (0.6 + (1 - normalized) * 0.4)
    }

    if (CONFIG.mode === 1) {
        const freq1 = 0.7 + 2.8 * CONFIG.p1
        const freq2 = 0.5 + 2.0 * CONFIG.p2
        const amp1 = 0.25 + 1.5 * CONFIG.p3
        const amp2 = 0.2 + 1.2 * CONFIG.p4
        const thresh = 0.1 + 0.85 * CONFIG.p5
        const rr = r * 18 * sc
        const l1 = Math.sin(
            rr * freq1 + Math.cos(angle * rays) * amp1 + time * 1.0
        )
        const l2 = Math.cos(
            rr * freq2 + Math.sin(angle * rays) * amp2 + time * 0.75
        )
        const l3 = Math.sin(r * 28 + time * 0.5)
        const v = Math.abs((l1 + l2 + l3) / 3)
        return smoothstep(thresh * density * 0.6, 1, v)
    }

    if (CONFIG.mode === 2) {
        const scale = (0.7 + CONFIG.p1 * 1.2) * sc
        const twist = CONFIG.p2 * Math.PI * 2
        const n1 = noiseP(
            r * 18 * scale + time * (0.1 + CONFIG.p3 * 0.9),
            folded * 7 * scale + time * 0.28,
            seed
        )
        const n2 = noiseP(
            r * 36 * scale + time * 0.24,
            folded * (10 + CONFIG.p5 * 10) * scale -
                time * (0.1 + CONFIG.p4 * 0.9),
            seed
        )
        const v =
            Math.sin(n1 * Math.PI * 4 + twist + angle * 1.2) *
            Math.cos(n2 * Math.PI * 4)
        return smoothstep(density * 0.4, 1, (v + 1) * 0.5)
    }

    if (CONFIG.mode === 3) {
        const radial1 = 6 + CONFIG.p1 * 18
        const twist = 1 + CONFIG.p2 * 8
        const rings = 2 + CONFIG.p3 * 10
        const dens = 1 + CONFIG.p4 * 6
        const speed = 0.2 + CONFIG.p5 * 1.5
        const v1 = Math.sin(r * radial1 * sc * rings + time * speed)
        const v2 = Math.cos(r * (4 + twist * 2) * sc - time * speed * 0.7)
        const v3 = Math.sin(angle * rays + time * 0.4)
        const val = (v1 + v2 + v3 + 3) / 6
        const ringMask = smoothstep(density * dens * 0.2, 1, val)
        const petals =
            0.5 + 0.5 * Math.cos(angle * rays + twist) * (1 - r * 0.55)
        return ringMask * (0.4 + petals * 0.6)
    }

    if (CONFIG.mode === 4) {
        const scale = (0.8 + CONFIG.p1 * 1.1) * sc
        const sharpness = CONFIG.p2
        const px = r * 24 * scale
        const py = folded * 8 * scale
        const warp =
            noise2(px * 0.35 + time * 0.1, py * 0.35 + time * 0.08, seed) * 1.8
        const n1 = Math.sin(
            (px + warp + time * (0.15 + CONFIG.p4 * 0.9)) * Math.PI * 1.5
        )
        const n2 = Math.sin(
            (py + warp * 0.7 - time * (0.15 + CONFIG.p3 * 0.9)) * Math.PI * 2.1
        )
        const n3 = Math.sin(
            (px + py) * (0.6 + CONFIG.p5 * 0.8) * Math.PI +
                warp * 0.5 +
                time * 0.4
        )
        const v = (n1 + n2 + n3 + 3) / 6
        return smoothstep(density * 0.4 + sharpness * 0.3, 1, v)
    }

    const f1 = 0.5 + CONFIG.p1 * 2.0
    const f2 = 0.4 + CONFIG.p2 * 1.8
    const f3 = 0.35 + CONFIG.p3 * 1.5
    const dens = 0.3 + CONFIG.p4 * 0.9
    const bands = 2 + CONFIG.p5 * 6
    const p =
        (Math.sin(r * 24 * sc * f1 + time * 0.3) +
            Math.sin(angle * 18 * sc * f2 + time * 0.18) +
            Math.sin((r * 14 + angle * 8) * sc * f3 + time * 0.15) +
            Math.sin(r * 10 - time * 0.25)) /
        4
    const v = Math.abs(Math.sin(p * Math.PI * bands))
    return smoothstep(dens * density * 0.45, 1, v)
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

export default function QuipPeekExport(props: { video?: string }) {
    const { video } = props
    const containerRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const animationRef = React.useRef<number>(0)
    const lastTimeRef = React.useRef<number>(0)
    const motionTimeRef = React.useRef<number>(0)
    const seedRef = React.useRef(1337)
    const pointerRef = React.useRef({ x: 0, y: 0, active: false })
    const tilesRef = React.useRef<Tile[]>([])
    const videoEl = useLoadedVideo(video)

    React.useEffect(() => {
        const element = containerRef.current
        const canvas = canvasRef.current
        if (!element || !canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        const resizeGrid = (width: number, height: number) => {
            const cols = Math.ceil(width / CONFIG.tileSize)
            const rows = Math.ceil(height / CONFIG.tileSize)
            const prev = tilesRef.current
            const next: Tile[] = new Array(cols * rows)
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const idx = row * cols + col
                    next[idx] = {
                        flip: prev[idx]?.flip ?? 0,
                        ambient: prev[idx]?.ambient ?? 0,
                    }
                }
            }
            tilesRef.current = next
        }

        const resizeCanvas = () => {
            const rect = element.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1
            canvas.width = Math.max(1, Math.round(rect.width * dpr))
            canvas.height = Math.max(1, Math.round(rect.height * dpr))
            canvas.style.width = rect.width + "px"
            canvas.style.height = rect.height + "px"
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            resizeGrid(rect.width, rect.height)
            if (!pointerRef.current.active) {
                pointerRef.current.x = rect.width / 2
                pointerRef.current.y = rect.height / 2
            }
        }

        const updatePointer = (clientX: number, clientY: number) => {
            const rect = canvas.getBoundingClientRect()
            pointerRef.current.x = clientX - rect.left
            pointerRef.current.y = clientY - rect.top
            pointerRef.current.active = true
        }

        const drawTileOverlay = (
            x: number,
            y: number,
            width: number,
            height: number,
            intensity: number
        ) => {
            const gradient = ctx.createLinearGradient(x, y, x + width, y)
            gradient.addColorStop(
                0,
                "rgba(255,255,255," + 0.24 * intensity + ")"
            )
            gradient.addColorStop(
                1,
                "rgba(255,255,255," + 0.07 * intensity + ")"
            )
            ctx.fillStyle = gradient
            ctx.fillRect(x, y, width, height)
        }

        const renderFrame = (now: number) => {
            animationRef.current = requestAnimationFrame(renderFrame)

            const dt = lastTimeRef.current
                ? Math.min(0.05, (now - lastTimeRef.current) / 1000)
                : 1 / 60
            lastTimeRef.current = now
            motionTimeRef.current += dt

            const width = canvas.width / (window.devicePixelRatio || 1)
            const height = canvas.height / (window.devicePixelRatio || 1)
            const cols = Math.ceil(width / CONFIG.tileSize)
            const rows = Math.ceil(height / CONFIG.tileSize)
            const tiles = tilesRef.current
            const pointer = pointerRef.current
            const radius =
                CONFIG.radius *
                (1 + CONFIG.pulse * Math.sin(motionTimeRef.current * 1.7))
            const rotation = motionTimeRef.current * CONFIG.rotate
            const blendSpeed = 1 - Math.pow(1 - CONFIG.speed, dt * 60)
            const ambientChance = CONFIG.ambient * 0.9

            ctx.clearRect(0, 0, width, height)
            ctx.fillStyle = "#f2f2ee"
            ctx.fillRect(0, 0, width, height)

            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const idx = row * cols + col
                    const tile = tiles[idx]
                    if (!tile) continue

                    const x = col * CONFIG.tileSize
                    const y = row * CONFIG.tileSize
                    const tileWidth = Math.min(CONFIG.tileSize, width - x)
                    const tileHeight = Math.min(CONFIG.tileSize, height - y)
                    const centerX = x + tileWidth * 0.5
                    const centerY = y + tileHeight * 0.5

                    let target = 0
                    if (pointer.active) {
                        const dx = centerX - pointer.x
                        const dy = centerY - pointer.y
                        const rotatedX =
                            dx * Math.cos(-rotation) - dy * Math.sin(-rotation)
                        const rotatedY =
                            dx * Math.sin(-rotation) + dy * Math.cos(-rotation)
                        const dist = Math.sqrt(
                            rotatedX * rotatedX + rotatedY * rotatedY
                        )

                        if (dist < radius) {
                            const normalized = dist / radius
                            const angle = Math.atan2(rotatedY, rotatedX)
                            const radialEnvelope =
                                1 -
                                smoothstep(1 - CONFIG.softness, 1, normalized)
                            const pattern = getModePattern(
                                normalized,
                                angle,
                                motionTimeRef.current,
                                seedRef.current
                            )
                            const centerBias =
                                1 - smoothstep(0.82, 1, normalized)
                            target = clamp(
                                pattern * radialEnvelope * 0.78 +
                                    centerBias * 0.22,
                                0,
                                1
                            )
                        }
                    }

                    const drift = noise2(
                        col * 0.21 + motionTimeRef.current * 0.18 + 17.3,
                        row * 0.21 - motionTimeRef.current * 0.14 + 91.7,
                        seedRef.current
                    )
                    const triggerBias = 0.35 + drift * 0.65
                    const triggerRoll = noise2(
                        col * 1.73 + motionTimeRef.current * 3.2 + 41.1,
                        row * 1.73 - motionTimeRef.current * 2.7 + 12.8,
                        seedRef.current
                    )
                    if (triggerRoll > 0.72 && Math.random() < ambientChance * triggerBias * dt) {
                        tile.ambient = 0.55 + Math.random() * 0.45
                    }

                    tile.ambient = Math.max(0, tile.ambient - dt * (0.9 + Math.random() * 1.2))
                    target = Math.max(target, tile.ambient)

                    tile.flip = lerp(tile.flip, target, blendSpeed)
                    if (tile.flip < 0.002) continue

                    const eased = easeFlip(tile.flip)
                    const scaleX = Math.max(
                        0.02,
                        Math.abs(Math.cos(eased * Math.PI))
                    )
                    const visibleWidth = tileWidth * scaleX
                    const drawX = x + (tileWidth - visibleWidth) * 0.5
                    const showVideo =
                        eased >= 0.5 && videoEl && videoEl.readyState >= 2

                    if (showVideo) {
                        ctx.save()
                        ctx.beginPath()
                        ctx.rect(drawX, y, visibleWidth, tileHeight)
                        ctx.clip()
                        drawFittedMedia(
                            ctx,
                            videoEl,
                            videoEl.videoWidth,
                            videoEl.videoHeight,
                            width,
                            height
                        )
                        ctx.restore()
                    } else {
                        ctx.fillStyle = "#f2f2ee"
                        ctx.fillRect(drawX, y, visibleWidth, tileHeight)
                    }

                    drawTileOverlay(
                        drawX,
                        y,
                        visibleWidth,
                        tileHeight,
                        tile.flip
                    )
                }
            }
        }

        const onPointerMove = (event: PointerEvent) =>
            updatePointer(event.clientX, event.clientY)
        const onPointerEnter = (event: PointerEvent) =>
            updatePointer(event.clientX, event.clientY)
        const onPointerLeave = () => {}

        const observer = new ResizeObserver(resizeCanvas)
        observer.observe(element)
        element.addEventListener("pointermove", onPointerMove)
        element.addEventListener("pointerenter", onPointerEnter)
        element.addEventListener("pointerleave", onPointerLeave)

        resizeCanvas()
        animationRef.current = requestAnimationFrame(renderFrame)

        return () => {
            cancelAnimationFrame(animationRef.current)
            observer.disconnect()
            element.removeEventListener("pointermove", onPointerMove)
            element.removeEventListener("pointerenter", onPointerEnter)
            element.removeEventListener("pointerleave", onPointerLeave)
        }
    }, [videoEl])

    return (
        <div
            ref={containerRef}
            style={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
                position: "relative",
                background: "#f2f2ee",
                touchAction: "none",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    background: "#f2f2ee",
                }}
            />
        </div>
    )
}

addPropertyControls(QuipPeekExport, {
    video: {
        type: ControlType.File,
        title: "Video",
        allowedFileTypes: ["mp4", "mov", "webm", "ogg"],
    },
})
