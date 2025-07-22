<template>
  <div class="not-found-view">
    <div class="not-found-content">
      <div class="error-illustration">
        <i class="fas fa-robot error-icon"></i>
        <div class="error-code">404</div>
      </div>
      
      <div class="error-message">
        <h1>Page Not Found</h1>
        <p>
          The page you're looking for doesn't exist or has been moved.
          Let's get you back to monitoring your agents.
        </p>
      </div>
      
      <div class="error-actions">
        <Button
          label="Go to Dashboard"
          icon="fas fa-chart-line"
          @click="goToDashboard"
        />
        <Button
          label="View Agents"
          icon="fas fa-robot"
          outlined
          @click="goToAgents"
        />
      </div>
      
      <div class="helpful-links">
        <h3>Quick Links</h3>
        <div class="links-grid">
          <router-link to="/dashboard" class="quick-link">
            <i class="fas fa-chart-line"></i>
            <span>Dashboard</span>
          </router-link>
          <router-link to="/events" class="quick-link">
            <i class="fas fa-list"></i>
            <span>Events</span>
          </router-link>
          <router-link to="/agents" class="quick-link">
            <i class="fas fa-robot"></i>
            <span>Agents</span>
          </router-link>
          <router-link to="/analytics" class="quick-link">
            <i class="fas fa-chart-pie"></i>
            <span>Analytics</span>
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goToDashboard = () => {
  router.push('/dashboard')
}

const goToAgents = () => {
  router.push('/agents')
}
</script>

<style lang="scss" scoped>
.not-found-view {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 2rem;
}

.not-found-content {
  text-align: center;
  max-width: 600px;
}

.error-illustration {
  margin-bottom: 2rem;
  
  .error-icon {
    font-size: 4rem;
    color: var(--text-color-secondary);
    margin-bottom: 1rem;
  }
  
  .error-code {
    font-size: 6rem;
    font-weight: 700;
    color: var(--primary-color);
    line-height: 1;
    margin-bottom: 1rem;
  }
}

.error-message {
  margin-bottom: 2rem;
  
  h1 {
    font-size: 2rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 1rem 0;
  }
  
  p {
    font-size: 1.1rem;
    color: var(--text-color-secondary);
    line-height: 1.6;
    margin: 0;
  }
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 3rem;
}

.helpful-links {
  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 1rem 0;
  }
  
  .links-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    max-width: 400px;
    margin: 0 auto;
    
    .quick-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem;
      background: var(--surface-card);
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-color);
      transition: all 0.2s ease;
      
      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-color: var(--primary-color);
      }
      
      i {
        font-size: 1.5rem;
        color: var(--primary-color);
      }
      
      span {
        font-weight: 500;
      }
    }
  }
}

@media (max-width: 768px) {
  .error-illustration .error-code {
    font-size: 4rem;
  }
  
  .error-message h1 {
    font-size: 1.5rem;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
    
    :deep(.p-button) {
      width: 200px;
    }
  }
  
  .helpful-links .links-grid {
    grid-template-columns: 1fr;
  }
}
</style>