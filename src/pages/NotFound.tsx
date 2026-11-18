import { Link } from 'react-router-dom'
import { Wind } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="page not-found">
      <Wind size={40} aria-hidden="true" />
      <p className="eyebrow">404</p>
      <h1>This page does not exist</h1>
      <p>The link may be outdated. Your saved household preferences are unaffected.</p>
      <Link className="primary-button" to="/">Return to overview</Link>
    </div>
  )
}
