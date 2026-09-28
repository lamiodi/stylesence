export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '600px', margin: 'auto' }}>
      <h1>Style Sence API Service</h1>
      <p style={{ color: '#666' }}>
        The backend service is running and healthy.
      </p>
      <ul>
        <li>Status: <strong>Operational</strong></li>
        <li>Health Check: <a href="/api/health">/api/health</a></li>
      </ul>
    </main>
  )
}
