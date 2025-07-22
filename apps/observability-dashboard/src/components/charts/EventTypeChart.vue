<template>
  <div class="event-type-chart">
    <canvas ref="chartCanvas" :width="canvasWidth" :height="canvasHeight"></canvas>
    
    <div class="chart-legend">
      <div
        v-for="item in data"
        :key="item.label"
        class="legend-item"
        @click="toggleDataset(item.label)"
        :class="{ 'legend-item--disabled': hiddenDatasets.has(item.label) }"
      >
        <div class="legend-color" :style="{ backgroundColor: item.color }"></div>
        <span class="legend-label">{{ item.label }}</span>
        <span class="legend-value">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'

interface ChartDataItem {
  label: string
  value: number
  color: string
}

interface Props {
  data: ChartDataItem[]
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 400,
  height: 300
})

const chartCanvas = ref<HTMLCanvasElement>()
const hiddenDatasets = ref(new Set<string>())
const animationFrame = ref<number>()

const canvasWidth = computed(() => props.width)
const canvasHeight = computed(() => props.height)

const visibleData = computed(() => {
  return props.data.filter(item => !hiddenDatasets.value.has(item.label))
})

const totalValue = computed(() => {
  return visibleData.value.reduce((sum, item) => sum + item.value, 0)
})

let ctx: CanvasRenderingContext2D | null = null

const drawChart = () => {
  if (!ctx || !chartCanvas.value || visibleData.value.length === 0) return

  const canvas = chartCanvas.value
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = Math.min(centerX, centerY) - 40

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw pie slices
  let currentAngle = -Math.PI / 2 // Start at top

  visibleData.value.forEach((item, index) => {
    const sliceAngle = (item.value / totalValue.value) * 2 * Math.PI
    
    // Draw slice
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
    ctx.closePath()
    ctx.fillStyle = item.color
    ctx.fill()
    
    // Draw slice border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.stroke()
    
    // Draw label
    const labelAngle = currentAngle + sliceAngle / 2
    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7)
    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7)
    
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 12px Inter'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Add shadow for better readability
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 2
    ctx.fillText(item.value.toString(), labelX, labelY)
    ctx.shadowBlur = 0
    
    currentAngle += sliceAngle
  })

  // Draw center circle for donut effect
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.4, 0, 2 * Math.PI)
  ctx.fillStyle = 'var(--surface-card)'
  ctx.fill()
  
  // Draw total in center
  ctx.fillStyle = 'var(--text-color)'
  ctx.font = 'bold 24px Inter'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(totalValue.value.toString(), centerX, centerY - 10)
  
  ctx.font = '12px Inter'
  ctx.fillStyle = 'var(--text-color-secondary)'
  ctx.fillText('Total Events', centerX, centerY + 15)
}

const toggleDataset = (label: string) => {
  if (hiddenDatasets.value.has(label)) {
    hiddenDatasets.value.delete(label)
  } else {
    hiddenDatasets.value.add(label)
  }
  drawChart()
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
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
  }
  window.removeEventListener('resize', resizeCanvas)
})

watch(() => props.data, () => {
  drawChart()
}, { deep: true })

watch(visibleData, () => {
  drawChart()
}, { deep: true })
</script>

<style lang="scss" scoped>
.event-type-chart {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

canvas {
  max-width: 100%;
  height: auto;
}

.chart-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: center;
  max-width: 100%;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--surface-hover);
  }
  
  &--disabled {
    opacity: 0.5;
    
    .legend-color {
      background: var(--surface-border) !important;
    }
  }
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-label {
  font-weight: 500;
  color: var(--text-color);
}

.legend-value {
  font-weight: 600;
  color: var(--text-color-secondary);
  background: var(--surface-border);
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
}

@media (max-width: 768px) {
  .chart-legend {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }
  
  .legend-item {
    width: 100%;
    justify-content: space-between;
  }
}
</style>