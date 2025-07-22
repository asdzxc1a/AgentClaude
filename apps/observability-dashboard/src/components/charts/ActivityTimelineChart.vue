<template>
  <div class="activity-timeline-chart">
    <canvas ref="chartCanvas" :width="canvasWidth" :height="canvasHeight"></canvas>
    
    <div class="chart-controls">
      <div class="time-range-selector">
        <Button
          v-for="range in timeRanges"
          :key="range.value"
          :label="range.label"
          size="small"
          :outlined="selectedTimeRange !== range.value"
          @click="selectTimeRange(range.value)"
        />
      </div>
      
      <div class="chart-options">
        <Button
          icon="fas fa-expand-arrows-alt"
          size="small"
          outlined
          @click="toggleFullscreen"
          v-tooltip.bottom="'Fullscreen'"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import type { TimeSeriesData } from '@/types'

interface Props {
  data: TimeSeriesData[]
  timeRange?: string
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  timeRange: '1h',
  width: 600,
  height: 300
})

const emit = defineEmits<{
  timeRangeChanged: [range: string]
}>()

const chartCanvas = ref<HTMLCanvasElement>()
const selectedTimeRange = ref(props.timeRange)
const isFullscreen = ref(false)

const canvasWidth = computed(() => props.width)
const canvasHeight = computed(() => props.height)

const timeRanges = [
  { label: '1H', value: '1h' },
  { label: '6H', value: '6h' },
  { label: '24H', value: '24h' },
  { label: '7D', value: '7d' }
]

let ctx: CanvasRenderingContext2D | null = null
let animationFrame: number | null = null

const processedData = computed(() => {
  if (!props.data.length) return []
  
  // Group data by time buckets based on selected range
  const bucketSize = getBucketSize(selectedTimeRange.value)
  const buckets = new Map<number, number>()
  
  props.data.forEach(point => {
    const timestamp = new Date(point.timestamp).getTime()
    const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize
    buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + point.value)
  })
  
  return Array.from(buckets.entries())
    .map(([timestamp, value]) => ({ timestamp, value }))
    .sort((a, b) => a.timestamp - b.timestamp)
})

const getBucketSize = (range: string): number => {
  const bucketSizes: Record<string, number> = {
    '1h': 5 * 60 * 1000,      // 5 minutes
    '6h': 30 * 60 * 1000,     // 30 minutes
    '24h': 60 * 60 * 1000,    // 1 hour
    '7d': 6 * 60 * 60 * 1000  // 6 hours
  }
  return bucketSizes[range] || bucketSizes['1h']
}

const drawChart = () => {
  if (!ctx || !chartCanvas.value || !processedData.value.length) return

  const canvas = chartCanvas.value
  const padding = 40
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Find data bounds
  const minTime = Math.min(...processedData.value.map(d => d.timestamp))
  const maxTime = Math.max(...processedData.value.map(d => d.timestamp))
  const maxValue = Math.max(...processedData.value.map(d => d.value))

  // Draw grid
  drawGrid(ctx, padding, chartWidth, chartHeight, maxValue)

  // Draw data line
  drawDataLine(ctx, processedData.value, padding, chartWidth, chartHeight, minTime, maxTime, maxValue)

  // Draw axes
  drawAxes(ctx, padding, chartWidth, chartHeight, minTime, maxTime, maxValue)
}

const drawGrid = (
  ctx: CanvasRenderingContext2D,
  padding: number,
  width: number,
  height: number,
  maxValue: number
) => {
  ctx.strokeStyle = 'rgba(156, 163, 175, 0.2)'
  ctx.lineWidth = 1

  // Horizontal grid lines
  const gridLines = 5
  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (height / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(padding + width, y)
    ctx.stroke()
  }

  // Vertical grid lines
  for (let i = 0; i <= 6; i++) {
    const x = padding + (width / 6) * i
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, padding + height)
    ctx.stroke()
  }
}

const drawDataLine = (
  ctx: CanvasRenderingContext2D,
  data: Array<{ timestamp: number; value: number }>,
  padding: number,
  width: number,
  height: number,
  minTime: number,
  maxTime: number,
  maxValue: number
) => {
  if (data.length < 2) return

  // Create gradient
  const gradient = ctx.createLinearGradient(0, padding, 0, padding + height)
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)')
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)')

  // Draw area under curve
  ctx.beginPath()
  data.forEach((point, index) => {
    const x = padding + ((point.timestamp - minTime) / (maxTime - minTime)) * width
    const y = padding + height - (point.value / maxValue) * height

    if (index === 0) {
      ctx.moveTo(x, padding + height)
      ctx.lineTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.lineTo(padding + width, padding + height)
  ctx.closePath()
  ctx.fillStyle = gradient
  ctx.fill()

  // Draw line
  ctx.beginPath()
  data.forEach((point, index) => {
    const x = padding + ((point.timestamp - minTime) / (maxTime - minTime)) * width
    const y = padding + height - (point.value / maxValue) * height

    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 2
  ctx.stroke()

  // Draw data points
  ctx.fillStyle = '#3b82f6'
  data.forEach(point => {
    const x = padding + ((point.timestamp - minTime) / (maxTime - minTime)) * width
    const y = padding + height - (point.value / maxValue) * height

    ctx.beginPath()
    ctx.arc(x, y, 3, 0, 2 * Math.PI)
    ctx.fill()
  })
}

const drawAxes = (
  ctx: CanvasRenderingContext2D,
  padding: number,
  width: number,
  height: number,
  minTime: number,
  maxTime: number,
  maxValue: number
) => {
  ctx.fillStyle = 'var(--text-color-secondary)'
  ctx.font = '12px Inter'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'

  // X-axis labels (time)
  for (let i = 0; i <= 6; i++) {
    const x = padding + (width / 6) * i
    const time = minTime + ((maxTime - minTime) / 6) * i
    const timeStr = new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    ctx.fillText(timeStr, x, padding + height + 10)
  }

  // Y-axis labels (values)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= 5; i++) {
    const y = padding + (height / 5) * i
    const value = Math.round(maxValue - (maxValue / 5) * i)
    ctx.fillText(value.toString(), padding - 10, y)
  }
}

const selectTimeRange = (range: string) => {
  selectedTimeRange.value = range
  emit('timeRangeChanged', range)
}

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  // Implementation for fullscreen mode would go here
}

const resizeCanvas = () => {
  if (!chartCanvas.value) return
  
  const canvas = chartCanvas.value
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  if (ctx) {
    ctx.scale(dpr, dpr)
  }
  
  drawChart()
}

onMounted(() => {
  if (chartCanvas.value) {
    ctx = chartCanvas.value.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
  }
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
  window.removeEventListener('resize', resizeCanvas)
})

watch(() => props.data, () => {
  drawChart()
}, { deep: true })

watch(selectedTimeRange, () => {
  drawChart()
})
</script>

<style lang="scss" scoped>
.activity-timeline-chart {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

canvas {
  width: 100%;
  height: 300px;
  border-radius: 8px;
}

.chart-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .time-range-selector {
    display: flex;
    gap: 0.5rem;
  }
  
  .chart-options {
    display: flex;
    gap: 0.5rem;
  }
}

@media (max-width: 768px) {
  .chart-controls {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
    
    .time-range-selector {
      justify-content: center;
    }
  }
}
</style>